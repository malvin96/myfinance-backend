import { loadDB, saveDB } from "./db.js"
import { getBalances } from "./ledger.js"
 
export function createSnapshot(chat_id, label = "") {
  const db = loadDB()
 
  if (!db.snapshots) db.snapshots = {}
 
  if (!db.snapshots[chat_id]) db.snapshots[chat_id] = []
 
  const snap = {
    time: new Date().toISOString(),
    label,
    balances: getBalances(chat_id)
  }
 
  db.snapshots[chat_id].push(snap)
  saveDB(db)
 
  return snap
}
 
export function getSnapshots(chat_id) {
  const db = loadDB()
  return db.snapshots?.[chat_id] || []
}
