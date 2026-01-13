import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay"];

export function parseInput(text, senderId) {
  const t = text.toLowerCase();
  
  // DATA ID DARI HASIL CEK IDBOT
  const ID_MALVIN = 5023700044;
  const ID_YOVITA = 8469259152;

  let user = "";
  let cleanText = text;

  // 1. LOGIKA IDENTITAS (Prioritas Manual > Otomatis)
  if (t.startsWith("y ")) {
    user = "Y";
    cleanText = text.substring(2).trim();
  } else if (t.startsWith("m ")) {
    user = "M";
    cleanText = text.substring(2).trim();
  } else {
    // Otomatis: Jika ID pengirim adalah Yovita, maka Y. Selain itu M.
    user = (senderId === ID_YOVITA) ? "Y" : "M";
  }

  const cleanT = cleanText.toLowerCase();

  // 2. LOGIKA PERINTAH NON-TRANSAKSI
  if (cleanT === "saldo") return { type: "saldo", account: "ALL" };
  if (cleanT.startsWith("saldo ")) return { type: "saldo", account: ACCOUNTS.find(a => cleanT.includes(a)) || "ALL" };
  if (cleanT.startsWith("rekap")) return { type: "rekap", filter: cleanT };
  if (cleanT.startsWith("edit ")) return { type: "edit", newAmount: parseAmount(cleanT), account: ACCOUNTS.find(a => cleanT.includes(a)) };
  if (cleanT === "history") return { type: "history" };

  // 3. LOGIKA TRANSAKSI
  const amt = parseAmount(cleanT);
  if (!amt) return { type: "unknown" };

  const { category } = detectCategory(cleanT);

  return {
    type: "tx",
    user: user,
    account: ACCOUNTS.find(a => cleanT.includes(a)) || "cash",
    amount: (cleanT.includes("gaji") || cleanT.includes("masuk")) ? amt : -amt,
    category: category,
    note: cleanText
  };
}

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
