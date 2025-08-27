#!/usr/bin/env python3
import os, re, json, sys

ROOT = os.getcwd()

def exists(path): return os.path.exists(os.path.join(ROOT, path))
def r(path):
    with open(os.path.join(ROOT, path), "r", encoding="utf-8") as f: return f.read()
def w(path, content):
    p = os.path.join(ROOT, path); os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f: f.write(content)
def rw(path, transform):
    p = os.path.join(ROOT, path)
    with open(p, "r", encoding="utf-8") as f: c = f.read()
    nc = transform(c)
    with open(p, "w", encoding="utf-8") as f: f.write(nc)

def safe_patch(path, func, note):
    try:
        if not exists(path):
            print(f"[skip] {note}: {path} not found")
            return
        rw(path, func)
        print(f"[ok] {note}")
    except Exception as e:
        print(f"[warn] {note} failed: {e}")

# 1) DB migrations
w("db/init/007_institution_tax.sql", """ALTER TABLE IF EXISTS institutions
  ADD COLUMN IF NOT EXISTS addr_line1 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS pin TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS eighty_g_no TEXT,
  ADD COLUMN IF NOT EXISTS twelve_a_no TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;""")

w("db/init/008_receipt_sequence.sql", """ALTER TABLE IF EXISTS donations
  ADD COLUMN IF NOT EXISTS receipt_no TEXT UNIQUE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'receipt_seq') THEN
    CREATE SEQUENCE receipt_seq START WITH 1 INCREMENT BY 1;
  END IF;
END$$;""")

# 2) sequence.js
w("services/api/src/sequence.js", """import { query } from './db.js';
export async function nextReceiptNo(){
  const { rows } = await query('SELECT nextval(\\'receipt_seq\\') AS n', []);
  const n = Number(rows[0].n || 1);
  const year = new Date().getFullYear();
  return `KS-${year}-${String(n).padStart(6,'0')}`;
}""")

# 3) receipt.js tweaks
def patch_receipt(c):
    c = c.replace("Receipt ID:", "Receipt No:")
    if "80G Reg No" not in c:
        c = c.replace(
            "doc.text(`Institution: ${institution?.name || donation.institution_id}`);",
            "doc.text(`Institution: ${institution?.name || donation.institution_id}`);\n  if(institution){\n    if(institution.addr_line1) doc.text(`Address: ${institution.addr_line1}, ${institution.city||''} ${institution.state||''} ${institution.pin||''} ${institution.country||''}`);\n    if(institution.eighty_g_no) doc.text(`80G Reg No: ${institution.eighty_g_no}`);\n    if(institution.twelve_a_no) doc.text(`12A Reg No: ${institution.twelve_a_no}`);\n  }"
        )
    return c
safe_patch("services/api/src/receipt.js", patch_receipt, "PDF receipt – receipt_no + 80G/12A/address")

