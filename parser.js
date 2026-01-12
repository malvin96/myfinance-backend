import { addTransaction, setBalance, getBalances } from "./ledger.js"
import { exportAll } from "./export.js"
import { createSnapshot } from "./snapshot.js"
import { getAggregates } from "./aggregate.js"

// 1. Helper Format Rupiah
const fmt = (n) => "Rp " + parseInt(n).toLocaleString("id-ID")

// 2. Helper Cerdas Baca Angka (Fix: Support k, rb, jt, dan titik ribuan)
function parseAmount(text) {
  let clean = text.toLowerCase().trim()
  
  // Jika pakai satuan 'jt' (Juta) -> misal: 1.5jt atau 2jt
  if (clean.includes("jt")) {
    // Ubah koma jadi titik (jaga-jaga user ngetik 1,5jt)
    let num = parseFloat(clean.replace("jt", "").replace(",", "."))
    return num * 1000000
  }
  
  // Jika pakai satuan 'rb' atau 'k' (Ribu) -> misal: 50rb atau 10k
  if (clean.includes("rb") || clean.includes("k")) {
    let num = parseFloat(clean.replace("rb", "").replace("k", "").replace(",", "."))
    return num * 1000
  }

  // Jika angka biasa (Format Indo: 100.000) -> Hapus titik ribuan
  return parseFloat(clean.replace(/\./g, "").replace(",", "."))
}

export async function handleMessage(chat_id, text) {
  if (!text) return "❌ Pesan kosong"
  text = text.toLowerCase().trim()

  // =============================
  // SET SALDO
  // =============================
  // Regex diperbarui untuk menangkap k/rb/jt
  let m = text.match(/set saldo (m|y)\s+(\w+)\s+([\d.,a-z]+)/)
  if (m) {
    const user = m[1].toUpperCase()
    const acc = m[2].toUpperCase()
    const amount = parseAmount(m[3])
    
    // Validasi kalau hasil parse NaN
    if (isNaN(amount)) return "❌ *Format angka salah.*"

    setBalance(chat_id, user, acc, amount)
    
    return `💾 *SALDO DI-UPDATE*\n──────────────────\n👤 User : **${user}**\n🏦 Akun : **${acc}**\n💰 Total : **${fmt(amount)}**\n──────────────────`
  }

  // =============================
  // SALDO
  // =============================
  if (text === "saldo") {
    const b = getBalances(chat_id)
    if (!b || Object.keys(b).length === 0) return "⚠️ *Belum ada data saldo.*"

    let output = "📊 *STATUS KEUANGAN*\n"
    let grandTotal = 0

    for (let user in b) {
      output += `\n👤 **${user.toUpperCase()}**`
      let subtotal = 0
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
  // TRANSFER
  // =============================
  // Regex diperbarui: ([\d.,a-z]+) supaya baca huruf k/rb/jt
  let t = text.match(/(m|y)\s+transfer\s+([\d.,a-z]+)\s+dari\s+(\w+)\s+ke\s+(\w+)/)
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
  // TRANSAKSI
  // =============================
  // Regex diperbarui: ([\d.,a-z]+)
  let tx = text.match(/(m|y)\s+(.+)\s+([\d.,a-z]+)/)
  if (tx) {
    const user = tx[1].toUpperCase()
    const note = tx[2].trim()
    const amount = parseAmount(tx[3])
    
    if (isNaN(amount)) return "❌ *Gagal baca nominal.* Coba: '10k' atau '50000'"

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
