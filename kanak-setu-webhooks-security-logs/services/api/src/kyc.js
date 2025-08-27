import express from 'express';
import { query } from './db.js';
import { authRequired } from './middleware.js';

const router = express.Router();

// Submit KYC (donor or institution)
router.post('/submit', async (req, res) => {
  const { entityType, entityRef, pan, fullName, address } = req.body || {};
  if(!entityType || !entityRef) return res.status(400).json({ error: 'entity_required' });
  const { rows } = await query(
    'INSERT INTO kyc_records (entity_type, entity_ref, pan, full_name, address_json, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [entityType, String(entityRef), pan || null, fullName || null, address ? JSON.stringify(address) : null, 'PENDING']
  );
  res.status(201).json(rows[0]);
});

// Get KYC by entity
router.get('/:entityType/:entityRef', authRequired(), async (req, res) => {
  const { entityType, entityRef } = req.params;
  const { rows } = await query('SELECT * FROM kyc_records WHERE entity_type=$1 AND entity_ref=$2 ORDER BY id DESC', [entityType, entityRef]);
  res.json(rows);
});

// Approve/Reject (admin)
router.post('/:id/approve', authRequired('PLATFORM_ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { rows } = await query('UPDATE kyc_records SET status=$1 WHERE id=$2 RETURNING *', ['APPROVED', id]);
  res.json(rows[0] || {});
});
router.post('/:id/reject', authRequired('PLATFORM_ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { rows } = await query('UPDATE kyc_records SET status=$1 WHERE id=$2 RETURNING *', ['REJECTED', id]);
  res.json(rows[0] || {});
});

export default router;
