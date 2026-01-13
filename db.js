import Database from "better-sqlite3";
const db = new Database("myfinance.db");

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT,
      account TEXT,
      amount REAL,
      category TEXT,
      note TEXT,
      timestamp DATETIME DEFAULT (DATETIME('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS budgets (
      category TEXT PRIMARY KEY,
      limit_amt REAL
    );
  `);
}

export function addTx(p) {
  const stmt = db.prepare("INSERT INTO transactions (user, account, amount, category, note) VALUES (?, ?, ?, ?, ?)");
  return stmt.run(p.user, p.account, p.amount, p.category, p.note);
}

export function getRekapLengkap() {
  const startOfMonth = "date('now', 'start of month')";
  const perUser = db.prepare("SELECT user, SUM(amount) as balance FROM transactions GROUP BY user").all();
  const perAccount = db.prepare("SELECT account, SUM(amount) as balance FROM transactions GROUP BY account").all();
  const total = db.prepare(`
    SELECT 
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense,
      SUM(amount) as net
    FROM transactions 
    WHERE date(timestamp) >= ${startOfMonth}
  `).get();
  return { perUser, perAccount, total };
}

export function getHistoryLengkap(period = "hari ini") {
  let cond = "date('now', 'localtime')";
  if (period === "minggu ini") cond = "date('now', '-7 days')";
  if (period === "bulan ini") cond = "date('now', 'start of month')";

  return db.prepare(`
    SELECT user, account, amount, note, category, timestamp 
    FROM transactions 
    WHERE date(timestamp) >= ${cond}
    ORDER BY timestamp DESC
  `).all();
}

export function searchNotes(q) {
  return db.prepare("SELECT * FROM transactions WHERE note LIKE ? ORDER BY timestamp DESC LIMIT 10").all(`%${q}%`);
}

export function addBudget(cat, amt) {
  db.prepare("INSERT OR REPLACE INTO budgets (category, limit_amt) VALUES (?, ?)").run(cat, amt);
}

export function getAllBudgetStatus() {
  const startOfMonth = "date('now', 'start of month')";
  return db.prepare(`
    SELECT b.category as cat, b.limit_amt, 
    (SELECT ABS(SUM(amount)) FROM transactions t WHERE t.category = b.category AND amount < 0 AND date(timestamp) >= ${startOfMonth}) as used
    FROM budgets b
  `).all();
}

export function getBudgetValue(cat) {
  const res = db.prepare("SELECT limit_amt FROM budgets WHERE category = ?").get(cat);
  return res ? res.limit_amt : null;
}

export function getTotalExpenseMonth(cat) {
  const startOfMonth = "date('now', 'start of month')";
  const res = db.prepare("SELECT ABS(SUM(amount)) as total FROM transactions WHERE category = ? AND amount < 0 AND date(timestamp) >= ${startOfMonth}").get(cat);
  return res ? res.total : 0;
}
