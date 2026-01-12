import db from "./db.js"

// Tambah transaksi baru
export async function addTransaction(chatId, data) {
  const { user, type, amount, account, category, note } = data

  await db.run(
    `INSERT INTO transactions
     (chat_id, user, type, amount, account, category, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [chatId, user, type, amount, account, category, note]
  )
}

// Rekap saldo & summary
export async function getSummary(chatId) {
  const rows = await db.all(
    `SELECT user, type, SUM(amount) as total
     FROM transactions
     WHERE chat_id = ?
     GROUP BY user, type`,
    [chatId]
  )

  let M_in = 0, M_out = 0, Y_in = 0, Y_out = 0

  for (const r of rows) {
    if (r.user === "M" && r.type === "income") M_in = r.total
    if (r.user === "M" && r.type === "expense") M_out = r.total
    if (r.user === "Y" && r.type === "income") Y_in = r.total
    if (r.user === "Y" && r.type === "expense") Y_out = r.total
  }

  return `
📊 *REKAP*
M ➜ Masuk: Rp${M_in.toLocaleString()} | Keluar: Rp${M_out.toLocaleString()} | Net: Rp${(M_in - M_out).toLocaleString()}
Y ➜ Masuk: Rp${Y_in.toLocaleString()} | Keluar: Rp${Y_out.toLocaleString()} | Net: Rp${(Y_in - Y_out).toLocaleString()}
Total Keluarga: Rp${(M_in + Y_in - M_out - Y_out).toLocaleString()}
`
}

// History transaksi
export async function getHistory(chatId) {
  const rows = await db.all(
    `SELECT user, type, amount, category, account, note, created_at
     FROM transactions
     WHERE chat_id = ?
     ORDER BY id DESC
     LIMIT 20`,
    [chatId]
  )

  if (rows.length === 0) return "Belum ada transaksi."

  return rows
    .map(r =>
      `${r.created_at} | ${r.user} | ${r.type === "income" ? "+" : "-"}Rp${r.amount.toLocaleString()} | ${r.category} | ${r.account} | ${r.note}`
    )
    .join("\n")
}
