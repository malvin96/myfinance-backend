import { setSaldo, addTransaction, getSaldo, getLedger, closing } from "./ledger.js"

export async function handleMessage(chatId, text) {
  const t = text.toLowerCase().trim()

  // SET SALDO
  const setMatch = t.match(/^set saldo (m|y) (\w+) (\d+)$/)
  if (setMatch) {
    const user = setMatch[1].toUpperCase()
    const akun = setMatch[2]
    const jumlah = Number(setMatch[3])

    setSaldo(chatId, user, akun, jumlah)
    return `✅ Saldo ${user} ${akun} = Rp${jumlah.toLocaleString()}`
  }

  // CLOSING
  if (t === "closing") {
    closing(chatId)
    return "🔒 Closing selesai. Neraca dikunci."
  }

  // SALDO
  if (t === "saldo") {
    const data = getSaldo(chatId)
    let out = "📊 SALDO KELUARGA\n\n"

    for (const u of ["M", "Y"]) {
      out += `👤 ${u}\n`
      let total = 0
      for (const a in data[u]) {
        total += data[u][a]
        out += `- ${a}: Rp${data[u][a].toLocaleString()}\n`
      }
      out += `TOTAL ${u}: Rp${total.toLocaleString()}\n\n`
    }
    return out
  }

  // EXPORT
  if (t === "export") {
    const ledger = getLedger(chatId)
    return (
      "=== MY FINANCE LEDGER ===\n" +
      ledger.map(l => `${l.time} | ${l.user} | ${l.type} | ${l.akun} | ${l.amount}`).join("\n")
    )
  }

  // TRANSAKSI
  const trx = t.match(/^(m|y) (masuk|keluar) (\d+)(?: (.+))? via (\w+)$/)
  if (trx) {
    const user = trx[1].toUpperCase()
    const type = trx[2] === "masuk" ? "IN" : "OUT"
    const amount = Number(trx[3])
    const note = trx[4] || "-"
    const akun = trx[5]

    addTransaction(chatId, { user, type, amount, akun, note })
    return `✅ ${user} ${type === "IN" ? "masuk" : "keluar"} Rp${amount.toLocaleString()} via ${akun}`
  }

  return "❓ Perintah tidak dikenali"
}
