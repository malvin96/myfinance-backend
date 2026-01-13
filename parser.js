import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay", "bibit", "emas", "mirrae", "bca sekuritas", "cc"];

function extractAmount(t) {
  const m = t.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/i);
  if (!m) return 0;
  let val = m[1].replace(/\./g, '').replace(',', '.');
  val = parseFloat(val) || 0;
  const unit = (m[2] || "").toLowerCase();
  if (["k", "rb", "ribu"].includes(unit)) val *= 1000;
  if (["jt", "juta"].includes(unit)) val *= 1000000;
  return val;
}

export function parseInput(text, senderId) {
  if (!text) return [];
  return text.split('\n').filter(l => l.trim()).map(line => parseLine(line, senderId));
}

function parseLine(text, senderId) {
  const rawLower = text.toLowerCase().trim();
  let user = (senderId === 8469259152) ? "Y" : "M";
  let cleanText = text;

  if (rawLower.startsWith("y ")) { user = "Y"; cleanText = text.substring(2).trim(); }
  else if (rawLower.startsWith("m ")) { user = "M"; cleanText = text.substring(2).trim(); }

  const cmd = cleanText.toLowerCase();

  // Fitur Koreksi
  if (cmd === "koreksi" || cmd === "batal") return { type: "koreksi", user };

  // Fitur Sistem & CC
  if (cmd === "rekap" || cmd === "saldo") return { type: "rekap" };
  if (cmd === "cek tagihan") return { type: "list_reminder" };
  if (cmd.startsWith("tagihan ")) {
    const parts = cmd.split(" ");
    return { type: "add_reminder", dueDate: parseInt(parts[1]), note: parts.slice(2).join(" ") };
  }
  if (cmd.startsWith("cc ")) {
    return { type: "tx", user, account: "cc", amount: -extractAmount(cmd), category: detectCategory(cmd).category, note: cleanText };
  }
  if (cmd.startsWith("lunas cc")) {
    const bank = ACCOUNTS.find(a => cmd.includes(a) && a !== "cc") || "bca";
    return { type: "transfer_akun", user, from: bank, to: "cc", amount: extractAmount(cmd) };
  }
  if (cmd.includes("set saldo")) {
    const acc = ACCOUNTS.find(a => cmd.includes(a)) || "cash";
    return { type: "set_saldo", user, account: acc, amount: extractAmount(cmd) };
  }

  // Transaksi Biasa
  let amount = extractAmount(cmd);
  const account = ACCOUNTS.find(a => cmd.includes(a)) || "cash";
  return {
    type: "tx", user, account,
    amount: (cmd.includes("gaji") || cmd.includes("masuk")) ? amount : -amount,
    category: detectCategory(cmd).category, note: cleanText
  };
}