# 4) email.js HTML + i18n
def patch_email(c):
    if "renderEmailHTML" in c: return c
    c = c.replace(
        "export async function sendReceiptEmail({ to, donation, institution }){",
        "export function renderEmailHTML({ donation, institution, lang='en' }){\n  const T = {\n    en: { thanks: 'Thank you for your donation', receipt: 'Donation Receipt', inst: 'Institution', amount: 'Amount (INR)', gold: 'Gold Credited (g)', receiptNo: 'Receipt No', date: 'Date' },\n    hi: { thanks: 'आपके दान के लिए धन्यवाद', receipt: 'दान रसीद', inst: 'संस्था', amount: 'राशि (₹)', gold: 'स्वर्ण (ग्राम)', receiptNo: 'रसीद क्रमांक', date: 'तिथि' },\n    ta: { thanks: 'உங்கள் காணிக்கைக்கு நன்றி', receipt: 'காணிக்கை ரசீது', inst: 'அமைப்பு', amount: 'தொகை (₹)', gold: 'தங்கம் (கிராம்)', receiptNo: 'ரசீது எண்', date: 'தேதி' }\n  }[lang] || T['en'];\n  const issuer = process.env.RECEIPT_ISSUER || 'Kanak Setu';\n  const address = process.env.RECEIPT_ADDRESS || 'India';\n  const recNo = donation.receipt_no || donation.id;\n  return `<!doctype html><html><body style=\"font-family:Arial,Helvetica,sans-serif;color:#222\">\n    <div style=\"max-width:600px;margin:auto;border:1px solid #eee;border-radius:10px;padding:16px\">\n      <div style=\"display:flex;align-items:center;gap:12px\">\n        <div style=\\\"width:12px;height:12px;background:#d4af37;border-radius:50%\\\"></div>\n        <h2 style=\\\"margin:0\\\">${issuer}</h2>\n      </div>\n      <div style=\\\"font-size:12px;color:#555\\\">${address}</div>\n      <hr/>\n      <h3 style=\\\"margin:8px 0\\\">${T.receipt}</h3>\n      <p>${T.thanks}.</p>\n      <table cellpadding=\\\"6\\\">\n        <tr><td><b>${T.receiptNo}:</b></td><td>${recNo}</td></tr>\n        <tr><td><b>${T.date}:</b></td><td>${new Date(donation.created_at).toLocaleString()}</td></tr>\n        <tr><td><b>${T.inst}:</b></td><td>${institution?.name || donation.institution_id}</td></tr>\n        <tr><td><b>${T.amount}:</b></td><td>₹${donation.amount_inr}</td></tr>\n        <tr><td><b>${T.gold}:</b></td><td>${donation.grams}</td></tr>\n      </table>\n    </div>\n  </body></html>`;\n}\n\nexport async function sendReceiptEmail({ to, donation, institution, lang='en' }){"
    )
    c = c.replace(
        "const info = await tx.sendMail({",
        "const html = renderEmailHTML({ donation, institution, lang });\n  const info = await tx.sendMail({"
    ).replace(
        "text: `Thank you for your donation of ₹${donation.amount_inr}. Your receipt ID is ${donation.id}.`,",
        "subject: `Donation Receipt ${donation.receipt_no || donation.id}`,\n    text: `Thank you for your donation of ₹${donation.amount_inr}. Receipt ${donation.receipt_no || donation.id}.`,\n    html,"
    )
    return c
safe_patch("services/api/src/email.js", patch_email, "Email HTML + multilingual")

# 5) payments.js – include receipt_no on inserts
def patch_payments(c):
    if "nextReceiptNo" not in c:
        c = "import { nextReceiptNo } from './sequence.js';\n" + c
    c = c.replace(
        "INSERT INTO donations (institution_id, donor_name, donor_email, amount_inr, grams, provider_ref) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        "INSERT INTO donations (institution_id, donor_name, donor_email, amount_inr, grams, provider_ref, receipt_no) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *"
    )
    c = c.replace(
        "[pay.institution_id, pay.donor_name, pay.donor_email, pay.amount_inr, result.grams, pay.order_id]",
        "[pay.institution_id, pay.donor_name, pay.donor_email, pay.amount_inr, result.grams, pay.order_id, await nextReceiptNo()]"
    )
    return c
safe_patch("services/api/src/payments.js", patch_payments, "Payments → donation inserts + receipt_no")

