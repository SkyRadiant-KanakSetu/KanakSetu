-- Simple audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  user_id INTEGER,
  ip TEXT,
  meta_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
