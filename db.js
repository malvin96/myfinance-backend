import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data");
const DB = path.join(DIR, "myfinance.db");

export function initDB() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  const db = new Database(DB);
  db.exec(`CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY, ts TEXT, user TEXT, account TEXT, amount INTEGER, category TEXT, note TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS budget(cat TEXT PRIMARY KEY, amount INTEGER)`);
  db.close();
}

const open = () => new Database(DB);

export function addTx(p) {
  const db = open();
  db.prepare(`INSERT INTO ledger VALUES(null, datetime('now','localtime'), ?, ?, ?, ?, ?)`).run(p.user, p.account, p.amount, p.category, p.note);
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

export function getRekapLengkap() {
  const db = open();
  const total = db.prepare(`SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) income, SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) expense, SUM(amount) net FROM ledger`).get();
  const perUser = db.prepare(`SELECT user, SUM(amount) as balance FROM ledger GROUP BY user`).all();
  const perAccount = db.prepare(`SELECT account, SUM(amount) as balance FROM ledger GROUP BY account HAVING balance != 0`).all();
  db.close();
  return { total, perUser, perAccount };
}

export function getHistoryByPeriod(period) {
  const db = open();
  let query = `SELECT * FROM ledger WHERE 1=1 `;
  if (period === "hari ini") query += `AND date(ts) = date('now', 'localtime') `;
  else if (period === "minggu ini") query += `AND date(ts) >= date('now', 'localtime', '-7 days') `;
  else if (period === "bulan ini") query += `AND strftime('%m', ts) = strftime('%m', 'now', 'localtime') `;
  
  const rows = db.prepare(query + ` ORDER BY ts DESC LIMIT 20`).all();
  db.close();
  return rows;
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
