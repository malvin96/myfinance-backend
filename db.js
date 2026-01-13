import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB = path.join(process.cwd(), "data", "myfinance.db");
if (!fs.existsSync(path.dirname(DB))) fs.mkdirSync(path.dirname(DB), { recursive: true });

const open = () => new Database(DB);

export function initDB() {
  const db = open();
  db.exec(`CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY, ts TEXT, user TEXT, account TEXT, amount REAL, category TEXT, note TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS budget(cat TEXT PRIMARY KEY, amount REAL)`);
  db.close();
}

export function addTx(p) {
  const db = open();
  db.prepare(`INSERT INTO ledger VALUES(null, datetime('now','localtime'), ?, ?, ?, ?, ?)`).run(p.user, p.account, p.amount, p.category, p.note);
  db.close();
}

export function getRekapLengkap() {
  const db = open();
  const total = db.prepare(`SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) income, SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) expense, SUM(amount) net FROM ledger`).get();
  const perUser = db.prepare(`SELECT user, SUM(amount) as balance FROM ledger GROUP BY user`).all();
  const perAccount = db.prepare(`SELECT account, SUM(amount) as balance FROM ledger GROUP BY account HAVING balance != 0`).all();
  db.close();
  return { total, perUser, perAccount };
}

export function getAllLedger() {
  const db = open();
  const rows = db.prepare(`SELECT * FROM ledger ORDER BY ts DESC`).all();
  db.close();
  return rows;
}

export function getHistoryByPeriod(period) {
  const db = open();
  let q = `SELECT * FROM ledger WHERE 1=1 `;
  if (period === "hari ini") q += `AND date(ts) = date('now', 'localtime') `;
  else if (period === "minggu ini") q += `AND date(ts) >= date('now', 'localtime', '-7 days') `;
  else if (period === "bulan ini") q += `AND strftime('%m', ts) = strftime('%m', 'now', 'localtime') `;
  const res = db.prepare(q + ` ORDER BY ts DESC LIMIT 15`).all();
  db.close();
  return res;
}

export function searchNotes(query) {
  const db = open();
  const res = db.prepare(`SELECT * FROM ledger WHERE note LIKE ? ORDER BY ts DESC LIMIT 10`).all(`%${query}%`);
  db.close();
  return res;
}

export function getAllBudgetStatus() {
  const db = open();
  const rows = db.prepare(`SELECT b.cat, b.amount as limit_amt, (SELECT SUM(ABS(amount)) FROM ledger WHERE category = b.cat AND amount < 0 AND strftime('%m', ts) = strftime('%m', 'now', 'localtime')) as used FROM budget b`).all();
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
  const row = db.prepare(`SELECT SUM(ABS(amount)) as total FROM ledger WHERE category = ? AND amount < 0 AND strftime('%m', ts) = strftime('%m', 'now', 'localtime')`).get(cat);
  db.close();
  return row ? row.total : 0;
}
