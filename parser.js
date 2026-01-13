import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash","bca","ovo","gopay","shopeepay"];

function parseAmount(t) {
  const m = t.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/);
  if (!m) return null;
  let n = m[1].replace(/\./g,"").replace(",",".");
  let v = parseFloat(n);
  const u = m[2] || "";
  if (["k","rb","ribu"].includes(u)) v *= 1000;
  if (["jt","juta"].includes(u)) v *= 1_000_000;
  return Math.round(v);
}

export function parseInput(text) {
  const t = text.toLowerCase();
  if (t.startsWith("saldo")) return { type:"saldo", account: ACCOUNTS.find(a=>t.includes(a)) || "ALL" };
  if (t.startsWith("rekap")) return { type:"rekap", filter:t };
  
  const amt = parseAmount(t);
  if (!amt) return { type:"unknown" };

  const { category } = detectCategory(t);

  return {
    type:"tx",
    user: t.startsWith("y ") ? "Y" : "M",
    account: ACCOUNTS.find(a=>t.includes(a)) || "cash",
    amount: (t.includes("gaji") || t.includes("masuk")) ? amt : -amt,
    category: category,
    note: text
  };
}
