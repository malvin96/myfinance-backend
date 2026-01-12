import { db } from "./db.js"

export function isLocked() {
  const row = db.prepare("SELECT value FROM meta WHERE key='locked'").get()
  return row?.value === "1"
}

export function lockLedger() {
  db.prepare("INSERT OR REPLACE INTO meta (key,value) VALUES ('locked','1')").run()
}

export function unlockLedger() {
  db.prepare("INSERT OR REPLACE INTO meta (key,value) VALUES ('locked','0')").run()
}

export function setBalance(user, account, amount) {
  db.prepare(`
    INSERT INTO balances (user,account,amount)
    VALUES (?,?,?)
    ON CONFLICT(user,account)
    DO UPDATE SET amount=excluded.amount
  `).run(user, account, amount)
}

export function getBalances() {
  return db.prepare("SELECT * FROM balances").all()
}

export function getUserBalance(user, account) {
  const row = db.prepare("SELECT amount FROM balances WHERE user=? AND account=?").get(user, account)
  return row?.amount || 0
}

export function addTransaction(user, amount, category, account, note) {
  const current = getUserBalance(user, account)
  const next = current + amount

  setBalance(user, account, next)

  db.prepare(`
    INSERT INTO transactions (user, amount, category, account, note)
    VALUES (?,?,?,?,?)
  `).run(user, amount, category, account, note)
}
