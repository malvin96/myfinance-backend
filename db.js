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
  const stmt = db.prepare("INSERT INTO transactions (user, account, amount, category, note, timestamp) VALUES (?, ?, ?, ?, ?, ?)");
  const ts = p.timestamp || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Makassar' }).replace(' ', ' ');
  return stmt.run(p.user, p.account, p.amount, p.category, p.note, ts);
}

export function rebuildDatabase(txs) {
  if (!txs || txs.length === 0) return 0;
  try {
      console.log("♻️ Menghapus database lama...");
      db.prepare("DELETE FROM transactions").run();
      const insert = db.prepare("INSERT INTO transactions (timestamp, user, account, amount, category, note) VALUES (?, ?, ?, ?, ?, ?)");
      const insertMany = db.transaction((items) => {
        for (const item of items) {
          insert.run(item.timestamp, item.user, item.account, item.amount, item.category, item.note);
        }
      });
      insertMany(txs);
      return txs.length;
  } catch (error) {
      console.error("❌ Gagal Rebuild DB:", error);
      return 0;
  }
}

export function importFromDBFile(filePath) {
    try {
        const tempDb = new Database(filePath, { readonly: true });
        const rows = tempDb.prepare("SELECT * FROM transactions").all();
        tempDb.close(); 
        return rebuildDatabase(rows);
    } catch (error) {
        console.error("❌ Error Import DB:", error);
        return -1; 
    }
}

export function getLatestTransactions(limit = 10) {
  return db.prepare("SELECT * FROM transactions ORDER BY id DESC LIMIT ?").all(limit);
}

// [FITUR BARU] Cari Transaksi
export function searchTransactions(keyword, limit = 10) {
    const term = `%${keyword}%`;
    return db.prepare(`
        SELECT * FROM transactions 
        WHERE note LIKE ? OR category LIKE ? OR account LIKE ?
        ORDER BY timestamp DESC LIMIT ?
    `).all(term, term, term, limit);
}

// [FITUR BARU] Rekap Harian (Ambil data hari ini)
export function getDailyTransactions() {
    // Menggunakan 'now' dengan modifier 'localtime' (sesuai settingan server/WITA di initDB)
    // Atau kita tarik semua data yang tanggalnya cocok dengan hari ini di WITA
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' }); // Format YYYY-MM-DD
    return db.prepare("SELECT * FROM transactions WHERE date(timestamp) = ? ORDER BY timestamp ASC").all(today);
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
  const todayWITA = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
  return db.prepare("SELECT SUM(amount) as total FROM transactions WHERE account = 'cc' AND amount < 0 AND date(timestamp) = ?").get(todayWITA) || { total: 0 };
}
