import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay"];

export function parseInput(text, senderId) {
  const lines = text.split('\n');
  const results = [];

  for (let line of lines) {
    if (!line.trim()) continue;
    results.push(parseLine(line, senderId));
  }
  return results;
}

function parseLine(text, senderId) {
  const t = text.toLowerCase();
  const ID_MALVIN = 5023700044;
  const ID_YOVITA = 8469259152;

  let user = (senderId === ID_YOVITA) ? "Y" : "M";
  let cleanText = text;

  if (t.startsWith("y ")) { user = "Y"; cleanText = text.substring(2).trim(); }
  else if (t.startsWith("m ")) { user = "M"; cleanText = text.substring(2).trim(); }

  const cleanT = cleanText.toLowerCase();

  // FITUR: SET SALDO
  if (cleanT.startsWith("set saldo ")) {
    const acc = ACCOUNTS.find(a => cleanT.includes(a)) || "cash";
    return { type: "set_saldo", user, account: acc, amount: extractAmount(cleanT), note: "Set Saldo Awal" };
  }

  // FITUR: TRANSFER ANTAR AKUN
  if (cleanT.startsWith("pindah ")) {
    const amount = extractAmount(cleanT);
    const from = ACCOUNTS.find(a => cleanT.includes(a)) || "bca";
    const to = ACCOUNTS.filter(a => a !== from).find(a => cleanT.includes(a)) || "cash";
    return { type: "transfer_akun", user, from, to, amount };
  }

  // FITUR: TRANSFER ANTAR USER
  if (cleanT.startsWith("kasih ")) {
    const target = (cleanT.includes(" y ") || cleanT.endsWith(" y")) ? "Y" : "M";
    const amount = extractAmount(cleanT);
    const acc = ACCOUNTS.find(a => cleanT.includes(a)) || "cash";
    return { type: "transfer_user", fromUser: user, toUser: target, amount, account: acc };
  }

  // FITUR: PENGHITUNGAN SEDERHANA (KEMBALIAN)
  let amount = extractAmount(cleanT);
  if (cleanT.includes("kembali")) {
    const parts = cleanT.split("kembali");
    const bayar = extractAmount(parts[0]);
    const kembali = extractAmount(parts[1]);
    if (bayar && kembali) amount = bayar - kembali;
  }

  const { category } = detectCategory(cleanT);
  const tag = (cleanT.match(/#(\w+)/) || [])[1] || "";

  return {
    type: "tx",
    user,
    account: ACCOUNTS.find(a => cleanT.includes(a)) || "cash",
    amount: (cleanT.includes("gaji") || cleanT.includes("masuk")) ? amount : -amount,
    category,
    tag,
    note: cleanText
  };
}

function extractAmount(t) {
  const m = t.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/);
  if (!m) return 0;
  let n = m[1].replace(/\./g, "").replace(",", ".");
  let v = parseFloat(n);
  const u = m[2] || "";
  if (["k", "rb", "ribu"].includes(u)) v *= 1000;
  if (["jt", "juta"].includes(u)) v *= 1_000_000;
  return Math.round(v);
}
