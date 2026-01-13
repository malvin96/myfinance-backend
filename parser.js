import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay"];

function parseAmount(t) {
  const m = t.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/);
  if (!m) return null;
  let n = m[1].replace(/\./g, "").replace(",", ".");
  let v = parseFloat(n);
  const u = m[2] || "";
  if (["k", "rb", "ribu"].includes(u)) v *= 1000;
  if (["jt", "juta"].includes(u)) v *= 1_000_000;
  return Math.round(v);
}

export function parseInput(text, username) {
  const t = text.toLowerCase();
  let user = "";
  let cleanText = text;

  // 1. Logika Penentuan User (Prioritas)
  if (t.startsWith("y ")) {
    // Prioritas 1: Jika ngetik manual "y ..."
    user = "Y";
    cleanText = text.substring(2).trim();
  } else if (t.startsWith("m ")) {
    // Prioritas 1: Jika ngetik manual "m ..."
    user = "M";
    cleanText = text.substring(2).trim();
  } else {
    // Prioritas 2: Otomatis berdasarkan Username
    // GANTI 'MalvinHen' dengan username Telegram Anda yang asli
    user = (username === "MalvinHen") ? "M" : "Y";
  }

  const cleanT = cleanText.toLowerCase();

  // 2. Logika Perintah Non-Transaksi
  if (cleanT.startsWith("saldo")) {
    return { type: "saldo", account: ACCOUNTS.find(a => cleanT.includes(a)) || "ALL" };
  }
  if (cleanT.startsWith("rekap")) {
    return { type: "rekap", filter: cleanT };
  }
  if (cleanT.startsWith("export")) {
    return { type: "export" };
  }

  // 3. Logika Transaksi
  const amt = parseAmount(cleanText);
  if (!amt) return { type: "unknown" };

  const { category } = detectCategory(cleanText);

  return {
    type: "tx",
    user: user,
    account: ACCOUNTS.find(a => cleanT.includes(a)) || "cash",
    amount: (cleanT.includes("gaji") || cleanT.includes("masuk")) ? amt : -amt,
    category: category,
    note: cleanText
  };
}
