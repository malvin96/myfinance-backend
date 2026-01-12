import { setBalance, addTransaction, isLocked, lockLedger, unlockLedger } from "./ledger.js"

function normalize(txt) {
  return txt.toLowerCase().replace(/\s+/g, " ").trim()
}

export async function handleMessage(user, text) {
  const t = normalize(text)

  // RESET
  if (t === "reset saldo acuan") {
    unlockLedger()
    return "🔄 Saldo acuan dibuka. Silakan set saldo."
  }

  // CLOSING
  if (t === "closing") {
    lockLedger()
    return "🔒 Closing selesai. Neraca dikunci."
  }

  // SET SALDO
  if (t.startsWith("set saldo")) {
    if (isLocked()) return "❌ Sudah closing. Reset dulu."

    const parts = t.split(" ")
    if (parts.length < 5) return "❌ Format: set saldo M bca 100000"

    const userCode = parts[2].toUpperCase()
    const account = parts[3]
    const amount = Number(parts[4])

    if (!amount && amount !== 0) return "❌ Nominal tidak valid"

    setBalance(userCode, account, amount)
    return `✅ Saldo ${userCode} ${account} = Rp${amount.toLocaleString()}`
  }

  // TRANSACTION
  const m = t.match(/^([my]) (.+) ([0-9]+) via (.+)$/)
  if (m) {
    if (!isLocked()) return "❌ Belum closing."

    const userCode = m[1].toUpperCase()
    const note = m[2]
    const amount = -Number(m[3])
    const account = m[4]

    addTransaction(userCode, amount, "expense", account, note)
    return `✅ ${userCode} keluar Rp${Math.abs(amount).toLocaleString()} via ${account}`
  }

  return "❓ Perintah tidak dikenali"
}
