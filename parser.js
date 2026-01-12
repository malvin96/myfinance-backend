import { addTransaction, getBalances, setBalance, closePeriod } from "./ledger.js"
import { exportLedger } from "./export.js"
import { getSnapshot } from "./snapshot.js"
import { getAggregates } from "./aggregate.js"
import { detectCategory } from "./categories.js"
 
export async function handleMessage(chat_id, text) {
  text = text.toLowerCase().trim()
 
  if (!text) return "❌ Pesan kosong"
 
  // ================================
  // SET SALDO
  // ================================
  let m = text.match(/set saldo (m|y)\s+([a-z0-9]+)\s+([\d.,]+)/i)
  if (m) {
    const user = m[1].toUpperCase()
    const account = m[2]
    const amount = parseInt(m[3].replace(/[.,]/g, ""))
    setBalance(chat_id, user, account, amount)
    return `✅ Saldo ${user} ${account} = Rp${amount.toLocaleString("id-ID")}`
  }
 
  // ================================
  // CLOSING
  // ================================
  if (text === "closing" || text === "tutup") {
    closePeriod(chat_id)
    return "🔒 Closing selesai. Neraca dikunci."
  }
 
  // ================================
  // SALDO
  // ================================
  if (text === "saldo" || text === "cek saldo") {
    const data = getBalances(chat_id)
    let out = "📊 SALDO KELUARGA\n\n"
    let total = 0
 
    for (const u of ["M", "Y"]) {
      let userTotal = 0
      out += `👤 ${u}\n`
      for (const acc in data[u] || {}) {
        out += `• ${acc}: Rp${data[u][acc].toLocaleString("id-ID")}\n`
        userTotal += data[u][acc]
      }
      out += `TOTAL ${u}: Rp${userTotal.toLocaleString("id-ID")}\n\n`
      total += userTotal
    }
 
    out += `💰 TOTAL KELUARGA: Rp${total.toLocaleString("id-ID")}`
    return out
  }
 
  // ================================
  // EXPORT
  // ================================
  if (text === "export") {
    return exportLedger(chat_id)
  }
 
  // ================================
  // SNAPSHOT
  // ================================
  if (text === "snapshot") {
    return getSnapshot(chat_id)
  }
 
  // ================================
  // LAPORAN / REKAP
  // ================================
  if (text === "laporan" || text === "rekap") {
    return getAggregates(chat_id)
  }
 
  // ================================
  // TRANSFER
  // ================================
  let t = text.match(/(m|y)\s+transfer\s+([\d.,]+)\s+dari\s+(\w+)\s+ke\s+(\w+)/i)
  if (t) {
    const user = t[1].toUpperCase()
    const amount = parseInt(t[2].replace(/[.,]/g, ""))
    const from = t[3]
    const to = t[4]
 
    addTransaction(chat_id, {
      user,
      type: "transfer",
      amount,
      from,
      to,
      category: "Transfer"
    })
 
    return `🔁 ${user} transfer Rp${amount.toLocaleString("id-ID")} dari ${from} ke ${to}`
  }
 
  // ================================
  // TRANSAKSI MASUK / KELUAR
  // ================================
  let tx = text.match(/(m|y)\s+(masuk|keluar)\s+([\d.,]+)\s*(.*)/i)
  if (tx) {
    const user = tx[1].toUpperCase()
    const type = tx[2]
    const amount = parseInt(tx[3].replace(/[.,]/g, ""))
    const note = tx[4] || ""
    const category = detectCategory(note)
 
    addTransaction(chat_id, {
      user,
      type,
      amount,
      note,
      category
    })
 
    const icon = type === "masuk" ? "➕" : "➖"
    return `${icon} ${user} ${type} Rp${amount.toLocaleString("id-ID")} (${category})`
  }
 
  return "❓ Perintah tidak dikenali"
}
