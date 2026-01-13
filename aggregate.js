import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "myfinance.db");

export function getRekapRaw() {
  const db = new Database(DB_PATH);
  const r = db.prepare(`
    SELECT
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) income,
      SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) expense,
      COALESCE(SUM(amount), 0) net
    FROM ledger
  `).get();
  db.close();

  return {
    income: r.income || 0,
    expense: r.expense || 0,
    net: r.net || 0
  };
}
