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

// [FITUR] Rebuild Database (Dipakai Sync & Restore DB)
export function rebuildDatabase(txs) {
  if (!txs || txs.length === 0) return 0;
  
  try {
      console.log("♻️ Menghapus database lama...");
      db.prepare("DELETE FROM transactions").run();
      
      console.log(`📥 Menyisipkan ${txs.length} data baru...`);
      const insert = db.prepare("INSERT INTO transactions (timestamp, user, account, amount, category, note) VALUES (?, ?, ?, ?, ?, ?)");
      
      const insertMany = db.transaction((items) => {
        for (const item of items) {
          insert.run(item.timestamp, item.user, item.account, item.amount, item.category, item.note);
        }
      });

      insertMany(txs);
      console.log("✅ Rebuild Database Selesai.");
      return txs.length;
  } catch (error) {
      console.error("❌ Gagal Rebuild DB:", error);
      return 0;
  }
}

// [FITUR BARU] Import Data dari File .db Eksternal
export function importFromDBFile(tempDbPath) {
    try {
        const tempDb = new Database(tempDbPath, { readonly: true });
        // Ambil semua data dari DB yang diupload
        const rows = tempDb.prepare("SELECT * FROM transactions").all();
        tempDb.close(); // Tutup koneksi DB temp

        // Masukkan ke DB Utama menggunakan fungsi yang sudah ada
        return rebuildDatabase(rows);
    } catch (error) {
        console.error("❌ Error Import DB:", error);
        return -1; // Kode error
    }
}

export function getLatestTransactions(limit = 10) {
  return db.prepare("SELECT * FROM transactions ORDER BY id DESC LIMIT ?").all(limit);
}

export function getAllTransactions() {
  return db.prepare("SELECT * FROM transactions ORDER BY id ASC").all();
}

export function deleteLastTx(userCode) {
    const stmt = db.prepare("SELECT * FROM transactions WHERE user = ? ORDER BY id DESC LIMIT 1");
    const last = stmt.get(userCode);
    if (last) {
        db.prepare("DELETE FROM transactions WHERE id = ?").run(last.id);
        return last;
    }
    return null;
}

export function getRekapLengkap() {
  const rows = db.prepare("SELECT user, account, SUM(amount) as balance FROM transactions GROUP BY user, account HAVING balance != 0 ORDER BY user ASC, balance DESC").all();
  const totalWealth = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE account != 'cc'").get();
  return { rows, totalWealth: totalWealth.total || 0 };
}

export function getTotalCCHariIni() {
  return db.prepare("SELECT SUM(amount) as total FROM transactions WHERE account = 'cc' AND amount < 0 AND date(timestamp) = date('now', 'localtime')").get() || { total: 0 };
}
