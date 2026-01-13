import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(),"data");
const DB = path.join(DIR,"myfinance.db");

export function initDB() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR,{recursive:true});
  const db = new Database(DB);
  db.exec(`
    CREATE TABLE IF NOT EXISTS ledger(
      id INTEGER PRIMARY KEY,
      ts TEXT,
      user TEXT,
      account TEXT,
      amount INTEGER,
      category TEXT,
      note TEXT
    )
  `);
  db.close();
}

const open = () => new Database(DB);

export function addTx(p) {
  const db = open();
  db.prepare(`INSERT INTO ledger VALUES(null,datetime('now'),?,?,?,?,?)`)
    .run(p.user,p.account,p.amount,p.category,p.note);
  db.close();
}

export function getSaldo(acc, raw=false) {
  const db=open();
  const q = (acc==="ALL" || !acc)
    ? `SELECT SUM(amount) s FROM ledger`
    : `SELECT SUM(amount) s FROM ledger WHERE account=?`;
  const r = (acc==="ALL" || !acc) ? db.prepare(q).get() : db.prepare(q).get(acc);
  db.close();
  return raw ? (r?.s||0) : (r?.s||0);
}

export function getHistory() {
  const db=open();
  const rows = db.prepare(`SELECT * FROM ledger ORDER BY ts DESC`).all();
  db.close();
  return rows;
}

export function getLastTx(acc) {
  const db=open();
  const r = acc
    ? db.prepare(`SELECT * FROM ledger WHERE account=? ORDER BY ts DESC LIMIT 1`).get(acc)
    : db.prepare(`SELECT * FROM ledger ORDER BY ts DESC LIMIT 1`).get();
  db.close();
  return r;
}

export function addCorrection(last, newAmt) {
  const diff = newAmt - Math.abs(last.amount);
  addTx({
    user: last.user,
    account: last.account,
    amount: last.amount < 0 ? -diff : diff,
    category: "Koreksi",
    note: `Koreksi dari ${last.amount}`
  });
}
