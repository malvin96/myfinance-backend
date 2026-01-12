import Database from "better-sqlite3"

export const db = new Database("myfinance.db")

db.exec(`
CREATE TABLE IF NOT EXISTS balances (
  user TEXT,
  account TEXT,
  amount REAL,
  PRIMARY KEY(user, account)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT,
  amount REAL,
  category TEXT,
  account TEXT,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`)
