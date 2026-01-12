import { addTransaction, getBalances, setBalance, getAllTransactions } from "./ledger.js"
import { exportAll } from "./export.js"
import { getSnapshot } from "./snapshot.js"
import { getAggregates } from "./aggregate.js"
 
function parseAmount(x){
  return parseInt(x.replace(/[.,]/g,""))
}
 
export async function handleMessage(chat_id, text){
  text = text.toLowerCase().trim()
 
  if(!text) return "❌ Empty"
 
  // set saldo
  let m = text.match(/set saldo (m|y) (\w+) ([\d.,]+)/)
  if(m){
    setBalance(chat_id, m[1].toUpperCase(), m[2], parseAmount(m[3]))
    return `✅ saldo ${m[1].toUpperCase()} ${m[2]}`
  }
 
  // saldo
  if(text==="saldo"){
    const b = getBalances(chat_id)
    return JSON.stringify(b,null,2)
  }
 
  // export
  if(text==="export") return exportAll(chat_id)
 
  // snapshot
  if(text==="snapshot") return getSnapshot(chat_id)
 
  // laporan
  if(text==="laporan") return getAggregates(chat_id)
 
  // transfer
  let t = text.match(/(m|y) transfer ([\d.,]+) dari (\w+) ke (\w+)/)
  if(t){
    addTransaction(chat_id,{
      user:t[1].toUpperCase(),
      type:"transfer",
      amount:parseAmount(t[2]),
      from:t[3],
      to:t[4]
    })
    return "🔁 transfer tercatat"
  }
 
  // transaksi
  let tx = text.match(/(m|y) (.+) ([\d.,]+)/)
  if(tx){
    const note = tx[2]
    const type = note.includes("gaji")||note.includes("refund") ? "masuk":"keluar"
    addTransaction(chat_id,{
      user:tx[1].toUpperCase(),
      type,
      amount:parseAmount(tx[3]),
      note
    })
    return "✅ transaksi tercatat"
  }
 
  return "❓ perintah tidak dikenali"
}
 
