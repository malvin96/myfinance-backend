import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "myfinance.db");

export function getAllLedger() {
  const db = new Database(DB_PATH);
  const rows = db.prepare(`SELECT * FROM ledger ORDER BY ts DESC`).all();
  db.close();
  return rows;
}
