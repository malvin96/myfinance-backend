import { getAllTransactions } from "./ledger.js"
 
export function getAggregates(chat_id) {
  const tx = getAllTransactions(chat_id)
 
  let inM=0, inY=0, outM=0, outY=0
 
  for (const t of tx) {
    if (t.user === "M") {
      t.type === "masuk" ? inM += t.amount : outM += t.amount
    } else {
      t.type === "masuk" ? inY += t.amount : outY += t.amount
    }
  }
 
  const totalIn = inM + inY
  const totalOut = outM + outY
 
  return `
📊 RINGKASAN
 
M: +Rp${inM.toLocaleString()}  -Rp${outM.toLocaleString()}
Y: +Rp${inY.toLocaleString()}  -Rp${outY.toLocaleString()}
 
Total masuk: Rp${totalIn.toLocaleString()}
Total keluar: Rp${totalOut.toLocaleString()}
Net: Rp${(totalIn - totalOut).toLocaleString()}
`
}
