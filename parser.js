import { addTransaction, getSummary, getHistory, getBalances } from "./ledger.js"

const accounts = ["cash","bca","ovo","shopee","cc","investasi"]
const incomeWords = ["gaji","masuk","terima","bonus","refund"]

export function handle(text){
  text = text.toLowerCase()

  if(text.startsWith("rekap")){
    const s = getSummary()
    const b = getBalances()
    return { reply: formatSummary(s,b) }
  }

  if(text.startsWith("history")){
    return { reply: JSON.stringify(getHistory(),null,2) }
  }

  const num = text.match(/\d+/)
  if(!num) return { reply:"❌ Tidak ada angka transaksi" }

  const amount = parseInt(num[0])
  let user = text.includes(" y ") ? "Y" : "M"

  let account = accounts.find(a=>text.includes(a)) || "cash"
  let type = incomeWords.some(w=>text.includes(w)) ? "income" : "expense"

  const note = text.replace(num[0],"").trim()

  addTransaction({
    user,account,
    category:"general",
    note,
    amount,
    type
  })

  return { reply:`✅ ${user} ${type} ${amount} via ${account}` }
}

function formatSummary(s,b){
  let out = "📊 RINGKASAN\n"
  for(const r of s) out+=`${r.user}: ${r.total}\n`
  out+="\n💰 Saldo\n"
  for(const x of b) out+=`${x.user}-${x.account}: ${x.balance}\n`
  return out
}
