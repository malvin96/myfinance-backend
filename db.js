import Database from "better-sqlite3"

export const db = new Database("finance.db")

db.exec(`
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT,
  user TEXT,
  account TEXT,
  category TEXT,
  note TEXT,
  amount INTEGER,
  type TEXT,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`)
