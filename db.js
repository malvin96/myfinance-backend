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
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note TEXT,
      due_date INTEGER
    );
  `);
}

export function addTx(p) {
  const stmt = db.prepare("INSERT INTO transactions (user, account, amount, category, note) VALUES (?, ?, ?, ?, ?)");
  return stmt.run(p.user, p.account, p.amount, p.category, p.note);
}

// Fitur Baru: Reset saldo akun agar tidak double
export function resetAccountBalance(user, account) {
  const stmt = db.prepare("DELETE FROM transactions WHERE user = ? AND account = ?");
  return stmt.run(user, account);
}

export function deleteLastTx(user) {
  const last = db.prepare("SELECT id, note, amount FROM transactions WHERE user = ? ORDER BY id DESC LIMIT 1").get(user);
  if (last) {
    db.prepare("DELETE FROM transactions WHERE id = ?").run(last.id);
    return last;
  }
  return null;
}

export function getRekapLengkap() {
  const rows = db.prepare(`
    SELECT user, account, SUM(amount) as balance 
    FROM transactions 
    GROUP BY user, account 
    HAVING balance != 0
    ORDER BY user ASC, balance DESC
  `).all();

  const totalWealth = db.prepare(`
    SELECT SUM(amount) as total 
    FROM transactions 
    WHERE account != 'cc'
  `).get();

  return { rows, totalWealth: totalWealth.total || 0 };
}

export function getTotalCCHariIni() {
  const row = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE account = 'cc' AND amount < 0 AND date(timestamp) = date('now', 'localtime')").get();
  return row || { total: 0 };
}

export function addReminder(note, dueDate) {
  return db.prepare("INSERT INTO reminders (note, due_date) VALUES (?, ?)").run(note, dueDate);
}

export function getReminders() {
  return db.prepare("SELECT * FROM reminders ORDER BY due_date ASC").all();
}
