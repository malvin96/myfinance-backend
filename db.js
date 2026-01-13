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

export function getRekapLengkap() {
  const startOfMonth = "date('now', 'start of month')";
  const perAccount = db.prepare("SELECT account, SUM(amount) as balance FROM transactions GROUP BY account").all();
  
  // Hitung Net Sisa TANPA melibatkan akun 'cc' agar saldo bank tetap utuh sebelum lunas
  const total = db.prepare(`
    SELECT 
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense,
      SUM(CASE WHEN account != 'cc' THEN amount ELSE 0 END) as net_real
    FROM transactions 
    WHERE date(timestamp) >= ${startOfMonth}
  `).get();
  
  return { perAccount, total };
}

export function getTotalCCHariIni() {
  return db.prepare("SELECT SUM(amount) as total FROM transactions WHERE account = 'cc' AND amount < 0 AND date(timestamp) = date('now', 'localtime')").get();
}

export function addReminder(note, dueDate) {
  return db.prepare("INSERT INTO reminders (note, due_date) VALUES (?, ?)").run(note, dueDate);
}

export function getReminders() {
  return db.prepare("SELECT * FROM reminders ORDER BY due_date ASC").all();
}
