import { getAllTransactions, getBalances } from "./ledger.js"
 
export function exportAll(chat_id) {
  const tx = getAllTransactions(chat_id)
  const balances = getBalances(chat_id)
 
  return JSON.stringify({
    generated: new Date().toISOString(),
    balances,
    transactions: tx
  }, null, 2)
}
