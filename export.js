const db = require("./db");
const { getFullRecap, getRecapByUser } = require("./aggregate");

/**
 * Export transactions + recap as CSV string
 */
function exportCSV({ start, end } = {}) {
  // ===== RECAP =====
  const recap = getFullRecap({ start, end });
  const recapByUser = getRecapByUser({ start, end });

  let csv = "";
  csv += "MY FINANCE EXPORT\n";
  if (start || end) {
    csv += `PERIODE,${start || "-"},${end || "-"}\n`;
  }
  csv += "\nREKAP\n";
  csv += `INCOME,${recap.income || 0}\n`;
  csv += `EXPENSE,${recap.expense || 0}\n`;
  csv += `NET,${recap.net || 0}\n\n`;

  csv += "REKAP PER USER\n";
  recapByUser.forEach(r => {
    csv += `${r.user},${r.total}\n`;
  });

  csv += "\nTRANSACTIONS\n";
  csv += "Tanggal,User,Akun,Amount,Kategori,Note,Tags\n";

  // ===== TRANSACTIONS =====
  let sql = "SELECT * FROM ledger WHERE 1=1 ";
  const params = [];

  if (start) {
    sql += "AND timestamp >= ? ";
    params.push(start);
  }
  if (end) {
    sql += "AND timestamp <= ? ";
    params.push(end);
  }

  sql += "ORDER BY timestamp ASC, id ASC";

  const rows = db.prepare(sql).all(...params);

  rows.forEach(tx => {
    csv += `${tx.timestamp},${tx.user},${tx.account},${tx.amount},${tx.category},"${tx.note || ""}","${tx.tags || ""}"\n`;
  });

  return csv;
}

module.exports = { exportCSV };
