import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay", "bibit", "emas"];

export function parseInput(text, senderId) {
  return text.split('\n').filter(l => l.trim()).map(line => parseLine(line, senderId));
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

  if (cleanT.startsWith("set budget ")) {
    const parts = cleanT.split(" ");
    return { type: "set_budget", category: parts[2], amount: extractAmount(cleanT) };
  }
  if (cleanT === "cek budget") return { type: "cek_budget" };
  if (cleanT.startsWith("cari ")) return { type: "search", query: cleanT.replace("cari ", "").trim() };
  if (cleanT.startsWith("history ")) return { type: "history_period", period: cleanT.replace("history ", "").trim() };
  if (cleanT.startsWith("set saldo ")) {
    const acc = ACCOUNTS.find(a => cleanT.includes(a)) || "cash";
    return { type: "set_saldo", user, account: acc, amount: extractAmount(cleanT), note: "Set Saldo Awal" };
  }
  if (cleanT.startsWith("pindah ")) {
    const amount = extractAmount(cleanT);
    const from = ACCOUNTS.find(a => cleanT.includes(a)) || "bca";
    const to = ACCOUNTS.filter(a => a !== from).find(a => cleanT.includes(a)) || "cash";
    return { type: "transfer_akun", user, from, to, amount };
  }
  if (cleanT.startsWith("kasih ")) {
    const target = (cleanT.includes(" y ") || cleanT.endsWith(" y")) ? "Y" : "M";
    return { type: "transfer_user", fromUser: user, toUser: target, amount: extractAmount(cleanT), account: ACCOUNTS.find(a => cleanT.includes(a)) || "cash" };
  }

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

function extractAmount(t) {
  const m = t.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/);
  if (!m) return 0;
  let v = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  const u = m[2] || "";
  if (["k", "rb", "ribu"].includes(u)) v *= 1000;
  if (["jt", "juta"].includes(u)) v *= 1_000_000;
  return Math.round(v);
}
