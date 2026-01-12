import { db } from "./db.js"

export function addTransaction(chat_id, data) {
  const { user, type, amount, account, category, note, tags } = data

  db.prepare(`
    INSERT INTO transactions
    (chat_id, user, type, amount, account, category, note, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(chat_id, user, type, amount, account, category, note, tags || "")
}

export function getSummary(chat_id) {
  const rows = db.prepare(`
    SELECT user, type, SUM(amount) AS total
    FROM transactions
    WHERE chat_id = ?
    GROUP BY user, type
  `).all(chat_id)

  let M_in=0, M_out=0, Y_in=0, Y_out=0

  for (const r of rows) {
    if (r.user === "M" && r.type === "income") M_in = r.total || 0
    if (r.user === "M" && r.type === "expense") M_out = r.total || 0
    if (r.user === "Y" && r.type === "income") Y_in = r.total || 0
    if (r.user === "Y" && r.type === "expense") Y_out = r.total || 0
  }

  return (
`📊 REKAP
M: +Rp${M_in.toLocaleString("id-ID")} -Rp${M_out.toLocaleString("id-ID")} = Rp${(M_in-M_out).toLocaleString("id-ID")}
Y: +Rp${Y_in.toLocaleString("id-ID")} -Rp${Y_out.toLocaleString("id-ID")} = Rp${(Y_in-Y_out).toLocaleString("id-ID")}
TOTAL: Rp${(M_in + Y_in - M_out - Y_out).toLocaleString("id-ID")}`
  )
}

export function getHistory(chat_id, limit = 20) {
  const rows = db.prepare(`
    SELECT *
    FROM transactions
    WHERE chat_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(chat_id, limit)

  if (!rows.length) return "Belum ada transaksi."

  return rows.map(r =>
    `${r.created_at} | ${r.user} | ${r.type === "income" ? "+" : "-"}Rp${r.amount.toLocaleString("id-ID")} | ${r.category} | ${r.account} | ${r.note} ${r.tags || ""}`
  ).join("\n")
}

export function getLast(chat_id, user) {
  return db.prepare(`
    SELECT *
    FROM transactions
    WHERE chat_id = ? AND user = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(chat_id, user)
}

export function deleteById(id) {
  db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id)
}
