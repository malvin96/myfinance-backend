import fs from "fs"

const DB_FILE = "./db.json"

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: {}, ledger: [], closing: null }
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"))
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

function rupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID")
}

export async function handleMessage(chat, text) {
  const db = loadDB()
  const msg = text.toLowerCase().trim()

  // ---------------- SALDO QUERY ----------------
  if (msg === "saldo" || msg === "cek saldo") {
    return buildSaldo(db)
  }

  if (msg.startsWith("saldo ")) {
    const [, who, account] = msg.split(" ")
    return saldoDetail(db, who, account)
  }

  // ---------------- EXPORT ----------------
  if (msg === "export" || msg === "laporan" || msg === "ringkasan") {
    return exportLedger(db)
  }

  // ---------------- SET SALDO ----------------
  if (msg.startsWith("set saldo")) {
    const p = msg.split(" ")
    if (p.length < 5) return "❌ Format salah"

    const user = p[2].toUpperCase()
    const akun = p[3]
    const nilai = Number(p[4].replace(/[^0-9]/g, ""))

    if (!db.users[user]) db.users[user] = {}
    db.users[user][akun] = nilai

    saveDB(db)
    return `✅ Saldo ${user} ${akun} = ${rupiah(nilai)}`
  }

  // ---------------- TRANSAKSI ----------------
  const trx = msg.match(/(m|y)\s+(masuk|keluar)\s+([\d,.]+)\s*(.*)/)
  if (trx) {
    const user = trx[1].toUpperCase()
    const type = trx[2]
    const amount = Number(trx[3].replace(/[^0-9]/g, ""))
    const desc = trx[4] || ""

    db.ledger.push({
      date: new Date().toISOString(),
      user,
      type,
      amount,
      desc
    })

    saveDB(db)
    return `✅ ${user} ${type} ${rupiah(amount)}`
  }

  // ---------------- CLOSING ----------------
  if (msg === "closing") {
    db.closing = new Date().toISOString()
    saveDB(db)
    return "🔒 Closing selesai. Neraca dikunci."
  }

  return "❓ Perintah tidak dikenali"
}

// ---------------- BUILDERS ----------------

function buildSaldo(db) {
  let out = "📊 SALDO KELUARGA\n\n"
  let total = 0

  for (const u in db.users) {
    let sum = 0
    for (const a in db.users[u]) sum += db.users[u][a]
    total += sum
    out += `${u}: ${rupiah(sum)}\n`
  }

  out += `\nTOTAL: ${rupiah(total)}`
  return out
}

function saldoDetail(db, who, akun) {
  const u = who.toUpperCase()
  if (!db.users[u]) return "❌ User tidak ada"

  if (!akun) {
    let sum = 0
    let out = `📂 ${u}\n`
    for (const a in db.users[u]) {
      sum += db.users[u][a]
      out += `${a}: ${rupiah(db.users[u][a])}\n`
    }
    out += `TOTAL: ${rupiah(sum)}`
    return out
  }

  return `💼 ${u} ${akun} = ${rupiah(db.users[u][akun] || 0)}`
}

function exportLedger(db) {
  let out = "=== MY FINANCE LEDGER ===\n\n"

  for (const u in db.users) {
    out += `USER ${u}\n`
    for (const a in db.users[u]) {
      out += `  ${a}: ${db.users[u][a]}\n`
    }
    out += "\n"
  }

  out += "TRANSAKSI:\n"
  db.ledger.forEach(t => {
    out += `${t.date} | ${t.user} | ${t.type} | ${t.amount} | ${t.desc}\n`
  })

  if (db.closing) out += `\nCLOSING: ${db.closing}`

  return out
}
