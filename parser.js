import { addTransaction, setBalance, getBalances } from "./ledger.js"
import { exportAll } from "./export.js"
import { createSnapshot } from "./snapshot.js"
import { getAggregates } from "./aggregate.js"

// Helper: Format Rupiah (Biar outputnya Rp 1.000.000, bukan 1000000)
const fmt = (n) => "Rp " + parseInt(n).toLocaleString("id-ID")

function parseAmount(x) {
  return parseInt(x.replace(/[.,]/g, ""))
}

export async function handleMessage(chat_id, text) {
  if (!text) return "❌ Pesan kosong"
  text = text.toLowerCase().trim()

  // =============================
  // SET SALDO (UI RAPI)
  // =============================
  let m = text.match(/set saldo (m|y)\s+(\w+)\s+([\d.,]+)/)
  if (m) {
    const user = m[1].toUpperCase()
    const acc = m[2].toUpperCase()
    const amount = parseAmount(m[3])
    
    setBalance(chat_id, user, acc, amount)
    
    return `💾 *SALDO DI-UPDATE*\n──────────────────\n👤 User : **${user}**\n🏦 Akun : **${acc}**\n💰 Total : **${fmt(amount)}**\n──────────────────`
  }

  // =============================
  // SALDO (DARI JSON -> LIST RAPI)
  // =============================
  if (text === "saldo") {
    const b = getBalances(chat_id)
    
    // Kalau kosong/error
    if (!b || Object.keys(b).length === 0) return "⚠️ *Belum ada data saldo.*"

    let output = "📊 *STATUS KEUANGAN*\n"
    let grandTotal = 0

    // Loop User (M/Y)
    for (let user in b) {
      output += `\n👤 **${user.toUpperCase()}**`
      let subtotal = 0
      
      // Loop Akun
      for (let acc in b[user]) {
        const val = b[user][acc]
        subtotal += val
        output += `\n   ├ ${acc}: ${fmt(val)}`
      }
      output += `\n   └ *Sub: ${fmt(subtotal)}*\n`
      grandTotal += subtotal
    }

    output += `\n══════════════════\n💵 **TOTAL ASET: ${fmt(grandTotal)}**`
    return output
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
    return `📸 *SNAPSHOT TERSIMPAN*\n🏷️ Label: ${label || "-"}\n⏰ Waktu: ${s.time}`
  }

  // =============================
  // LAPORAN
  // =============================
  if (text === "laporan" || text === "rekap") return getAggregates(chat_id)

  // =============================
  // TRANSFER (UI STRUK)
  // =============================
  let t = text.match(/(m|y)\s+transfer\s+([\d.,]+)\s+dari\s+(\w+)\s+ke\s+(\w+)/)
  if (t) {
    const amt = parseAmount(t[2])
    addTransaction(chat_id, {
      user: t[1].toUpperCase(),
      type: "transfer",
      amount: amt,
      from: t[3],
      to: t[4]
    })
    return `🔁 *TRANSFER SUKSES*\n──────────────────\n💸 Nominal: **${fmt(amt)}**\n📤 Dari: **${t[3]}**\n📥 Ke: **${t[4]}**`
  }

  // =============================
  // TRANSAKSI (UI INCOME/EXPENSE)
  // =============================
  let tx = text.match(/(m|y)\s+(.+)\s+([\d.,]+)/)
  if (tx) {
    const user = tx[1].toUpperCase()
    const note = tx[2].trim()
    const amount = parseAmount(tx[3])
    
    const isMasuk = (
      note.includes("gaji") ||
      note.includes("bonus") ||
      note.includes("refund") ||
      note.includes("cashback")
    )
    const type = isMasuk ? "masuk" : "keluar"

    addTransaction(chat_id, {
      user: user,
      type,
      amount,
      note
    })

    const head = isMasuk ? "🤑 PEMASUKAN" : "💸 PENGELUARAN"
    const icon = isMasuk ? "📈" : "📉"
    
    return `${icon} *${head}*\n──────────────────\n👤 ${user} • ${note}\n💰 **${fmt(amount)}**`
  }

  return "❓ *Perintah tidak dikenali*"
}
