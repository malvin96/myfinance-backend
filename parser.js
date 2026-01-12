import { addTransaction, setBalance, getBalances } from "./ledger.js"
import { exportAll } from "./export.js"
import { createSnapshot } from "./snapshot.js"
import { getAggregates } from "./aggregate.js"
 
function parseAmount(x) {
  return parseInt(x.replace(/[.,]/g, ""))
}
 
export async function handleMessage(chat_id, text) {
  if (!text) return "❌ Pesan kosong"
  text = text.toLowerCase().trim()
 
  // =============================
  // SET SALDO
  // =============================
  let m = text.match(/set saldo (m|y)\s+(\w+)\s+([\d.,]+)/)
  if (m) {
    setBalance(chat_id, m[1].toUpperCase(), m[2], parseAmount(m[3]))
    return `✅ Saldo ${m[1].toUpperCase()} ${m[2]} diset`
  }
 
  // =============================
  // SALDO
  // =============================
  if (text === "saldo") {
    const b = getBalances(chat_id)
    return JSON.stringify(b, null, 2)
  }
 
  // =============================
  // EXPORT
  // =============================
  if (text === "export") return exportAll(chat_id)
 
  // =============================
  // SNAPSHOT
  // =============================
  if (text.startsWith("snapshot")) {
    const label = text.replace("snapshot", "").trim()
    const s = createSnapshot(chat_id, label)
    return `📸 Snapshot tersimpan (${s.time})`
  }
 
  // =============================
  // LAPORAN
  // =============================
  if (text === "laporan" || text === "rekap") return getAggregates(chat_id)
 
  // =============================
  // TRANSFER
  // =============================
  let t = text.match(/(m|y)\s+transfer\s+([\d.,]+)\s+dari\s+(\w+)\s+ke\s+(\w+)/)
  if (t) {
    addTransaction(chat_id, {
      user: t[1].toUpperCase(),
      type: "transfer",
      amount: parseAmount(t[2]),
      from: t[3],
      to: t[4]
    })
    return "🔁 Transfer tercatat"
  }
 
  // =============================
  // TRANSAKSI
  // =============================
  let tx = text.match(/(m|y)\s+(.+)\s+([\d.,]+)/)
  if (tx) {
    const note = tx[2]
    const amount = parseAmount(tx[3])
    const type = (
      note.includes("gaji") ||
      note.includes("bonus") ||
      note.includes("refund") ||
      note.includes("cashback")
    ) ? "masuk" : "keluar"
 
    addTransaction(chat_id, {
      user: tx[1].toUpperCase(),
      type,
      amount,
      note
    })
 
    const icon = type === "masuk" ? "➕" : "➖"
    return `${icon} ${tx[1].toUpperCase()} ${type} Rp${amount.toLocaleString()}`
  }
 
  return "❓ Perintah tidak dikenali"
}
