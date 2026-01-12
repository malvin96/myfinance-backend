import { addTransaction, getSummary, getHistory, getLast, deleteById } from "./ledger.js"

const ACCOUNTS = ["cash","bca","ovo","gopay","shopeepay"]
const CATS = {
  makan:["makan","ayam","nasi","kopi","minum"],
  transport:["grab","gojek","bensin","ojek"],
  belanja:["belanja","indomaret","alfamart","market"],
  tagihan:["listrik","air","internet","pulsa"]
}

function detectUser(t){
  if (t.startsWith("y ")) return "Y"
  if (t.startsWith("m ")) return "M"
  return "M"
}

function detectAccount(t){
  return ACCOUNTS.find(a => t.includes(a)) || "cash"
}

function detectCategory(t){
  for (const k in CATS) {
    if (CATS[k].some(w => t.includes(w))) return k
  }
  return "lainnya"
}

function detectAmount(t){
  const m = t.match(/(\d+)(rb|ribu|k|jt)?/)
  if (!m) return null
  let n = parseInt(m[1],10)
  if (m[2]==="rb" || m[2]==="k") n*=1000
  if (m[2]==="jt") n*=1000000
  return n
}

export async function handleMessage(chat_id, raw){
  const t = raw.toLowerCase().trim()

  if (t === "rekap" || t === "saldo") return getSummary(chat_id)
  if (t.startsWith("history")) return getHistory(chat_id)

  if (t === "undo" || t === "hapus") {
    const u = detectUser(t)
    const last = getLast(chat_id, u)
    if (!last) return "Tidak ada transaksi."
    deleteById(last.id)
    return "✅ Transaksi terakhir dihapus."
  }

  const user = detectUser(t)
  const amount = detectAmount(t)
  if (!amount) return "❌ Nominal tidak ditemukan."

  const type = (t.includes("gaji") || t.includes("pendapatan")) ? "income" : "expense"
  const account = detectAccount(t)
  const category = detectCategory(t)
  const tags = (t.match(/#\w+/g) || []).join(" ")
  const note = t.replace(/#\w+/g,"").replace(/\d+(rb|ribu|k|jt)?/,"").trim()

  addTransaction(chat_id,{ user, account, category, note, amount, type, tags })

  return `✅ ${user} ${type==="income"?"mendapat":"keluar"} Rp${amount.toLocaleString("id-ID")} (${category}) via ${account} ${tags}`
}
