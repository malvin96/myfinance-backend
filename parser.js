import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay", "bibit", "emas"];
const ID_MALVIN = 5023700044;
const ID_YOVITA = 8469259152;

function cleanNumeric(t) {
  if (!t) return 0;
  let str = t.replace(/rp/gi, '').replace(/\s/g, '');
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts[1].length === 3) str = str.replace(',', '');
    else str = str.replace(',', '.');
  }
  const dots = (str.match(/\./g) || []).length;
  if (dots > 1) {
    const lastDotIndex = str.lastIndexOf('.');
    str = str.replace(/\./g, (match, offset) => offset === lastDotIndex ? '.' : '');
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
  const rawLower = text.toLowerCase().trim();
  let user = (senderId === ID_YOVITA) ? "Y" : "M";
  let cleanText = text;

  if (rawLower.startsWith("y ")) { user = "Y"; cleanText = text.substring(2).trim(); }
  else if (rawLower.startsWith("m ")) { user = "M"; cleanText = text.substring(2).trim(); }

  const cmd = cleanText.toLowerCase();

  if (cmd === "rekap") return { type: "rekap" };
  if (cmd === "cek budget") return { type: "cek_budget" };
  if (cmd.startsWith("cari ")) return { type: "search", query: cmd.replace("cari ", "").trim() };
  if (cmd.startsWith("history ")) return { type: "history_period", period: cmd.replace("history ", "").trim() };

  if (cmd.includes("set saldo")) {
    const acc = ACCOUNTS.find(a => cmd.includes(a)) || "cash";
    return { type: "set_saldo", user, account: acc, amount: extractAmount(cmd), note: "Set Saldo" };
  }

  if (cmd.includes("pindah") || cmd.includes("transfer")) {
    const amount = extractAmount(cmd);
    const from = ACCOUNTS.find(a => cmd.includes(a)) || "bca";
    const to = ACCOUNTS.filter(a => a !== from).find(a => cmd.includes(a)) || "cash";
    return { type: "transfer_akun", user, from, to, amount };
  }

  if (cmd.includes("kasih")) {
    const target = (cmd.includes(" y") || cmd.includes(" y ")) ? "Y" : "M";
    const acc = ACCOUNTS.find(a => cmd.includes(a)) || "cash";
    return { type: "transfer_user", fromUser: user, toUser: target, amount: extractAmount(cmd), account: acc };
  }

  if (cmd.includes("set budget")) {
    const cat = cmd.split(" ").slice(-1)[0];
    return { type: "set_budget", category: cat, amount: extractAmount(cmd) };
  }

  let amount = extractAmount(cmd);
  if (cmd.includes("kembali")) {
    const parts = cmd.split("kembali");
    amount = extractAmount(parts[0]) - extractAmount(parts[1]);
  }

  const { category } = detectCategory(cmd);
  const account = ACCOUNTS.find(a => cmd.includes(a)) || "cash";

  return {
    type: "tx", user, account,
    amount: (cmd.includes("gaji") || cmd.includes("masuk") || cmd.includes("bonus")) ? amount : -amount,
    category, note: cleanText
  };
}
