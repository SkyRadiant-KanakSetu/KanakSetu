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

