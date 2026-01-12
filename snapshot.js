import { getBalances } from "./ledger.js"
 
export function getSnapshot(chat_id) {
  const balances = getBalances(chat_id)
  return JSON.stringify({
    date: new Date().toISOString(),
    balances
  }, null, 2)
}
