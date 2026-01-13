import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(),"data");
const DB = path.join(DIR,"myfinance.db");

export function initDB() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR,{recursive:true});
  const db = new Database(DB);
  db.exec(`CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY, ts TEXT, user TEXT, account TEXT, amount INTEGER, category TEXT, note TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS budget(cat TEXT PRIMARY KEY, amount INTEGER)`);
  db.close();
}

const open = () => new Database(DB);

export function addTx(p) {
  const db = open();
  db.prepare(`INSERT INTO ledger VALUES(null,datetime('now','localtime'),?,?,?,?,?)`)
    .run(p.user, p.account, p.amount, p.category, p.note);
  db.close();
}

export function getSaldo(acc) {
  const db = open();
  const res = (acc === "ALL" || !acc)
    ? db.prepare(`SELECT SUM(amount) as s FROM ledger`).get()
    : db.prepare(`SELECT SUM(amount) as s FROM ledger WHERE account=?`).get(acc);
  db.close();
  return res?.s || 0;
}

export function getHistory() {
  const db = open();
  const rows = db.prepare(`SELECT * FROM ledger ORDER BY ts DESC LIMIT 10`).all();
  db.close();
  return rows;
}

export function setInitialSaldo(p) {
  const db = open();
  db.prepare(`INSERT INTO ledger VALUES(null,datetime('now','localtime'),?,?,?,'Saldo Awal',?)`)
    .run(p.user, p.account, p.amount, p.note);
  db.close();
}

export function getBudgetValue(cat) {
  const db = open();
  const row = db.prepare(`SELECT amount FROM budget WHERE cat = ?`).get(cat);
  db.close();
  return row ? row.amount : null;
}

export function getTotalExpenseMonth(cat) {
  const db = open();
  const row = db.prepare(`SELECT SUM(ABS(amount)) as total FROM ledger WHERE category = ? AND amount < 0 AND strftime('%m', ts) = strftime('%m', 'now')`).get(cat);
  db.close();
  return row ? row.total : 0;
}
