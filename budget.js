import Database from "better-sqlite3";
import path from "path";
const DB = path.join(process.cwd(),"data","myfinance.db");

export function setBudget(cat,amt){
  const db=new Database(DB);
  db.exec(`CREATE TABLE IF NOT EXISTS budget(cat TEXT, amount INTEGER)`);
  db.prepare(`DELETE FROM budget WHERE cat=?`).run(cat);
  db.prepare(`INSERT INTO budget VALUES(?,?)`).run(cat,amt);
  db.close();
}

export function getBudgetStatus(fmt){
  const db=new Database(DB);
  const rows=db.prepare(`SELECT * FROM budget`).all();
  let out="🎯 BUDGET\n";
  for(const r of rows){
    out+=`${r.cat}: ${fmt(r.amount)}\n`;
  }
  db.close();
  return out;
}