# 6) routes.js – direct donation insert + /my/institutions + import nextReceiptNo
def patch_routes(c):
    if "nextReceiptNo" not in c:
        c = "import { nextReceiptNo } from './sequence.js';\n" + c
    c = c.replace(
        "INSERT INTO donations (institution_id, donor_name, donor_email, amount_inr, grams, provider_ref) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        "INSERT INTO donations (institution_id, donor_name, donor_email, amount_inr, grams, provider_ref, receipt_no) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *"
    ).replace(
        "[institutionId, donorName || null, donorEmail || null, amountINR, result.grams, result.providerRef]",
        "[institutionId, donorName || null, donorEmail || null, amountINR, result.grams, result.providerRef, await nextReceiptNo()]"
    )
    if "router.get('/my/institutions'" not in c:
        c += """
router.get('/my/institutions', authRequired(), async (req, res) => {
  const role = req.user?.role;
  const uid = req.user?.id;
  if(role === 'PLATFORM_ADMIN'){
    const { rows } = await query('SELECT * FROM institutions ORDER BY id ASC', []);
    return res.json(rows);
  }
  const { rows } = await query(
    `SELECT i.* FROM institutions i JOIN institutions_users iu ON iu.institution_id=i.id WHERE iu.user_id=$1 ORDER BY i.id ASC`,
    [uid]
  );
  res.json(rows);
});
"""
    return c
safe_patch("services/api/src/routes.js", patch_routes, "Routes → receipt_no + /my/institutions")

# 7) auth.js – secure /me
def patch_auth(c):
    if "authRequired()" in c and "router.get('/me'" in c: return c
    return c.replace(
        "router.get('/me', (req, res) => {",
        "import { authRequired } from './middleware.js';\n\nrouter.get('/me', authRequired(), (req, res) => {"
    )
safe_patch("services/api/src/auth.js", patch_auth, "Auth → secure /me")

# 8) index.js – mount metrics, remove stray /auth/me hook if present
def patch_index(c):
    c = c.replace("app.use('/auth/me', authRequired(), (req,res)=>res.json({ ok:true }));\n", "")
    if "import metricsRoutes from './metrics.js';" not in c:
        c = c.replace("import kycRoutes from './kyc.js';", "import kycRoutes from './kyc.js';\nimport metricsRoutes from './metrics.js';")
    if "app.use('/api', metricsRoutes);" not in c:
        c = c.replace("app.use('/api/kyc', kycRoutes);", "app.use('/api/kyc', kycRoutes);\napp.use('/api', metricsRoutes);")
    return c
safe_patch("services/api/src/index.js", patch_index, "Index → mount metrics + cleanup")

# 9) metrics.js (new)
w("services/api/src/metrics.js", """import express from 'express';
import { query } from './db.js';
import { authRequired } from './middleware.js';
import { adminIPAllowed } from './security.js';
const router = express.Router();
router.get('/admin/metrics', authRequired('PLATFORM_ADMIN'), adminIPAllowed, async (req, res) => {
  const donations = await query(`SELECT to_char(created_at::date,'YYYY-MM-DD') as d, COUNT(*) c, SUM(amount_inr) s FROM donations WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY 1 ORDER BY 1`, []);
  const kyc = await query(`SELECT status, COUNT(*) c FROM kyc_records GROUP BY 1`, []);
  const webhooks = await query(`SELECT event, COUNT(*) c FROM audit_logs WHERE created_at > NOW() - INTERVAL '30 days' AND event LIKE 'payment.%' GROUP BY 1`, []);
  res.json({ donations: donations.rows, kyc: kyc.rows, webhooks: webhooks.rows });
});
export default router;
""")

# 10) Institution UI scoping + role menu
def patch_inst_app(c):
    if "whoAmI" not in c:
        c = c.replace("import { getInstitutions, getInstitutionDonations } from './api'", "import { getInstitutionDonations, whoAmI } from './api'")
    c = c.replace("<a href=\"/admin\" target=\"_blank\" rel=\"noreferrer\">Admin</a>", "{me?.role==='PLATFORM_ADMIN' && <a href=\"/admin\" target=\"_blank\" rel=\"noreferrer\">Admin</a>}")
    if "my/institutions" not in c:
        c = c.replace("const [institutions, setInstitutions] = useState([])\n  useEffect(()=>{ getInstitutions().then(setInstitutions) }, [])",
                      "const [institutions, setInstitutions] = useState([])\n  useEffect(()=>{ whoAmI().then(d=>setMe(d.user||null)); fetch('/api/my/institutions', { headers: { 'Authorization': `Bearer ${localStorage.getItem('ks_token')||''}` } }).then(r=>r.json()).then(setInstitutions) }, [])")
    return c
