-- Users and roles for Kanak Setu
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('PLATFORM_ADMIN','TEMPLE_ADMIN')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Map temple admins to institutions (optional for future fine-grained access)
CREATE TABLE IF NOT EXISTS institutions_users (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  institution_id INTEGER REFERENCES institutions(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, institution_id)
);
