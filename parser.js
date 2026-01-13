const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay"];

function parseAmount(text) {
  const m = text.toLowerCase().match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/);
  if (!m) return null;

  let num = m[1];
  if (num.includes(".") && num.includes(",")) {
    num = num.replace(/\./g, "").replace(",", ".");
  } else {
    num = num.replace(",", ".");
  }

  let val = parseFloat(num);
  if (isNaN(val)) return null;

  const u = m[2] || "";
  if (["k", "rb", "ribu"].includes(u)) val *= 1000;
  if (["jt", "juta"].includes(u)) val *= 1000000;

  return Math.round(val);
}

export function parseInput(text) {
  const t = text.toLowerCase().trim();

  if (t.startsWith("saldo")) {
    const acc = ACCOUNTS.find(a => t.includes(a)) || "ALL";
    return { type: "saldo", account: acc };
  }

  if (t.startsWith("rekap")) {
    return { type: "rekap" };
  }

  const amount = parseAmount(t);
  if (!amount) return { type: "unknown" };

  const account = ACCOUNTS.find(a => t.includes(a)) || "cash";
  const user = t.startsWith("y ") ? "Y" : "M";
  const category = t.includes("makan") ? "Makan" : "Lainnya";
  const signed = t.includes("gaji") ? amount : -amount;

  return {
    type: "tx",
    user,
    account,
    amount: signed,
    category,
    note: text
  };
}
