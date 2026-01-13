import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay", "bibit", "emas"];
const ID_MALVIN = 5023700044;
const ID_YOVITA = 8469259152;

/**
 * Membersihkan angka dari format Indonesia (titik ribuan, koma desimal)
 * agar bisa dihitung oleh sistem.
 * Contoh: "15.135.839,29" -> 15135839.29
 */
function cleanNumeric(t) {
  if (!t) return 0;
  let val = t.replace(/,/g, '.'); // Ubah koma desimal ke titik
  const parts = val.split('.');
  if (parts.length > 2) {
    const decimal = parts.pop();
    val = parts.join('') + '.' + decimal; // Buang titik ribuan, jaga titik desimal
  }
  return parseFloat(val) || 0;
}

/**
 * Mendukung ekstraksi angka murni, ribuan (k), atau jutaan (jt)
 */
function extractAmount(t) {
  const m = t.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/i);
  if (!m) return 0;
  
  let value = cleanNumeric(m[1]);
  const unit = (m[2] || "").toLowerCase();

  if (["k", "rb", "ribu"].includes(unit)) value *= 1000;
  if (["jt", "juta"].includes(unit)) value *= 1000000;
  
  return Math.round(value * 100) / 100; // Jaga presisi 2 angka di belakang koma
}

export function parseInput(text, senderId) {
  return text.split('\n').filter(l => l.trim()).map(line => parseLine(line, senderId));
}

function parseLine(text, senderId) {
  const t = text.toLowerCase();
  let user = (senderId === ID_YOVITA) ? "Y" : "M";
  let cleanText = text;

  // Manual User Override
  if (t.startsWith("y ")) { user = "Y"; cleanText = text.substring(2).trim(); }
  else if (t.startsWith("m ")) { user = "M"; cleanText = text.substring(2).trim(); }

  const cleanT = cleanText.toLowerCase();

  // 1. Budgeting
  if (cleanT.startsWith("set budget ")) {
    const parts = cleanT.split(" ");
    return { type: "set_budget", category: parts[2], amount: extractAmount(cleanT) };
  }
  if (cleanT === "cek budget") return { type: "cek_budget" };

  // 2. Search & History
  if (cleanT.startsWith("cari ")) return { type: "search", query: cleanT.replace("cari ", "").trim() };
  if (cleanT.startsWith("history ")) return { type: "history_period", period: cleanT.replace("history ", "").trim() };
  if (cleanT === "rekap") return { type: "rekap" };

  // 3. Set Saldo Detail
  if (cleanT.startsWith("set saldo ")) {
    const acc = ACCOUNTS.find(a => cleanT.includes(a)) || "cash";
    return { type: "set_saldo", user, account: acc, amount: extractAmount(cleanT), note: "Set Saldo Awal" };
  }

  // 4. Mutasi Akun
  if (cleanT.startsWith("pindah ")) {
    const amount = extractAmount(cleanT);
    const from = ACCOUNTS.find(a => cleanT.includes(a)) || "bca";
    const to = ACCOUNTS.filter(a => a !== from).find(a => cleanT.includes(a)) || "cash";
    return { type: "transfer_akun", user, from, to, amount };
  }

  // 5. Transfer User
  if (cleanT.startsWith("kasih ")) {
    const target = (cleanT.includes(" y ") || cleanT.endsWith(" y")) ? "Y" : "M";
    return { type: "transfer_user", fromUser: user, toUser: target, amount: extractAmount(cleanT), account: ACCOUNTS.find(a => cleanT.includes(a)) || "cash" };
  }

  // 6. Transaksi & Kembalian
  let amount = extractAmount(cleanT);
  if (cleanT.includes("kembali")) {
    const parts = cleanT.split("kembali");
    amount = extractAmount(parts[0]) - extractAmount(parts[1]);
  }

  const { category } = detectCategory(cleanT);
  const tag = (cleanT.match(/#(\w+)/) || [])[1] || "";

  return {
    type: "tx", user, account: ACCOUNTS.find(a => cleanT.includes(a)) || "cash",
    amount: (cleanT.includes("gaji") || cleanT.includes("masuk")) ? amount : -amount,
    category, tag, note: cleanText
  };
}
