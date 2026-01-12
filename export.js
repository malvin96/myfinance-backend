import { loadDB } from "./db.js"
import { aggregate } from "./aggregate.js"
import { getSnapshots } from "./snapshot.js"

function todayRange() {
  const d = new Date()
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59).toISOString()
  return { start, end }
}

function monthRange() {
  const d = new Date()
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
  const end = new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59).toISOString()
  return { start, end }
}

export function exportAll() {
  const db = loadDB()

  const today = todayRange()
  const month = monthRange()

  return {
    meta: {
      exportedAt: new Date().toISOString(),
      locked: db.locked
    },
    balances: db.users,
    investments: db.investments,
    today: aggregate(today.start, today.end),
    month: aggregate(month.start, month.end),
    snapshots: getSnapshots(),
    ledger: db.ledger
  }
}
