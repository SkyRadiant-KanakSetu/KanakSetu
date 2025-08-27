-- Payments table for PG order-to-donation flow
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  institution_id INTEGER REFERENCES institutions(id),
  donor_name TEXT,
  donor_email TEXT,
  amount_inr NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CREATED','SUCCESS','FAILED')),
  pg_ref TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- KYC records (for donors or institutions)
CREATE TABLE IF NOT EXISTS kyc_records (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('DONOR','INSTITUTION')),
  entity_ref TEXT NOT NULL, -- donor email or institution id as string
  pan TEXT,
  full_name TEXT,
  address_json JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
