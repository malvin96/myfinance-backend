import Database from "better-sqlite3";
import path from "path";
const DB = path.join(process.cwd(),"data","myfinance.db");

export function getRekapRaw() {
  const db=new Database(DB);
  const r=db.prepare(`
    SELECT
      SUM(CASE WHEN amount>0 THEN amount ELSE 0 END) income,
      SUM(CASE WHEN amount<0 THEN amount ELSE 0 END) expense,
      SUM(amount) net
    FROM ledger`).get();
  db.close();
  return r;
}

export function getRekapByFilter() {
  return getRekapRaw();
}
