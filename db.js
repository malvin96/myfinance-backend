import Database from "better-sqlite3"

export const db = new Database("myfinance.db")

db.exec(`
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT,
  user TEXT,
  type TEXT,
  amount INTEGER,
  account TEXT,
  category TEXT,
  note TEXT,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`)
