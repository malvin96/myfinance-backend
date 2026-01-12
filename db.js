import Database from "better-sqlite3"

export const db = new Database("myfinance.db")

db.exec(`
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT,
  user_code TEXT,
  type TEXT,
  account TEXT,
  asset TEXT,
  category TEXT,
  need_type TEXT,
  amount INTEGER,
  note TEXT,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dictionaries (
  key TEXT PRIMARY KEY,
  value TEXT
);
`)
