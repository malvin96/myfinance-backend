import { db } from "./db.js"

/*
Ledger = satu-satunya sumber kebenaran keuangan
Tidak ada saldo statis.
Saldo = SUM(transactions)
*/

export function addTransaction({
  telegram_id,
  user_code,
  type,
  account = "cash",
  asset = null,
  category = "lainnya",
  need_type = "kebutuhan",
  amount,
  note = "",
  tags = ""
}) {
  const stmt = db.prepare(`
    INSERT INTO transactions 
    (telegram_id, user_code, type, account, asset, category, need_type, amount, note, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    telegram_id,
    user_code,
    type,
    account,
    asset,
    category,
    need_type,
    amount,
    note,
    tags
  )
}

export function getSummary(telegram_id) {
  const rows = db.prepare(`
    SELECT 
      user_code,
      SUM(CASE WHEN type='income' THEN amount ELSE -amount END) as balance
    FROM transactions
    WHERE telegram_id = ?
    GROUP BY user_code
  `).all(telegram_id)

  let out = "📊 Saldo:\n"
  for (const r of rows) {
    out += `${r.user_code}: Rp ${r.balance.toLocaleString("id-ID")}\n`
  }

  return out
}

export function getLastTransaction(telegram_id, user_code) {
  return db.prepare(`
    SELECT * FROM transactions
    WHERE telegram_id=? AND user_code=?
    ORDER BY id DESC
    LIMIT 1
  `).get(telegram_id, user_code)
}

export function deleteTransaction(id) {
  db.prepare(`DELETE FROM transactions WHERE id=?`).run(id)
}
