import { loadDB, saveDB } from "./db.js"
import { detectCategory } from "./categories.js"

/*
 Ledger philosophy:
 - Semua perubahan saldo = hasil dari ledger
 - Tidak ada edit, hanya reversal + entry baru
 - Semua bisa diaudit
*/

function now() {
  return new Date().toISOString()
}

function nextId(db) {
  db.lastId = (db.lastId || 0) + 1
  return db.lastId
}

function ensureUser(db, user) {
  if (!db.users[user]) db.users[user] = {}
  if (!db.investments[user]) db.investments[user] = {}
}

/* ========= CORE ========== */

export function resetSaldo() {
  const db = loadDB()
  db.locked = false
  db.users = { M: {}, Y: {} }
  db.investments = { M: {}, Y: {} }
  db.ledger = []
  db.closings = []
  db.lastId = 0
  saveDB(db)
  return "🔄 Saldo acuan dibuka"
}

export function setSaldo(user, account, amount) {
  const db = loadDB()
  if (db.locked) return "❌ Sudah closing"
  ensureUser(db, user)

  db.users[user][account] = amount

  db.ledger.push({
    id: nextId(db),
    t: now(),
    type: "SET_BALANCE",
    user,
    account,
    amount
  })

  saveDB(db)
  return `✅ ${user} ${account} = Rp${amount.toLocaleString()}`
}

export function closing() {
  const db = loadDB()
  if (db.locked) return "ℹ️ Sudah closing"

  db.locked = true
  db.closings.push({
    t: now(),
    users: JSON.parse(JSON.stringify(db.users)),
    investments: JSON.parse(JSON.stringify(db.investments))
  })

  saveDB(db)
  return "🔒 Closing berhasil"
}

/* ========= TRANSAKSI NATURAL ========= */

export function addTransaction(user, account, amount, note, direction) {
  const db = loadDB()
  if (!db.locked) return "❌ Belum closing"
  ensureUser(db, user)

  const bal = db.users[user][account] || 0
  if (direction === "OUT" && bal < amount) return "❌ Saldo tidak cukup"

  db.users[user][account] =
    direction === "IN" ? bal + amount : bal - amount

  const cat = detectCategory(note)

  db.ledger.push({
    id: nextId(db),
    t: now(),
    type: direction,
    user,
    account,
    amount,
    note,
    category: cat.category,
    needType: cat.needType
  })

  saveDB(db)
  return `✅ ${user} ${direction === "IN" ? "masuk" : "keluar"} Rp${amount.toLocaleString()}`
}

/* ========= TRANSFER ========= */

export function transfer(fromUser, fromAcc, toUser, toAcc, amount) {
  const db = loadDB()
  ensureUser(db, fromUser)
  ensureUser(db, toUser)

  if ((db.users[fromUser][fromAcc] || 0) < amount)
    return "❌ Saldo tidak cukup"

  db.users[fromUser][fromAcc] -= amount
  db.users[toUser][toAcc] = (db.users[toUser][toAcc] || 0) + amount

  db.ledger.push({
    id: nextId(db),
    t: now(),
    type: "TRANSFER",
    fromUser,
    fromAcc,
    toUser,
    toAcc,
    amount
  })

  saveDB(db)
  return "🔁 Transfer sukses"
}

/* ========= INVESTASI ========= */

export function invest(user, fromAcc, invAcc, amount) {
  const db = loadDB()
  ensureUser(db, user)

  if ((db.users[user][fromAcc] || 0) < amount)
    return "❌ Saldo tidak cukup"

  db.users[user][fromAcc] -= amount
  db.investments[user][invAcc] = (db.investments[user][invAcc] || 0) + amount

  db.ledger.push({
    id: nextId(db),
    t: now(),
    type: "INVEST_IN",
    user,
    fromAcc,
    invAcc,
    amount
  })

  saveDB(db)
  return "📈 Investasi tercatat"
}

export function withdraw(user, invAcc, toAcc, amount) {
  const db = loadDB()
  ensureUser(db, user)

  if ((db.investments[user][invAcc] || 0) < amount)
    return "❌ Investasi tidak cukup"

  db.investments[user][invAcc] -= amount
  db.users[user][toAcc] = (db.users[user][toAcc] || 0) + amount

  db.ledger.push({
    id: nextId(db),
    t: now(),
    type: "INVEST_OUT",
    user,
    invAcc,
    toAcc,
    amount
  })

  saveDB(db)
  return "📉 Withdraw tercatat"
}

/* ========= UNDO (AUDIT SAFE) ========= */

export function undoLast(user) {
  const db = loadDB()
  const last = [...db.ledger].reverse().find(l => l.user === user && ["IN","OUT"].includes(l.type))
  if (!last) return "❌ Tidak ada transaksi"

  if (last.type === "IN") {
    db.users[user][last.account] -= last.amount
  }
  if (last.type === "OUT") {
    db.users[user][last.account] += last.amount
  }

  db.ledger.push({
    id: nextId(db),
    t: now(),
    type: "UNDO",
    ref: last.id
  })

  saveDB(db)
  return "↩️ Undo berhasil"
}

/* ========= READ ========= */

export function getDB() {
  return loadDB()
}
