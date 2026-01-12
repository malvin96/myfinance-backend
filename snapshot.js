import { loadDB, saveDB } from "./db.js"

/*
 Snapshot = keadaan saldo & investasi pada suatu waktu.
 Tidak mempengaruhi ledger.
*/

function now() {
  return new Date().toISOString()
}

export function createSnapshot(label = "manual") {
  const db = loadDB()

  const snap = {
    id: (db.snapshots?.length || 0) + 1,
    t: now(),
    label,
    users: JSON.parse(JSON.stringify(db.users)),
    investments: JSON.parse(JSON.stringify(db.investments))
  }

  if (!db.snapshots) db.snapshots = []
  db.snapshots.push(snap)

  saveDB(db)
  return `📸 Snapshot ${snap.id} dibuat (${label})`
}

export function getSnapshots() {
  const db = loadDB()
  return db.snapshots || []
}
