-- Schema for Kanak Setu
CREATE TABLE IF NOT EXISTS institutions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  pan TEXT,
  bank_account TEXT,
  gold_wallet_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS donations (
  id SERIAL PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  donor_name TEXT,
  donor_email TEXT,
  amount_inr NUMERIC(14,2) NOT NULL,
  grams NUMERIC(14,6) NOT NULL,
  provider_ref TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
