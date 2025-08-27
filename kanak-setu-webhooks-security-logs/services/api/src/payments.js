import express from 'express';
import crypto from 'crypto';
import { query } from './db.js';
import { buyGoldForInstitution } from './provider.js';
import { sendReceiptEmail } from './email.js';
import { logAudit } from './audit.js';

const router = express.Router();

function mkOrderId(){
  return 'ORD-' + Math.random().toString(36).slice(2,10).toUpperCase();
}

async function ensureKycIfRequired({ amountINR, donorEmail }){
  const min = Number(process.env.DONATION_KYC_MIN_INR || 50000);
  const requireApproval = (process.env.DONOR_KYC_REQUIRE_APPROVAL || 'false').toLowerCase() === 'true';
  if(amountINR < min) return { ok: true };
  if(!donorEmail) return { ok: false, error: 'kyc_required_email_missing' };
  const { rows } = await query('SELECT * FROM kyc_records WHERE entity_type=$1 AND entity_ref=$2 ORDER BY id DESC', ['DONOR', donorEmail]);
  if(!rows.length) return { ok: false, error: 'kyc_required' };
  if(requireApproval && rows[0].status !== 'APPROVED') return { ok: false, error: 'kyc_pending_approval' };
  return { ok: true };
}

// Create order (PG-agnostic)
router.post('/create-order', async (req, res) => {
  const { institutionId, donorName, donorEmail, amountINR } = req.body || {};
  if(!institutionId || !amountINR) return res.status(400).json({ error: 'institutionId_amount_required' });

  // KYC gate
  const gate = await ensureKycIfRequired({ amountINR: Number(amountINR), donorEmail });
  if(!gate.ok) { await logAudit('payment.create_order.kyc_block', req, { institutionId, donorEmail, amountINR, reason: gate.error }); return res.status(412).json(gate); }

  const mode = (process.env.PAYMENT_MODE || 'MOCK').toUpperCase();

  if(mode === 'RAZORPAY'){
    const orderId = mkOrderId();
    // Create local record first
    const rec = await query(
      'INSERT INTO payments (order_id, institution_id, donor_name, donor_email, amount_inr, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [orderId, institutionId, donorName || null, donorEmail || null, Number(amountINR), 'CREATED']
    );
    // Create Razorpay order
    const keyId = process.env.RAZORPAY_KEY_ID_PUBLIC || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    const payload = { amount: Math.round(Number(amountINR) * 100), currency: 'INR', receipt: orderId, payment_capture: 1 };
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    try{
      const resp = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if(!resp.ok){ await logAudit('payment.create_order.razorpay_error', req, { payload, data }); return res.status(502).json({ error: 'razorpay_error', data }); }
      await logAudit('payment.create_order', req, { mode, orderId, rzp_order_id: data.id, amountINR });
      await query('UPDATE payments SET rzp_order_id=$1 WHERE id=$2', [data.id, rec.rows[0].id]);
      return res.status(201).json({ gateway: 'RAZORPAY', order: { ...rec.rows[0], rzp_order_id: data.id }, razorpay: { orderId: data.id, keyId } });
    }catch(e){
      await logAudit('payment.create_order.razorpay_exception', req, { message: e.message });
      return res.status(502).json({ error: 'razorpay_exception', message: e.message });
    }
  }

  // MOCK mode
  const orderId = mkOrderId();
  const { rows } = await query(
    'INSERT INTO payments (order_id, institution_id, donor_name, donor_email, amount_inr, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [orderId, institutionId, donorName || null, donorEmail || null, Number(amountINR), 'CREATED']
  );
  await logAudit('payment.create_order', req, { mode, orderId, amountINR });
  const paymentPageUrl = `/mock-pay/${orderId}`;
  return res.status(201).json({ gateway: 'MOCK', order: rows[0], paymentPageUrl });
});

// Verify (Razorpay checkout success)
router.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if(!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return res.status(400).json({ error: 'missing_params' });
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const h = crypto.createHmac('sha256', keySecret);
  h.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const expected = h.digest('hex');
  if(expected !== razorpay_signature){ await logAudit('payment.verify.bad_signature', req, { razorpay_order_id, razorpay_payment_id }); return res.status(401).json({ error: 'bad_signature' }); }

  // Find local payment by receipt/order_id mapping
  /* removed unused weird lookup */
  // Fallback: try by pg_ref or store mapping elsewhere
  const byRzp = await query('SELECT * FROM payments WHERE rzp_order_id=$1', [razorpay_order_id]);
  const pay = byRzp.rows[0];
  if(!pay) return res.status(404).json({ error: 'order_not_found' });

  if(pay.status === 'SUCCESS'){
    const d = await query('SELECT * FROM donations WHERE provider_ref=$1', [pay.order_id]);
    return res.json({ ok: true, donation: d.rows[0] || null });
  }

  // Allocate & create donation
  const inst = await query('SELECT * FROM institutions WHERE id=$1', [pay.institution_id]);
  if(!inst.rows.length) return res.status(400).json({ error: 'institution_not_found' });

  const result = await buyGoldForInstitution({
    institutionWalletId: inst.rows[0].gold_wallet_id || `WALLET-${inst.rows[0].id}`,
    amountINR: Number(pay.amount_inr),
  });
  if(!result.ok) return res.status(502).json({ error: 'provider_failed' });

  await query('UPDATE payments SET status=$1, pg_ref=$2, rzp_payment_id=$3 WHERE id=$4', ['SUCCESS', razorpay_payment_id, razorpay_payment_id, pay.id]);
  const { rows } = await query(
    'INSERT INTO donations (institution_id, donor_name, donor_email, amount_inr, grams, provider_ref) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [pay.institution_id, pay.donor_name, pay.donor_email, pay.amount_inr, result.grams, pay.order_id]
  );
  await logAudit('payment.verify.success', req, { order_id: pay.order_id, payment_id: razorpay_payment_id, donation_id: rows[0].id });

  // Email receipt if possible
  if(pay.donor_email){
    try{ await sendReceiptEmail({ to: pay.donor_email, donation: rows[0], institution: inst.rows[0] }); }catch(e){ console.error('email error', e.message); }
  }
  res.json({ ok: true, donation: rows[0] });
});

