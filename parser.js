import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay", "bibit", "emas"];
const ID_MALVIN = 5023700044;
const ID_YOVITA = 8469259152;

/**
 * Membersihkan angka dari format Indonesia (titik ribuan, koma desimal)
 */
function cleanNumeric(t) {
  if (!t) return 0;
  let val = t.replace(/,/g, '.'); 
  const parts = val.split('.');
  if (parts.length > 2) {
    const decimalPart = parts.pop();
    val = parts.join('') + '.' + decimalPart;
  }
  return parseFloat(val) || 0;
}

/**
 * Ekstraksi angka (k, rb, jt) - Case Insensitive
 */
function extractAmount(t) {
  const m = t.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/i);
  if (!m) return 0;
  
  let value = cleanNumeric(m[1]);
  const unit = (m[2] || "").toLowerCase();

  if (["k", "rb", "ribu"].includes(unit)) value *= 1000;
  if (["jt", "juta"].includes(unit)) value *= 1000000;
  
  return Math.round(value * 100) / 100;
}

export function parseInput(text, senderId) {
  if (!text) return [];
  return text.split('\n').filter(l => l.trim()).map(line => parseLine(line, senderId));
}

function parseLine(text, senderId) {
  const cleanT = text.toLowerCase().trim();
  let user = (senderId === ID_YOVITA) ? "Y" : "M";
  let cleanText = text;

  // Manual User Override
  if (cleanT.startsWith("y ")) { user = "Y"; cleanText = text.substring(2).trim(); }
  else if (cleanT.startsWith("m ")) { user = "M"; cleanText = text.substring(2).trim(); }

  const tLower = cleanText.toLowerCase();

  // 1. Budgeting
  if (tLower.startsWith("set budget ")) {
    const parts = tLower.split(" ");
    return { type: "set_budget", category: parts[2], amount: extractAmount(tLower) };
  }
  if (tLower === "cek budget") return { type: "cek_budget" };

  // 2. Search & Rekap
  if (tLower.startsWith("cari ")) return { type: "search", query: tLower.replace("cari ", "").trim() };
  if (tLower.startsWith("history ")) return { type: "history_period", period: tLower.replace("history ", "").trim() };
  if (tLower === "rekap") return { type: "rekap" };

  // 3. Set Saldo (Case Insensitive Account)
  if (tLower.startsWith("set saldo ")) {
    const acc = ACCOUNTS.find(a => tLower.includes(a.toLowerCase())) || "cash";
    return { type: "set_saldo", user, account: acc, amount: extractAmount(tLower), note: "Set Saldo Awal" };
  }

  // 4. Transfer Akun
  if (tLower.startsWith("pindah ")) {
    const amount = extractAmount(tLower);
    const from = ACCOUNTS.find(a => tLower.includes(a.toLowerCase())) || "bca";
    const to = ACCOUNTS.filter(a => a !== from).find(a => tLower.includes(a.toLowerCase())) || "cash";
    return { type: "transfer_akun", user, from, to, amount };
  }

  // 5. Transfer User
  if (tLower.startsWith("kasih ")) {
    const target = (tLower.includes(" y ") || tLower.endsWith(" y")) ? "Y" : "M";
    return { type: "transfer_user", fromUser: user, toUser: target, amount: extractAmount(tLower), account: ACCOUNTS.find(a => tLower.includes(a.toLowerCase())) || "cash" };
  }

  // 6. Transaksi Biasa
  let amount = extractAmount(tLower);
  if (tLower.includes("kembali")) {
    const parts = tLower.split("kembali");
    amount = extractAmount(parts[0]) - extractAmount(parts[1]);
  }

  const { category } = detectCategory(tLower);
  const tag = (tLower.match(/#(\w+)/) || [])[1] || "";

  return {
    type: "tx", user, 
    account: ACCOUNTS.find(a => tLower.includes(a.toLowerCase())) || "cash",
    amount: (tLower.includes("gaji") || tLower.includes("masuk")) ? amount : -amount,
    category, tag, note: cleanText
  };
}
