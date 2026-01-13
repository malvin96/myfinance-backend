import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay", "bibit", "emas"];
const ID_MALVIN = 5023700044;
const ID_YOVITA = 8469259152;

function cleanNumeric(t) {
  if (!t) return 0;
  let val = t.replace(/,/g, '.'); // Koma jadi titik desimal
  const parts = val.split('.');
  if (parts.length > 2) { // Hapus titik ribuan, simpan titik desimal
    const dec = parts.pop();
    val = parts.join('') + '.' + dec;
  }
  return parseFloat(val) || 0;
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
  const tLower = text.toLowerCase().trim();
  let user = (senderId === ID_YOVITA) ? "Y" : "M";
  let cleanText = text;

  if (tLower.startsWith("y ")) { user = "Y"; cleanText = text.substring(2).trim(); }
  else if (tLower.startsWith("m ")) { user = "M"; cleanText = text.substring(2).trim(); }

  const cmd = cleanText.toLowerCase();

  if (cmd.startsWith("set budget ")) return { type: "set_budget", category: cmd.split(" ")[2], amount: extractAmount(cmd) };
  if (cmd === "cek budget") return { type: "cek_budget" };
  if (cmd.startsWith("cari ")) return { type: "search", query: cmd.replace("cari ", "").trim() };
  if (cmd.startsWith("history ")) return { type: "history_period", period: cmd.replace("history ", "").trim() };
  if (cmd === "rekap") return { type: "rekap" };

  if (cmd.startsWith("set saldo ")) {
    const acc = ACCOUNTS.find(a => cmd.includes(a)) || "cash";
    return { type: "set_saldo", user, account: acc, amount: extractAmount(cmd), note: "Set Saldo" };
  }

  if (cmd.startsWith("pindah ")) {
    const amount = extractAmount(cmd);
    const from = ACCOUNTS.find(a => cmd.includes(a)) || "bca";
    const to = ACCOUNTS.filter(a => a !== from).find(a => cmd.includes(a)) || "cash";
    return { type: "transfer_akun", user, from, to, amount };
  }

  let amount = extractAmount(cmd);
  if (cmd.includes("kembali")) {
    const p = cmd.split("kembali");
    amount = extractAmount(p[0]) - extractAmount(p[1]);
  }

  const { category } = detectCategory(cmd);
  return {
    type: "tx", user, account: ACCOUNTS.find(a => cmd.includes(a)) || "cash",
    amount: (cmd.includes("gaji") || cmd.includes("masuk")) ? amount : -amount,
    category, note: cleanText
  };
}
