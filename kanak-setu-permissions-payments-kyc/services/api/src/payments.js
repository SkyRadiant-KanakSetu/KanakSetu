import express from 'express';
import { query } from './db.js';
import { buyGoldForInstitution } from './provider.js';
import { sendReceiptEmail } from './email.js';

const router = express.Router();

function mkOrderId(){
  return 'ORD-' + Math.random().toString(36).slice(2,10).toUpperCase();
}

// Create order (pre-donation)
router.post('/create-order', async (req, res) => {
  const { institutionId, donorName, donorEmail, amountINR } = req.body || {};
  if(!institutionId || !amountINR) return res.status(400).json({ error: 'institutionId_amount_required' });
  const orderId = mkOrderId();
  const { rows } = await query(
    'INSERT INTO payments (order_id, institution_id, donor_name, donor_email, amount_inr, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [orderId, institutionId, donorName || null, donorEmail || null, Number(amountINR), 'CREATED']
  );
  const paymentPageUrl = `/mock-pay/${orderId}`; // front-end mock page
  res.status(201).json({ order: rows[0], paymentPageUrl });
});

// Simulate success (for MOCK mode)
router.post('/:orderId/simulate-success', async (req, res) => {
  const { orderId } = req.params;
  const rec = await query('SELECT * FROM payments WHERE order_id=$1', [orderId]);
  if(!rec.rows.length) return res.status(404).json({ error: 'order_not_found' });
  const pay = rec.rows[0];
  if(pay.status === 'SUCCESS'){
    const d = await query('SELECT * FROM donations WHERE provider_ref=$1', [pay.order_id]);
    return res.json({ ok: true, donation: d.rows[0] || null });
  }

  // On success → allocate gold and create donation
  const inst = await query('SELECT * FROM institutions WHERE id=$1', [pay.institution_id]);
  if(!inst.rows.length) return res.status(400).json({ error: 'institution_not_found' });

  const result = await buyGoldForInstitution({
    institutionWalletId: inst.rows[0].gold_wallet_id || `WALLET-${inst.rows[0].id}`,
    amountINR: Number(pay.amount_inr),
  });
  if(!result.ok) return res.status(502).json({ error: 'provider_failed' });

  await query('UPDATE payments SET status=$1, pg_ref=$2 WHERE id=$3', ['SUCCESS', 'MOCK-SUCCESS', pay.id]);

  const { rows } = await query(
    'INSERT INTO donations (institution_id, donor_name, donor_email, amount_inr, grams, provider_ref) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [pay.institution_id, pay.donor_name, pay.donor_email, pay.amount_inr, result.grams, pay.order_id]
  );

  // Try email
  if (pay.donor_email){
    try {
      const instData = inst.rows[0];
      await sendReceiptEmail({ to: pay.donor_email, donation: rows[0], institution: instData });
    } catch(e){ console.error('email error', e.message); }
  }

  res.json({ ok: true, donation: rows[0] });
});

// Webhook endpoint (for real PG in future)
router.post('/webhook', async (req, res) => {
  // TODO: verify signature depending on PG, then lookup order_id, update status and perform allocation+donation insert.
  res.json({ ok: true });
});

export default router;
