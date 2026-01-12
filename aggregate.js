import { getAllTransactions, getBalances } from "./ledger.js"
 
export function getAggregates(chat_id) {
  const tx = getAllTransactions(chat_id)
  const balances = getBalances(chat_id)
 
  let inM = 0, inY = 0, outM = 0, outY = 0
  let cat = {}
 
  for (const t of tx) {
    if (t.type === "masuk") {
      t.user === "M" ? inM += t.amount : inY += t.amount
    }
    if (t.type === "keluar") {
      t.user === "M" ? outM += t.amount : outY += t.amount
      cat[t.category || "Lainnya"] = (cat[t.category || "Lainnya"] || 0) + t.amount
    }
  }
 
  let top = Object.entries(cat)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5)
    .map(x=>`• ${x[0]}: Rp${x[1].toLocaleString()}`)
    .join("\n")
 
  return `
📊 RINGKASAN KELUARGA
 
👤 M
Masuk: Rp${inM.toLocaleString()}
Keluar: Rp${outM.toLocaleString()}
Net: Rp${(inM - outM).toLocaleString()}
 
👤 Y
Masuk: Rp${inY.toLocaleString()}
Keluar: Rp${outY.toLocaleString()}
Net: Rp${(inY - outY).toLocaleString()}
 
👨‍👩‍👧 Keluarga
Masuk: Rp${(inM+inY).toLocaleString()}
Keluar: Rp${(outM+outY).toLocaleString()}
Net: Rp${(inM+inY-outM-outY).toLocaleString()}
 
📂 Top Pengeluaran
${top}
 
💰 Total Saldo Sekarang
${Object.entries(balances.M).map(x=>`M ${x[0]}: Rp${x[1].toLocaleString()}`).join("\n")}
${Object.entries(balances.Y).map(x=>`Y ${x[0]}: Rp${x[1].toLocaleString()}`).join("\n")}
`
}
