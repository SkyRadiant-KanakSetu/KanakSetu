import { streamReceiptPDF } from './receipt.js';
import { authRequired } from './middleware.js';
import express from 'express';
import { query } from './db.js';
import { buyGoldForInstitution } from './provider.js';
import { config } from './config.js';

const router = express.Router();

router.get('/config', (req, res) => {
  res.json({
    paymentMode: process.env.PAYMENT_MODE || 'MOCK',
    razorpayKey: process.env.RAZORPAY_KEY_ID_PUBLIC || '',
    kycMinINR: Number(process.env.DONATION_KYC_MIN_INR || 50000),
    donorKycRequireApproval: (process.env.DONOR_KYC_REQUIRE_APPROVAL || 'false').toLowerCase() === 'true'
  })
});

// Quote (mock rate) for UI
router.get('/providers/quote', (req, res)=>{
  res.json({ inrPerGram: config.goldRateINR, provider: config.provider });
});

// Health
router.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Institutions
router.get('/institutions', async (req, res) => {
  const { rows } = await query('SELECT * FROM institutions ORDER BY id ASC', []);
  res.json(rows);
});

router.post('/institutions', authRequired('PLATFORM_ADMIN'), async (req, res) => {
  const { name, pan, bank_account, gold_wallet_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });

  const { rows } = await query(
    'INSERT INTO institutions (name, pan, bank_account, gold_wallet_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, pan || null, bank_account || null, gold_wallet_id || null]
  );
  res.status(201).json(rows[0]);
});

// Donations
router.post('/donations', async (req, res) => {
  const { institutionId, donorName, donorEmail, amountINR } = req.body || {};
  if (!institutionId || !amountINR) {
    return res.status(400).json({ error: 'institutionId and amountINR required' });
  }

  // Get institution wallet
  const inst = await query('SELECT * FROM institutions WHERE id = $1', [institutionId]);
  if (inst.rows.length === 0) return res.status(404).json({ error: 'institution not found' });

  // Call provider to "buy" gold
  const result = await buyGoldForInstitution({
    institutionWalletId: inst.rows[0].gold_wallet_id || `WALLET-${inst.rows[0].id}`,
    amountINR: Number(amountINR),
  });

  if (!result.ok) return res.status(502).json({ error: 'provider_failed' });

  // Store donation
  const { rows } = await query(
    'INSERT INTO donations (institution_id, donor_name, donor_email, amount_inr, grams, provider_ref) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [institutionId, donorName || null, donorEmail || null, amountINR, result.grams, result.providerRef]
  );

  const recUrl = `/api/donations/${rows[0].id}/receipt.pdf`;
  res.status(201).json({ donation: rows[0], goldRateINR: config.goldRateINR, receiptUrl: recUrl });
});

router.get('/donations/:id', async (req, res) => {
  const { id } = req.params;
  const { rows } = await query('SELECT * FROM donations WHERE id = $1', [id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

// Institution donations list
router.get('/institutions/:id/donations', authRequired(), async (req, res) => {
  const { id } = req.params;
  // PERMISSION_CHECK_MARKER
  const uid = req.user?.id; const role = req.user?.role;
  if(role === 'TEMPLE_ADMIN'){
    const allowed = await query('SELECT 1 FROM institutions_users WHERE user_id=$1 AND institution_id=$2', [uid, id]);
    if(!allowed.rows.length) return res.status(403).json({ error: 'forbidden' });
  }
  const { rows } = await query('SELECT * FROM donations WHERE institution_id = $1 ORDER BY id DESC', [id]);
  res.json(rows);
});


// Admin: create user (temple admin) and assign to institution
router.post('/admin/users', authRequired('PLATFORM_ADMIN'), async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if(!name || !email || !password) return res.status(400).json({ error: 'name_email_password_required' });
  const r = await query('SELECT id FROM users WHERE email=$1', [email]);
  if(r.rows.length) return res.status(400).json({ error: 'email_taken' });
  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash(password, 10);
  const rl = role || 'TEMPLE_ADMIN';
  const { rows } = await query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role', [name, email, hash, rl]);
  res.status(201).json(rows[0]);
});
router.get('/admin/users', authRequired('PLATFORM_ADMIN'), async (req, res) => {
  const { rows } = await query('SELECT id,name,email,role FROM users ORDER BY id DESC', []);
  res.json(rows);
});
router.post('/admin/institutions/:id/admins', authRequired('PLATFORM_ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body || {};
  if(!userId) return res.status(400).json({ error: 'userId_required' });
  await query('INSERT INTO institutions_users (user_id, institution_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, id]);
  res.json({ ok: true });
});



router.get('/admin/audit', authRequired('PLATFORM_ADMIN'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 1000);
  const { rows } = await query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT $1', [limit]);
  res.json(rows);
});
export default router;


router.get('/admin/institutions', authRequired('PLATFORM_ADMIN'), async (req, res) => {
  const { rows } = await query('SELECT * FROM institutions ORDER BY id ASC', []);
  res.json(rows);
});


router.get('/donations/:id/receipt.pdf', async (req, res) => {
  const { id } = req.params;
  const d = await query('SELECT * FROM donations WHERE id=$1', [id]);
  if(!d.rows.length) return res.status(404).json({ error: 'not_found' });
  const donation = d.rows[0];
  const inst = await query('SELECT * FROM institutions WHERE id=$1', [donation.institution_id]);
  const institution = inst.rows[0] || null;
  return streamReceiptPDF({ donation, institution }, res);
});
