# Kanak Setu – Digital Gold Donation (Direct Settlement)

This is a **launch-ready starter repo** for your Kanak Setu MVP.  
It includes:

- **reverse-proxy (nginx)**
- **API (Node.js + Express)**
- **Three frontends** (Vite + React):
  - `donor-web` (donor app)
  - `institution-web` (temple/NGO dashboard)
  - `admin-web` (Kanak Setu ops)
- **PostgreSQL** (with schema + seed)

## Quick Start

1) **Install Docker** (Desktop)  
2) Download & unzip this project.  
3) Create your env:
   ```bash
   cp .env.example .env
   ```
4) Launch:
   ```bash
   docker compose up -d --build
   ```
5) Open:
   - Donor App → http://localhost/
   - Temple Dashboard → http://localhost/temple
   - Admin App → http://localhost/admin
   - API Health → http://localhost/api/health

> First run initializes DB with **sample institutions**.

## Environment Variables

Edit `.env` (copied from `.env.example`):

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `DATABASE_URL` (internal, used by API)
- `PORT` (API port, default 3000)
- `GOLD_RATE_INR` (fallback mock rate per gram)
- `PROVIDER` = `MOCK` (for now)
- `PROVIDER_API_KEY` = `changeme`

## Direct Settlement Notes

- The **API** contains a provider adapter (`services/api/src/provider.js`).
- It currently uses a **MOCK** provider that simulates buying gold.
- When you sign with **MMTC-PAMP/Augmont**, implement the HTTP calls inside `provider.js` and set `PROVIDER=MMTCPAMP` (or similar) plus keys in `.env`.

## Development (optional)

You can run services individually (without Docker) after `npm install` in each package. For production-like behavior, stick to Docker.

## Security & Next Steps

- Use HTTPS in production (terminate TLS at nginx or a cloud LB).
- Add proper auth (JWT/OAuth) and KYC where needed.
- Replace MOCK provider with **MMTC-PAMP** integration.
- Enable rate limiting, audit logs, and structured logging.
- Configure a production Postgres (e.g., AWS RDS).

---

## Branding Applied
- Gold theme (`#d4af37`), logo & favicon across all apps.
- Shared header with logo + cleaner UI.

## MMTC-PAMP Hook (Scaffold)
- Env vars added to `.env.example`.
- Set `PROVIDER=MMTCPAMP` and `MMTCPAMP_DRY_RUN=true` to **simulate** provider allocation using the configured `GOLD_RATE_INR`.
- When live creds & endpoints are ready:
  1. Set `MMTCPAMP_DRY_RUN=false`
  2. Implement real HTTP calls in `services/api/src/provider.js` (marked TODO)
  3. Add webhook handlers if provider sends async confirmations (add a new route e.g. `/api/provider/webhook`)

> Pilot tip: Keep `PROVIDER=MOCK` or switch to `PROVIDER=MMTCPAMP` with `DRY_RUN=true` until production credentials are finalized.


## Permissions
- **TEMPLE_ADMIN** is restricted to only their assigned institution(s).
- Admin endpoints to manage permissions:
  - `POST /api/admin/users` – create users (default TEMPLE_ADMIN)
  - `GET /api/admin/users` – list users
  - `POST /api/admin/institutions/:id/admins` – assign a user to an institution
- Protected: `GET /api/institutions/:id/donations` requires auth. Platform Admin sees all; Temple Admin sees only assigned institutions.

## Payments (Mock → Real-ready)
- **Create order:** `POST /api/payments/create-order` → returns `orderId` and mock pay URL.
- **Simulate success:** `POST /api/payments/:orderId/simulate-success` → allocates gold and creates donation.
- **Webhook (future PG):** `POST /api/payments/webhook` – placeholder to wire Razorpay/PayU callbacks.
- Frontend donor flow now uses **order → mock-pay → success**.

## Email Receipts
- Configure SMTP in `.env` to enable automatic email with PDF receipt to donors.
- If SMTP is not configured, the system skips email gracefully.

## KYC
- Submit: `POST /api/kyc/submit` with `{ entityType: 'INSTITUTION'|'DONOR', entityRef, pan, fullName, address }`
- Review: `GET /api/kyc/:entityType/:entityRef` (auth)
- Approve/Reject: `POST /api/kyc/:id/approve|reject` (admin)
- Institution dashboard includes a simple **/temple/kyc** form.

## Razorpay Integration (Client + Server Scaffold)
- Set in `.env`:
  ```
  PAYMENT_MODE=RAZORPAY
  RAZORPAY_KEY_ID_PUBLIC=your_public_key
  RAZORPAY_KEY_SECRET=your_secret_key
  RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
  ```
- Flow:
  1. `POST /api/payments/create-order` → creates local record + Razorpay order, returns `{razorpay.orderId, keyId}`
  2. Frontend opens Razorpay Checkout (pre-wired in donor app)
  3. On success, frontend calls `POST /api/payments/verify` with `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`
  4. Server verifies HMAC, allocates gold, creates donation, emails PDF receipt
  5. (Optional) Razorpay webhook → `POST /api/payments/webhook` (signature verified with `RAZORPAY_WEBHOOK_SECRET`)

## Donor KYC Gate
- Env controls:
  - `DONATION_KYC_MIN_INR` (default 50000)
  - `DONOR_KYC_REQUIRE_APPROVAL` (default false)
- Server will block high-value orders with `412` until KYC exists (and approved if required).
- Donor app collects **PAN** when amount ≥ threshold and auto-submits a light KYC record.

## Audit Logs
- Table: `audit_logs` with `event`, `user_id`, `ip`, `meta_json`, `created_at`
- Admin endpoint: `GET /api/admin/audit?limit=100`
- Tracked events: order creation, KYC blocks, Razorpay errors, verification success, mock success, (and more can be added).
