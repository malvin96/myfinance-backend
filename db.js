import Database from "better-sqlite3";
const db = new Database("myfinance.db");

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT, account TEXT, amount REAL, category TEXT, note TEXT,
      timestamp DATETIME DEFAULT (DATETIME('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT, due_date INTEGER
    );
    CREATE TABLE IF NOT EXISTS budgets (
      category TEXT PRIMARY KEY, amount REAL
    );
  `);
}

export function addTx(p) {
  const stmt = db.prepare("INSERT INTO transactions (user, account, amount, category, note) VALUES (?, ?, ?, ?, ?)");
  return stmt.run(p.user, p.account, p.amount, p.category, p.note);
}

export function resetAccountBalance(user, account) {
  return db.prepare("DELETE FROM transactions WHERE user = ? AND account = ?").run(user, account);
}

export function deleteLastTx(user) {
  const last = db.prepare("SELECT id, note, amount FROM transactions WHERE user = ? ORDER BY id DESC LIMIT 1").get(user);
  if (last) db.prepare("DELETE FROM transactions WHERE id = ?").run(last.id);
  return last;
}

export function setBudget(category, amount) {
  return db.prepare("INSERT OR REPLACE INTO budgets (category, amount) VALUES (?, ?)").run(category, amount);
}

export function getBudgetStatus(category) {
  const budget = db.prepare("SELECT amount FROM budgets WHERE category = ?").get(category);
  if (!budget) return null;
  const spent = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE category = ? AND amount < 0 AND strftime('%m', timestamp) = strftime('%m', 'now')").get(category);
  return { limit: budget.amount, spent: Math.abs(spent.total || 0) };
}

export function getChartData() {
  return db.prepare("SELECT category, ABS(SUM(amount)) as total FROM transactions WHERE amount < 0 AND strftime('%m', timestamp) = strftime('%m', 'now') GROUP BY category").all();
}

export function getRekapLengkap() {
  const rows = db.prepare("SELECT user, account, SUM(amount) as balance FROM transactions GROUP BY user, account HAVING balance != 0 ORDER BY user ASC, balance DESC").all();
  const totalWealth = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE account != 'cc'").get();
  return { rows, totalWealth: totalWealth.total || 0 };
}

export function getTotalCCHariIni() {
  const res = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE account = 'cc' AND amount < 0 AND date(timestamp) = date('now', 'localtime')").get();
  return res || { total: 0 };
}
