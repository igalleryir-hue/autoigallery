CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  mileage INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL,
  city TEXT NOT NULL,
  color TEXT,
  transmission TEXT,
  fuel TEXT,
  body_status TEXT,
  description TEXT,
  seller_name TEXT NOT NULL,
  seller_phone TEXT NOT NULL,
  image TEXT,
  user_id INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS external_price_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL,
  source_url TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  mileage INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL,
  city TEXT,
  body_status TEXT,
  transmission TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_external_price_samples_car ON external_price_samples(brand, model, year);

CREATE TABLE IF NOT EXISTS price_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  mileage INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  transmission TEXT,
  fuel TEXT,
  body_status TEXT,
  options TEXT,
  city TEXT DEFAULT 'گنبدکاووس',
  estimated_low INTEGER,
  estimated_mid INTEGER,
  estimated_high INTEGER,
  instant_buy_price INTEGER,
  confidence INTEGER,
  sample_count INTEGER,
  source_summary TEXT,
  algorithm_notes TEXT,
  admin_notes TEXT,
  status TEXT DEFAULT 'auto_priced',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES customer_users(id)
);
CREATE INDEX IF NOT EXISTS idx_price_requests_user ON price_requests(user_id, created_at);
