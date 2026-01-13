import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay"];

export function parseInput(text, senderId) {
  const t = text.toLowerCase();
  const ID_MALVIN = 5023700044;
  const ID_YOVITA = 8469259152;

  let user = "";
  let cleanText = text;

  // Logika Deteksi User (Manual memiliki prioritas lebih tinggi)
  if (t.startsWith("y ")) {
    user = "Y";
    cleanText = text.substring(2).trim();
  } else if (t.startsWith("m ")) {
    user = "M";
    cleanText = text.substring(2).trim();
  } else {
    user = (senderId === ID_YOVITA) ? "Y" : "M";
  }

  const cleanT = cleanText.toLowerCase();

  // Menu perintah
  if (cleanT === "saldo") return { type: "saldo", account: "ALL" };
  if (cleanT.startsWith("saldo ")) return { type: "saldo", account: ACCOUNTS.find(a => cleanT.includes(a)) || "ALL" };
  if (cleanT.startsWith("rekap")) return { type: "rekap", filter: cleanT };
  if (cleanT === "history") return { type: "history" };

  // Parsing Angka
  const m = cleanT.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/);
  if (!m) return { type: "unknown" };

  let n = m[1].replace(/\./g, "").replace(",", ".");
  let v = parseFloat(n);
  const u = m[2] || "";
  if (["k", "rb", "ribu"].includes(u)) v *= 1000;
  if (["jt", "juta"].includes(u)) v *= 1_000_000;
  const amt = Math.round(v);

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
