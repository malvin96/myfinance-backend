import { getBalances, getAllTransactions } from "./ledger.js"
 
export function exportAll(chat_id) {
  const balances = getBalances(chat_id)
  const transactions = getAllTransactions(chat_id)
 
  const now = new Date().toISOString()
 
  // summary
  let inM = 0, inY = 0, outM = 0, outY = 0
 
  for (const t of transactions) {
    if (t.type === "masuk") {
      if (t.user === "M") inM += t.amount
      else inY += t.amount
    }
    if (t.type === "keluar") {
      if (t.user === "M") outM += t.amount
      else outY += t.amount
    }
  }
 
  return JSON.stringify({
    meta: {
      generated: now,
      version: "MY_FINANCE_LEDGER_v1"
    },
    balances,
    summary: {
      M: { in: inM, out: outM, net: inM - outM },
      Y: { in: inY, out: outY, net: inY - outY },
      family: {
        in: inM + inY,
        out: outM + outY,
        net: inM + inY - outM - outY
      }
    },
    transactions
  }, null, 2)
}
