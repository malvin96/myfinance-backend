import { addTransaction, getBalances, setBalance } from "./ledger.js"
import { exportLedger } from "./export.js"
import { getSnapshot } from "./snapshot.js"
import { getAggregates } from "./aggregate.js"
import { detectCategory } from "./categories.js"

function parseAmount(str) {
  return parseInt(str.replace(/[.,]/g, ""))
}

export async function handleMessage(chat_id, text) {
  if (!text) return "❌ Pesan kosong"

  text = text.toLowerCase().trim()

  // =============================
  // SET SALDO
  // =============================
  let m = text.match(/set saldo (m|y)\s+([a-z0-9]+)\s+([\d.,]+)/i)
  if (m) {
    const user = m[1].toUpperCase()
    const acc = m[2]
    const amt = parseAmount(m[3])
    setBalance(chat_id, user, acc, amt)
    return `✅ Saldo ${user} ${acc} = Rp${amt.toLocaleString("id-ID")}`
  }

  // =============================
  // SALDO
  // =============================
  if (text === "saldo" || text === "cek saldo") {
    const data = getBalances(chat_id)
    let out = "📊 SALDO\n\n"
    let total = 0

    for (const u of ["M", "Y"]) {
      let ut = 0
      out += `👤 ${u}\n`
      if (data[u]) {
        for (const acc in data[u]) {
          out += `• ${acc}: Rp${data[u][acc].toLocaleString("id-ID")}\n`
          ut += data[u][acc]
        }
      }
      out += `TOTAL ${u}: Rp${ut.toLocaleString("id-ID")}\n\n`
      total += ut
    }

    out += `💰 TOTAL KELUARGA: Rp${total.toLocaleString("id-ID")}`
    return out
  }

  // =============================
  // SNAPSHOT
  // =============================
  if (text === "snapshot") {
    return getSnapshot(chat_id)
  }

  // =============================
  // EXPORT
  // =============================
  if (text === "export") {
    return exportLedger(chat_id)
  }

  // =============================
  // LAPORAN
  // =============================
  if (text === "laporan" || text === "rekap") {
    return getAggregates(chat_id)
  }

  // =============================
  // TRANSFER
  // =============================
  let t = text.match(/(m|y)\s+transfer\s+([\d.,]+)\s+dari\s+(\w+)\s+ke\s+(\w+)/i)
  if (t) {
    const user = t[1].toUpperCase()
    const amt = parseAmount(t[2])
    const from = t[3]
    const to = t[4]

    addTransaction(chat_id, {
      user,
      type: "transfer",
      amount: amt,
      from,
      to,
      category: "Transfer"
    })

    return `🔁 ${user} transfer Rp${amt.toLocaleString("id-ID")} dari ${from} ke ${to}`
  }

  // =============================
  // TRANSAKSI MASUK / KELUAR
  // =============================
  let tx = text.match(/(m|y)\s+(.+)\s+([\d.,]+)/i)
  if (tx) {
    const user = tx[1].toUpperCase()
    const note = tx[2]
    const amt = parseAmount(tx[3])
    const cat = detectCategory(note)

    const type = (
      note.includes("gaji") ||
      note.includes("refund") ||
      note.includes("bonus") ||
      note.includes("cashback")
    ) ? "masuk" : "keluar"

    addTransaction(chat_id, {
      user,
      type,
      amount: amt,
      note,
      category: cat
    })

    const icon = type === "masuk" ? "➕" : "➖"
    return `${icon} ${user} ${type} Rp${amt.toLocaleString("id-ID")} (${cat})`
  }

  return "❓ Perintah tidak dikenali"
}
