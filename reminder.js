import Database from "better-sqlite3";
import path from "path";
const DB = path.join(process.cwd(),"data","myfinance.db");

export function addReminder(p){
  const db=new Database(DB);
  db.exec(`CREATE TABLE IF NOT EXISTS reminders(text TEXT)`);
  db.prepare(`INSERT INTO reminders VALUES(?)`).run(p.raw);
  db.close();
}
