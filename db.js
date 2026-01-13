import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "myfinance.db");

export function initDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      user TEXT NOT NULL,
      account TEXT NOT NULL,
      amount INTEGER NOT NULL,
      category TEXT NOT NULL,
      note TEXT
    )
  `);
  db.close();
}

function open() {
  return new Database(DB_PATH);
}

export function addTx(p) {
  const db = open();
  db.prepare(`
    INSERT INTO ledger (ts, user, account, amount, category, note)
    VALUES (datetime('now'), ?, ?, ?, ?, ?)
  `).run(p.user, p.account, p.amount, p.category, p.note || "");
  db.close();
}

export function getSaldo(account, raw=false) {
  const db = open();
  let row;
  if (account === "ALL") {
    row = db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM ledger`).get();
    db.close();
    return `SALDO TOTAL: ${row.s}`;
  }
  row = db.prepare(`
    SELECT COALESCE(SUM(amount),0) s FROM ledger WHERE account=?
  `).get(account);
  db.close();
  return raw ? row.s : `SALDO ${account.toUpperCase()}: ${row.s}`;
}

export function getRekap() {
  const db = open();
  const r = db.prepare(`
    SELECT
      SUM(CASE WHEN amount>0 THEN amount ELSE 0 END) income,
      SUM(CASE WHEN amount<0 THEN amount ELSE 0 END) expense,
      COALESCE(SUM(amount),0) net
    FROM ledger
  `).get();
  db.close();
  return `REKAP
INCOME: ${r.income || 0}
EXPENSE: ${r.expense || 0}
NET: ${r.net || 0}`;
}
