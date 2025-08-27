import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const router = express.Router();

async function ensureAdmin(){
  const email = process.env.ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME || 'Admin';
  const pass = process.env.ADMIN_PASSWORD;
  if(!email || !pass) return;
  const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
  if(existing.rows.length) return;
  const hash = await bcrypt.hash(pass, 10);
  await query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)', [name, email, hash, 'PLATFORM_ADMIN']);
  console.log('[auth] Bootstrapped admin user:', email);
}

ensureAdmin().catch(err => console.error('ensureAdmin error', err));

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if(!email || !password) return res.status(400).json({ error: 'email_password_required' });
  const { rows } = await query('SELECT * FROM users WHERE email=$1', [email]);
  if(!rows.length) return res.status(401).json({ error: 'invalid_credentials' });
  const u = rows[0];
  const ok = await bcrypt.compare(password, u.password_hash);
  if(!ok) return res.status(401).json({ error: 'invalid_credentials' });
  const token = jwt.sign({ id: u.id, name: u.name, email: u.email, role: u.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '7d' });
  res.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

export default router;
