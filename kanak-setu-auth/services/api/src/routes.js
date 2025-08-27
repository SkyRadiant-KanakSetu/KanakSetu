import { streamReceiptPDF } from './receipt.js';
import { authRequired } from './middleware.js';
import express from 'express';
import { query } from './db.js';
import { buyGoldForInstitution } from './provider.js';
import { config } from './config.js';

const router = express.Router();

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
router.get('/institutions/:id/donations', async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    'SELECT * FROM donations WHERE institution_id = $1 ORDER BY id DESC',
    [id]
  );
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
