const ACCOUNTS = ["cash","bca","ovo","gopay","shopeepay"];

function parseAmount(t) {
  const m = t.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/);
  if (!m) return null;

  let n = m[1];
  if (n.includes(".") && n.includes(",")) n = n.replace(/\./g,"").replace(",",".");
  else n = n.replace(",",".");
  let v = parseFloat(n);
  if (isNaN(v)) return null;

  const u = m[2] || "";
  if (["k","rb","ribu"].includes(u)) v *= 1000;
  if (["jt","juta"].includes(u)) v *= 1_000_000;
  return Math.round(v);
}

export function parseInput(text) {
  const t = text.toLowerCase();

  if (t.startsWith("saldo")) {
    return { type:"saldo", account: ACCOUNTS.find(a=>t.includes(a)) || "ALL" };
  }

  if (t.startsWith("rekap")) {
    return { type:"rekap", filter:t };
  }

  if (t.startsWith("history")) {
    return { type:"history", filter:t };
  }

  if (t.startsWith("edit")) {
    return { type:"edit", account: ACCOUNTS.find(a=>t.includes(a)), newAmount: parseAmount(t) };
  }

  if (t.startsWith("set budget")) {
    return { type:"set_budget", category:"makan", amount: parseAmount(t) };
  }

  if (t.startsWith("cek budget")) {
    return { type:"budget_status" };
  }

  if (t.startsWith("ingatkan")) {
    return { type:"reminder", raw:t };
  }

  if (t.startsWith("export")) {
    return { type:"export" };
  }

  const amt = parseAmount(t);
  if (!amt) return { type:"unknown" };

  return {
    type:"tx",
    user: t.startsWith("y ") ? "Y" : "M",
    account: ACCOUNTS.find(a=>t.includes(a)) || "cash",
    amount: t.includes("gaji") ? amt : -amt,
    category: t.includes("makan") ? "Makan" : "Lainnya",
    note: text
  };
}
