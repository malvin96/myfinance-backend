import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay", "bibit", "emas"];
const ID_MALVIN = 5023700044;
const ID_YOVITA = 8469259152;

/**
 * Logika Anti-Gagal untuk Angka Indonesia
 * Membedakan 20.063.613 (Ribuan) dengan 15.135.839,29 (Desimal)
 */
function cleanNumeric(t) {
  if (!t) return 0;
  let str = t.replace(/\s/g, ''); // Hapus spasi

  // 1. Jika ada koma, itu adalah desimal standar Indonesia (1.000,50)
  if (str.includes(',')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  }

  // 2. Jika ada lebih dari satu titik, itu pasti ribuan (20.063.613)
  const dotCount = (str.match(/\./g) || []).length;
  if (dotCount > 1) {
    return parseFloat(str.replace(/\./g, '')) || 0;
  } 
  
  // 3. Jika hanya satu titik, cek apakah ribuan (15.000) atau desimal (15.5)
  if (dotCount === 1) {
    const parts = str.split('.');
    // Jika bagian belakang titik panjangnya tepat 3, anggap itu ribuan
    if (parts[1].length === 3) return parseFloat(str.replace(/\./g, '')) || 0;
    return parseFloat(str) || 0;
  }

  return parseFloat(str) || 0;
}

function extractAmount(t) {
  const m = t.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/i);
  if (!m) return 0;
  let val = cleanNumeric(m[1]);
  const unit = (m[2] || "").toLowerCase();
  if (["k", "rb", "ribu"].includes(unit)) val *= 1000;
  if (["jt", "juta"].includes(unit)) val *= 1000000;
  return Math.round(val * 100) / 100;
}

export function parseInput(text, senderId) {
  if (!text) return [];
  return text.split('\n').filter(l => l.trim()).map(line => parseLine(line, senderId));
}

function parseLine(text, senderId) {
  // tLower digunakan untuk pengecekan perintah (Case Insensitive)
  const tLower = text.toLowerCase().trim();
  let user = (senderId === ID_YOVITA) ? "Y" : "M";
  let cleanText = text;

  // Deteksi inisial User (Y/M) di awal
  if (tLower.startsWith("y ")) { user = "Y"; cleanText = text.substring(2).trim(); }
  else if (tLower.startsWith("m ")) { user = "M"; cleanText = text.substring(2).trim(); }

  const cmd = cleanText.toLowerCase();

  // 1. Perintah Sistem
  if (cmd.startsWith("set budget ")) return { type: "set_budget", category: cmd.split(" ")[2], amount: extractAmount(cmd) };
  if (cmd === "cek budget") return { type: "cek_budget" };
  if (cmd.startsWith("cari ")) return { type: "search", query: cmd.replace("cari ", "").trim() };
  if (cmd.startsWith("history ")) return { type: "history_period", period: cmd.replace("history ", "").trim() };
  if (cmd === "rekap") return { type: "rekap" };

  // 2. Set Saldo & Pindah (Tidak sensitif huruf besar/kecil)
  if (cmd.startsWith("set saldo ")) {
    const acc = ACCOUNTS.find(a => cmd.includes(a.toLowerCase())) || "cash";
    return { type: "set_saldo", user, account: acc, amount: extractAmount(cmd), note: "Set Saldo" };
  }
  if (cmd.startsWith("pindah ")) {
    const amount = extractAmount(cmd);
    const from = ACCOUNTS.find(a => cmd.includes(a.toLowerCase())) || "bca";
    const to = ACCOUNTS.filter(a => a !== from).find(a => cmd.includes(a.toLowerCase())) || "cash";
    return { type: "transfer_akun", user, from, to, amount };
  }

  // 3. Fitur Kasih (Transfer User)
  if (cmd.startsWith("kasih ")) {
    const target = (cmd.includes(" y ") || cmd.endsWith(" y")) ? "Y" : "M";
    const acc = ACCOUNTS.find(a => cmd.includes(a.toLowerCase())) || "cash";
    return { type: "transfer_user", fromUser: user, toUser: target, amount: extractAmount(cmd), account: acc };
  }

  // 4. Transaksi Biasa & Kembalian
  let amount = extractAmount(cmd);
  if (cmd.includes("kembali")) {
    const p = cmd.split("kembali");
    amount = extractAmount(p[0]) - extractAmount(p[1]);
  }

  const { category } = detectCategory(cmd);
  const tag = (cmd.match(/#(\w+)/) || [])[1] || "";

  return {
    type: "tx", user, 
    account: ACCOUNTS.find(a => cmd.includes(a.toLowerCase())) || "cash",
    amount: (cmd.includes("gaji") || cmd.includes("masuk")) ? amount : -amount,
    category, tag, note: cleanText
  };
}
