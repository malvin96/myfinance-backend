import { loadDB, saveDB } from "./db.js"
 
function ensureChat(db, chat_id){
  if(!db[chat_id]){
    db[chat_id] = {
      balances: { M:{}, Y:{} },
      transactions: []
    }
  }
  return db[chat_id]
}
 
// =============================
// SALDO
// =============================
export function setBalance(chat_id, user, account, amount){
  const db = loadDB()
  const c = ensureChat(db, chat_id)
  c.balances[user][account] = amount
  saveDB(db)
}
 
export function getBalances(chat_id){
  const db = loadDB()
  const c = ensureChat(db, chat_id)
  return c.balances
}
 
// =============================
// TRANSAKSI
// =============================
export function addTransaction(chat_id, tx){
  const db = loadDB()
  const c = ensureChat(db, chat_id)
 
  tx.id = Date.now()
  tx.time = new Date().toISOString()
 
  c.transactions.push(tx)
 
  // apply to balances
  if(tx.type === "masuk"){
    c.balances[tx.user][tx.account || "cash"] =
      (c.balances[tx.user][tx.account || "cash"] || 0) + tx.amount
  }
  else if(tx.type === "keluar"){
    c.balances[tx.user][tx.account || "cash"] =
      (c.balances[tx.user][tx.account || "cash"] || 0) - tx.amount
  }
  else if(tx.type === "transfer"){
    c.balances[tx.user][tx.from] -= tx.amount
    c.balances[tx.user][tx.to] = (c.balances[tx.user][tx.to]||0) + tx.amount
  }
 
  saveDB(db)
}
 
// =============================
// LEDGER
// =============================
export function getAllTransactions(chat_id){
  const db = loadDB()
  const c = ensureChat(db, chat_id)
  return c.transactions
}
