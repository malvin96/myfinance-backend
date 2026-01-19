import Database from "better-sqlite3";
const db = new Database("myfinance.db");

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT, account TEXT, amount REAL, category TEXT, note TEXT,
      timestamp DATETIME DEFAULT (DATETIME('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS budgets (category TEXT PRIMARY KEY, amount REAL);
  `);
}

export function addTx(p) {
  const stmt = db.prepare("INSERT INTO transactions (user, account, amount, category, note) VALUES (?, ?, ?, ?, ?)");
  return stmt.run(p.user, p.account, p.amount, p.category, p.note);
}

// [FITUR] Ambil History Terakhir (Read Only)
export function getLatestTransactions(limit = 10) {
  return db.prepare("SELECT * FROM transactions ORDER BY id DESC LIMIT ?").all(limit);
}

// [FITUR] Ambil Semua Data (Untuk Sync Push & Laporan)
export function getAllTransactions() {
  return db.prepare("SELECT * FROM transactions ORDER BY id ASC").all();
}

// [FITUR] Hapus Transaksi Terakhir (Undo)
export function deleteLastTx(userCode) {
    const stmt = db.prepare("SELECT * FROM transactions WHERE user = ? ORDER BY id DESC LIMIT 1");
    const last = stmt.get(userCode);
    if (last) {
        db.prepare("DELETE FROM transactions WHERE id = ?").run(last.id);
        return last;
    }
    return null;
}

// [FITUR] Rebuild Database (Sync Pull)
// Menghapus total db lokal dan isi ulang dari array data (biasanya dari Sheet)
export function rebuildDatabase(txs) {
  if (!txs || txs.length === 0) return 0;
  
  db.prepare("DELETE FROM transactions").run();
  
  const insert = db.prepare("INSERT INTO transactions (timestamp, user, account, amount, category, note) VALUES (?, ?, ?, ?, ?, ?)");
  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(item.timestamp, item.user, item.account, item.amount, item.category, item.note);
    }
  });

  insertMany(txs);
  return txs.length;
}

// [FITUR] Cek Saldo & Kekayaan
export function getRekapLengkap() {
  const rows = db.prepare("SELECT user, account, SUM(amount) as balance FROM transactions GROUP BY user, account HAVING balance != 0 ORDER BY user ASC, balance DESC").all();
  const totalWealth = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE account != 'cc'").get();
  return { rows, totalWealth: totalWealth.total || 0 };
}

// [FITUR] Warning CC
export function getTotalCCHariIni() {
  return db.prepare("SELECT SUM(amount) as total FROM transactions WHERE account = 'cc' AND amount < 0 AND date(timestamp) = date('now', 'localtime')").get() || { total: 0 };
}

// Dummy functions agar tidak error jika ada file lama yang memanggil
export function getBudgetSummary() { return { income: 0, expense: 0 }; }
export function getCashflowSummary() { return { income: 0, expense: 0 }; }
export function getFilteredTransactions(filter) { return []; }
export function resetAccountBalance() { return; }
