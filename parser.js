import {
  addTransaction,
  getSummary,
  getLastTransaction,
  deleteTransaction
} from "./ledger.js"

// ============================
// CONFIG DASAR (KUNCI)
// ============================
const USERS = ["M", "Y"]

const CATEGORY_KEYWORDS = {
  makan: ["makan", "ayam", "nasi", "kopi", "minum", "geprek"],
  transport: ["grab", "gojek", "ojek", "taxi", "bensin"],
  belanja: ["belanja", "indomaret", "alfamart", "market"],
  hiburan: ["nonton", "netflix", "game"],
}

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay"]

// ============================
// UTIL
// ============================
function detectUser(text) {
  for (const u of USERS) {
    if (text.startsWith(u + " ")) return u
  }
  return "M" // default
}

function detectAmount(text) {
  const match = text.match(/(\d+)(rb|ribu|k)?/)
  if (!match) return null
  let amount = parseInt(match[1], 10)
  if (match[2]) amount *= 1000
  return amount
}

function detectCategory(text) {
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some(w => text.includes(w))) return cat
  }
  return "lainnya"
}

function detectAccount(text) {
  for (const acc of ACCOUNTS) {
    if (text.includes(acc)) return acc
  }
  return "cash"
}

// ============================
// MAIN HANDLER
// ============================
export async function handleMessage(telegram_id, rawText) {
  const text = rawText.toLowerCase().trim()

  // ----------------------------
  // SALDO / REKAP
  // ----------------------------
  if (text === "saldo" || text === "rekap") {
    return getSummary(telegram_id)
  }

  // ----------------------------
  // HAPUS TRANSAKSI TERAKHIR
  // ----------------------------
  if (text === "hapus") {
    const last = getLastTransaction(telegram_id, "M")
    if (!last) return "❌ Tidak ada transaksi untuk dihapus."
    deleteTransaction(last.id)
    return "✅ Transaksi terakhir dihapus."
  }

  // ----------------------------
  // PARSING TRAN