safe_patch("apps/institution-web/src/App.jsx", patch_inst_app, "Institution UI → scoping + role menus")

# 11) Admin metrics UI
w("apps/admin-web/src/Metrics.jsx", """import React, { useEffect, useState } from 'react'
import { whoAmI } from './api'

function LineChart({ data, width=680, height=240, xKey='d', yKey='s' }){
  if(!data || !data.length) return <div className="card">No data</div>
  const w = width, h = height, p=30
  const xs = data.map(d=>d[xKey]); const ys = data.map(d=>Number(d[yKey]||0))
  const minY = 0; const maxY = Math.max(...ys) || 1
  const xStep = (w - 2*p) / Math.max(1, xs.length - 1)
  const scaleY = (val)=> h - p - (val - minY) * (h - 2*p) / (maxY - minY || 1)
  const points = ys.map((y,i)=> `${p + i*xStep},${scaleY(y)}`).join(' ')
  return (
    <svg width={w} height={h} style={{background:'#fff',border:'1px solid #eee',borderRadius:12}}>
      <polyline fill="none" stroke="#d4af37" strokeWidth="2" points={points} />
      {ys.map((y,i)=> <circle key={i} cx={p + i*xStep} cy={scaleY(y)} r="3" fill="#d4af37" />)}
      {xs.map((x,i)=> <text key={i} x={p + i*xStep} y={h-8} fontSize="10" textAnchor="middle">{x.slice(5)}</text>)}
    </svg>
  )
}

export default function Metrics(){
  const [data, setData] = useState({ donations:[], kyc:[], webhooks:[] })
  const [me, setMe] = useState(null)
  useEffect(()=>{
    whoAmI().then(d=> setMe(d.user||null))
    fetch('/api/admin/metrics', { headers: { 'Authorization': `Bearer ${localStorage.getItem('ks_token')||''}` } })
      .then(r=>r.json()).then(setData)
  }, [])

  return (
    <div className="container">
      <h1>Admin – Metrics</h1>
      <div className="card">
        <h3>Donations (₹ sum, last 30 days)</h3>
        <LineChart data={data.donations} xKey="d" yKey="s" />
      </div>
      <div className="card">
        <h3>KYC Status</h3>
        {data.kyc.map(k=> <div key={k.status} className="badge" style={{marginRight:8}}>{k.status}: {k.c}</div>)}
      </div>
      <div className="card">
        <h3>Payments/Webhooks (30d)</h3>
        {data.webhooks.map(w=> <div key={w.event} className="badge" style={{marginRight:8}}>{w.event}: {w.c}</div>)}
      </div>
    </div>
  )
}
""")

def patch_admin_app(c):
    if "Metrics.jsx" not in c:
        c = c.replace("import Users from './Users.jsx'", "import Users from './Users.jsx'\nimport Metrics from './Metrics.jsx'")
    if "/metrics" not in c:
        c = c.replace("<Routes>", "<Routes>\n        <Route path=\"/metrics\" element={<Metrics/>} />")
    if "Users & Permissions</Link>" in c and "Metrics</Link>" not in c:
        c = c.replace("Users & Permissions</Link>", "Users & Permissions</Link> <Link className=\"button\" to=\"/metrics\">Metrics</Link>")
    return c
safe_patch("apps/admin-web/src/App.jsx", patch_admin_app, "Admin UI → metrics nav")

# 12) Donor success page receipt no
def patch_donor_success(c):
    return c.replace("<p><strong>Receipt ID:</strong> {donation?.id}</p>", "<p><strong>Receipt No:</strong> {donation?.receipt_no || donation?.id}</p>")
safe_patch("apps/donor-web/src/App.jsx", patch_donor_success, "Donor UI → show receipt no")

print("\nOverlay applied. Now run:\n  docker compose up -d --build\n")

