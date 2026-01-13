const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay"];

function parseAmount(t) {
  const m = t.match(/([\d.,]+)\s*(rb|ribu|jt|juta)?/i);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  const u = (m[2] || "").toLowerCase();
  if (u.startsWith("rb") || u.startsWith("ribu")) n *= 1000;
  if (u.startsWith("jt") || u.startsWith("juta")) n *= 1000000;
  return Math.round(n);
}

export function parseInput(text, sender) {
  const t = text.toLowerCase();

  // saldo
  if (t.startsWith("saldo")) {
    const acc = ACCOUNTS.find(a => t.includes(a));
    return { type: "saldo", account: acc || "ALL" };
  }

  // rekap
  if (t.startsWith("rekap")) {
    return { type: "rekap" };
  }

  // transaksi (default)
  const amount = parseAmount(t);
  if (!amount) return { type: "unknown" };

  const account = ACCOUNTS.find(a => t.includes(a)) || "cash";
  const user = t.includes(" y ") || t.startsWith("y ") ? "Y" : "M";
  const category = t.includes("makan") ? "Makan" : "Lainnya";

  // expense default negatif
  const signed = t.includes("gaji") ? amount : -amount;

  return {
    type: "tx",
    user,
    account,
    amount: signed,
    category,
    note: text,
    sender
  };
}