// Simulate success (MOCK only)
router.post('/:orderId/simulate-success', async (req, res) => {
  const mode = (process.env.PAYMENT_MODE || 'MOCK').toUpperCase();
  if(mode !== 'MOCK') return res.status(400).json({ error: 'not_mock_mode' });
  const { orderId } = req.params;
  const rec = await query('SELECT * FROM payments WHERE order_id=$1', [orderId]);
  if(!rec.rows.length) return res.status(404).json({ error: 'order_not_found' });
  const pay = rec.rows[0];
  if(pay.status === 'SUCCESS'){
    const d = await query('SELECT * FROM donations WHERE provider_ref=$1', [pay.order_id]);
    return res.json({ ok: true, donation: d.rows[0] || null });
  }

  const inst = await query('SELECT * FROM institutions WHERE id=$1', [pay.institution_id]);
  const result = await buyGoldForInstitution({ institutionWalletId: inst.rows[0].gold_wallet_id || `WALLET-${inst.rows[0].id}`, amountINR: Number(pay.amount_inr) });
  await query('UPDATE payments SET status=$1, pg_ref=$2, rzp_payment_id=$3 WHERE id=$4', ['SUCCESS', 'MOCK-SUCCESS', 'MOCK-SUCCESS', pay.id]);
  const { rows } = await query('INSERT INTO donations (institution_id, donor_name, donor_email, amount_inr, grams, provider_ref) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [pay.institution_id, pay.donor_name, pay.donor_email, pay.amount_inr, result.grams, pay.order_id]);
  await logAudit('payment.mock.success', req, { order_id: pay.order_id, donation_id: rows[0].id });
  res.json({ ok: true, donation: rows[0] });
});

// Webhook (Razorpay)
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try{
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const raw = req.rawBody || req.body;
    const rawBuf = Buffer.isBuffer(raw) ? raw : Buffer.from(typeof raw === 'string' ? raw : JSON.stringify(raw));
    const expected = require('crypto').createHmac('sha256', secret).update(rawBuf).digest('hex');
    if(expected !== signature) return res.status(401).json({ error: 'bad_webhook_signature' });
    const event = JSON.parse(rawBuf.toString('utf8'));
    await logAudit('payment.webhook', req, { event: event.event, id: event.payload?.payment?.entity?.id || null });

    if(event.event === 'payment.captured'){
      const payEntity = event.payload?.payment?.entity || {};
      const rzp_order_id = payEntity.order_id;
      const rzp_payment_id = payEntity.id;
      if(rzp_order_id){
        const rec = await query('SELECT * FROM payments WHERE rzp_order_id=$1', [rzp_order_id]);
        const pay = rec.rows[0];
        if(pay && pay.status !== 'SUCCESS'){
          const inst = await query('SELECT * FROM institutions WHERE id=$1', [pay.institution_id]);
          const result = await buyGoldForInstitution({ institutionWalletId: inst.rows[0].gold_wallet_id || `WALLET-${inst.rows[0].id}`, amountINR: Number(pay.amount_inr) });
          await query('UPDATE payments SET status=$1, pg_ref=$2, rzp_payment_id=$3 WHERE id=$4', ['SUCCESS', rzp_payment_id, rzp_payment_id, pay.id]);
          const d = await query('INSERT INTO donations (institution_id, donor_name, donor_email, amount_inr, grams, provider_ref) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
            [pay.institution_id, pay.donor_name, pay.donor_email, pay.amount_inr, result.grams, pay.order_id]);
          await logAudit('payment.webhook.captured_allocated', req, { order_id: pay.order_id, payment_id: rzp_payment_id, donation_id: d.rows[0].id });
        }
      }
    }
    res.json({ ok: true });
  }catch(e){
    console.error('webhook error', e);
    res.status(400).json({ error: 'webhook_parse_error' });
  }
});

export default router;
