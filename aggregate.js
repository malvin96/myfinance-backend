import { loadDB } from "./db.js"

/*
 Aggregate engine:
 membaca ledger
 mengelompokkan data
 menghitung statistik
*/

function inPeriod(date, start, end) {
  return date >= start && date <= end
}

function sum(arr, key) {
  return arr.reduce((a, b) => a + (b[key] || 0), 0)
}

export function aggregate(start, end) {
  const db = loadDB()
  const startD = new Date(start)
  const endD = new Date(end)

  const tx = db.ledger.filter(l => {
    if (!l.t || !l.amount) return false
    const d = new Date(l.t)
    return inPeriod(d, startD, endD) && ["IN","OUT"].includes(l.type)
  })

  const income = tx.filter(t => t.type === "IN")
  const expense = tx.filter(t => t.type === "OUT")

  const byUser = { M:{in:0,out:0}, Y:{in:0,out:0} }
  const byCategory = {}
  const byNeed = { Kebutuhan:0, Keinginan:0, Netral:0 }

  for (const t of tx) {
    if (t.type === "IN") byUser[t.user].in += t.amount
    if (t.type === "OUT") byUser[t.user].out += t.amount

    if (t.type === "OUT") {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
      byNeed[t.needType] = (byNeed[t.needType] || 0) + t.amount
    }
  }

  return {
    period: { start, end },
    income: sum(income,"amount"),
    expense: sum(expense,"amount"),
    net: sum(income,"amount") - sum(expense,"amount"),
    users: byUser,
    categories: byCategory,
    needs: byNeed
  }
}
