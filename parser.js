import { detectCategory } from "./categories.js";

const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay", "bibit", "emas", "mirrae", "bca sekuritas", "cc"];
const MONTHS = { jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", jun: "06", jul: "07", agu: "08", sep: "09", okt: "10", nov: "11", des: "12" };

function extractAmount(t) {
  const m = t.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/i);
  if (!m) return 0;
  let val = m[1].replace(/\./g, '').replace(',', '.');
  val = parseFloat(val) || 0;
  const unit = (m[2] || "").toLowerCase();
  if (["k", "rb", "ribu"].includes(unit)) val *= 1000;
  if (["jt", "juta"].includes(unit)) val *= 1000000;
  return val;
}

export function parseInput(text, senderId) {
  if (!text) return [];
  return text.split('\n').filter(l => l.trim()).map(line => parseLine(line, senderId));
}

function parseLine(text, senderId) {
  const rawLower = text.toLowerCase().trim();
  let user = (senderId === 8469259152) ? "Y" : "M";
  let cleanText = text;

  if (rawLower.startsWith("y ")) { user = "Y"; cleanText = text.substring(2).trim(); }
  else if (rawLower.startsWith("m ")) { user = "M"; cleanText = text.substring(2).trim(); }

  const cmd = cleanText.toLowerCase();

  if (cmd === "list" || cmd === "help") return { type: "list" };
  if (cmd === "koreksi" || cmd === "batal") return { type: "koreksi", user };
  if (cmd === "rekap" || cmd === "saldo") return { type: "rekap" };

  if (cmd.startsWith("export pdf")) {
    const sub = cmd.replace("export pdf", "").trim();
    if (!sub) return { type: "export_pdf", filter: { type: 'current', title: "Laporan Bulan Berjalan" } };
    if (sub === "all") return { type: "export_pdf", filter: { type: 'all', title: "Laporan Seluruh History" } };
    if (sub === "minggu") return { type: "export_pdf", filter: { type: 'week', title: "Laporan 7 Hari Terakhir" } };
    
    for (let m in MONTHS) {
      if (sub.includes(m)) {
        const yearMatch = sub.match(/\d+/);
        const yVal = yearMatch ? (yearMatch[0].length === 2 ? "20" + yearMatch[0] : yearMatch[0]) : new Date().getFullYear();
        return { type: "export_pdf", filter: { type: 'month', val: `${MONTHS[m]}-${yVal}`, title: `Laporan ${m.toUpperCase()} ${yVal}` } };
      }
    }
    return { type: "export_pdf", filter: { type: 'current', title: "Laporan" } };
  }

  if (cmd.startsWith("set budget ")) {
    const parts = cmd.split(" ");
    return { type: "set_budget", category: parts[2], amount: extractAmount(parts[3]) };
  }

  if (cmd.startsWith("cc ")) return { type: "tx", user, account: "cc", amount: -extractAmount(cmd), category: detectCategory(cmd).category, note: cleanText };
  if (cmd.startsWith("lunas cc")) return { type: "transfer_akun", user, from: ACCOUNTS.find(a => cmd.includes(a) && a !== "cc") || "bca", to: "cc", amount: extractAmount(cmd) };
  if (cmd.includes("set saldo")) return { type: "set_saldo", user, account: ACCOUNTS.find(a => cmd.includes(a)) || "cash", amount: extractAmount(cmd) };
  if (cmd.startsWith("pindah ")) return { type: "transfer_akun", user, from: ACCOUNTS.find(a => cmd.includes(a)) || "bca", to: ACCOUNTS.filter(a => a !== ACCOUNTS.find(a => cmd.includes(a))).find(a => cmd.includes(a)) || "cash", amount: extractAmount(cmd) };

  let amount = extractAmount(cmd);
  if (cmd.includes("kembali")) {
    const parts = cmd.split("kembali");
    amount = extractAmount(parts[0]) - extractAmount(parts[1]);
  }

  const account = ACCOUNTS.find(a => cmd.includes(a)) || "cash";
  const catObj = detectCategory(cmd);

  // LOGIKA INCOME: Jika kategori Pendapatan, nominal otomatis POSITIF
  const isIncome = catObj.category === "Pendapatan";

  return {
    type: "tx", user, account,
    amount: isIncome ? amount : -amount,
    category: catObj.category, note: cleanText
  };
}
