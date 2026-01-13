import { getHistory } from "./db.js";
export function exportText(){
  return getHistory().map(r =>
    `${r.ts},${r.user},${r.account},${r.amount},${r.note}`
  ).join("\n");
}
