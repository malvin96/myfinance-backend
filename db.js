import Database from "better-sqlite3"

export const db = new Database("finance.db")

db.exec(`
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT,
  account TEXT,
  category TEXT,
  note TEXT,
  amount INTEGER,
  type TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS balances (
  user TEXT,
  account TEXT,
  balance INTEGER
);
`)
