import { detectCategory } from "./categories.js"; // Import logika kategori

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay"];

function parseAmount(t) {
  const m = t.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/);
  if (!m) return null;

  let n = m[1];
  if (n.includes(".") && n.includes(",")) n = n.replace(/\./g, "").replace(",", ".");
  else n = n.replace(",", ".");
  let v = parseFloat(n);
  if (isNaN(v)) return null;

  const u = m[2] || "";
  if (["k", "rb", "ribu"].includes(u)) v *= 1000;
  if (["jt", "juta"].includes(u)) v *= 1_000_000;
  return Math.round(v);
}

export function parseInput(text) {
  const t = text.toLowerCase();

  if (t.startsWith("saldo")) {
    return { type: "saldo", account: ACCOUNTS.find(a => t.includes(a)) || "ALL" };
  }

  // ... (logika rekap, history, edit, dll tetap sama)

  const amt = parseAmount(t);
  if (!amt) return { type: "unknown" };

  // INTEGRASI CATEGORIES.JS
  const { category } = detectCategory(t); // Otomatis mendeteksi dari keyword

  return {
    type: "tx",
    user: t.startsWith("y ") ? "Y" : "M",
    account: ACCOUNTS.find(a => t.includes(a)) || "cash",
    amount: t.includes("gaji") ? amt : -amt,
    category: category, // Menggunakan hasil deteksi
    note: text
  };
}
