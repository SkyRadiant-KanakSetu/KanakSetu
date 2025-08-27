# Kanak Setu – Overlay Patch
This overlay adds the next set of modules:
- Temple UI scoping (hide other institutions; per-role menus)
- HTML email templates (letterhead + multilingual)
- Receipt number sequencing (financial-grade IDs)
- Configurable 80G/12A details per institution (included on receipts)
- Metrics dashboard (charts for donations, KYC statuses, webhook health)

## How to apply
1) Unzip this folder **inside your repo root** (the one containing `services/`, `apps/`, and `db/`).
2) Run:
   ```bash
   python3 apply_patch.py
   ```
   This script will:
   - Add DB migrations `db/init/007_institution_tax.sql` and `db/init/008_receipt_sequence.sql`
   - Add `services/api/src/sequence.js` (receipt numbering helper)
   - Add `services/api/src/metrics.js` and mount it under `/api/admin/metrics`
   - Patch API/FE files in place (safe string replacements)
3) Rebuild & run:
   ```bash
   docker compose up -d --build
   ```

## New env (no changes needed to run)
- None strictly required for this overlay. (Existing SMTP/Razorpay configs continue to work.)

If the script shows any warnings, it will skip those steps safely. You can re-run it multiple times.
