import Database from "better-sqlite3";

const db = new Database("finance.db");

// Create tables if not exist
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  balance REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  type TEXT,
  amount REAL,
  category TEXT,
  note TEXT,
  date TEXT
);
`);

export function getUser(userId) {
  let user = db.prepare("SELECT * FROM users WHERE user_id=?").get(userId);
  if (!user) {
    db.prepare("INSERT INTO users (user_id, balance) VALUES (?, 0)").run(userId);
    user = { user_id: userId, balance: 0 };
  }
  return user;
}

export function addIncome(userId, amount, category, note) {
  const date = new Date().toISOString();
  db.prepare("UPDATE users SET balance = balance + ? WHERE user_id=?").run(amount, userId);
  db.prepare(`
    INSERT INTO transactions (user_id,type,amount,category,note,date)
    VALUES (?,?,?,?,?,?)
  `).run(userId, "income", amount, category, note, date);
}

export function addExpense(userId, amount, category, note) {
  const date = new Date().toISOString();
  db.prepare("UPDATE users SET balance = balance - ? WHERE user_id=?").run(amount, userId);
  db.prepare(`
    INSERT INTO transactions (user_id,type,amount,category,note,date)
    VALUES (?,?,?,?,?,?)
  `).run(userId, "expense", amount, category, note, date);
}

export function getTransactions(userId) {
  return db.prepare(`
    SELECT * FROM transactions
    WHERE user_id=?
    ORDER BY id DESC
    LIMIT 20
  `).all(userId);
}
