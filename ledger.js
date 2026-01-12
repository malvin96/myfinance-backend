import { db } from "./db.js"

export function addTransaction(t){
  db.prepare(`
    INSERT INTO transactions (user, account, category, note, amount, type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(t.user, t.account, t.category, t.note, t.amount, t.type, new Date().toISOString())

  const row = db.prepare(`SELECT balance FROM balances WHERE user=? AND account=?`)
               .get(t.user, t.account)

  let balance = row ? row.balance : 0
  balance += t.type === "income" ? t.amount : -t.amount

  db.prepare(`
    INSERT INTO balances (user,account,balance) VALUES(?,?,?)
    ON CONFLICT(user,account) DO UPDATE SET balance=excluded.balance
  `).run(t.user,t.account,balance)
}

export function getSummary(){
  const rows = db.prepare(`
    SELECT user, SUM(CASE WHEN type='income' THEN amount ELSE -amount END) AS total
    FROM transactions GROUP BY user
  `).all()

  return rows
}

export function getHistory(limit=20){
  return db.prepare(`
    SELECT * FROM transactions ORDER BY id DESC LIMIT ?
  `).all(limit)
}

export function getBalances(){
  return db.prepare(`SELECT * FROM balances`).all()
}
