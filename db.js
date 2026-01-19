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

// [BARU] Ambil X Transaksi Terakhir (Read Only)
export function getLatestTransactions(limit = 10) {
  return db.prepare("SELECT * FROM transactions ORDER BY id DESC LIMIT ?").all(limit);
}

// [BARU] Ambil Semua Transaksi (Untuk Sync ke Sheet)
export function getAllTransactions() {
  return db.prepare("SELECT * FROM transactions ORDER BY id ASC").all();
}

// [FITUR UTAMA] REBUILD DATABASE (AUTO-SYNC / PULL)
// Menghapus database lokal dan mengisinya ulang dengan data dari Cloud (Sheet)
export function rebuildDatabase(txs) {
  if (!txs || txs.length === 0) return 0;
  
  // 1. Reset tabel transaksi (Wipe memory)
  db.prepare("DELETE FROM transactions").run();
  
  // 2. Siapkan query insert
  const insert = db.prepare("INSERT INTO transactions (timestamp, user, account, amount, category, note) VALUES (?, ?, ?, ?, ?, ?)");
  
  // 3. Jalankan transaksi database (Bulk Insert)
  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(item.timestamp, item.user, item.account, item.amount, item.category, item.note);
    }
  });

  insertMany(txs);
  return txs.length;
}

export function getBudgetSummary() {
  const income = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE category = 'Pendapatan' AND strftime('%m-%Y', timestamp) = strftime('%m-%Y', 'now')").get();
  const expense = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE category != 'Pendapatan' AND amount < 0 AND strftime('%m-%Y', timestamp) = strftime('%m-%Y', 'now')").get();
  return { income: income.total || 0, expense: Math.abs(expense.total || 0) };
}

export function getRekapLengkap() {
  const rows = db.prepare("SELECT user, account, SUM(amount) as balance FROM transactions GROUP BY user, account HAVING balance != 0 ORDER BY user ASC, balance DESC").all();
  const totalWealth = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE account != 'cc'").get();
  return { rows, totalWealth: totalWealth.total || 0 };
}

export function getTotalCCHariIni() {
  return db.prepare("SELECT SUM(amount) as total FROM transactions WHERE account = 'cc' AND amount < 0 AND date(timestamp) = date('now', 'localtime')").get() || { total: 0 };
}

export function deleteLastTx(userCode) {
    // Cari transaksi terakhir berdasarkan user (M/Y) agar tidak salah hapus punya orang lain
    const stmt = db.prepare("SELECT * FROM transactions WHERE user = ? ORDER BY id DESC LIMIT 1");
    const last = stmt.get(userCode);
    
    if (last) {
        db.prepare("DELETE FROM transactions WHERE id = ?").run(last.id);
        return last;
    }
    return null;
}

export function getCashflowSummary() {
    // 30 Hari Terakhir
    const income = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE category = 'Pendapatan' AND timestamp >= date('now', '-30 days')").get();
    const expense = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE category != 'Pendapatan' AND amount < 0 AND timestamp >= date('now', '-30 days')").get();
    return { income: income.total || 0, expense: Math.abs(expense.total || 0) };
}

// Fungsi dummy agar tidak error jika dipanggil index lama, 
// tapi kita sudah pakai logic baru di index.js
export function getFilteredTransactions(filter) { return []; } 
export function resetAccountBalance() { return; }
