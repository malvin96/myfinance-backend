import { getAllLedger } from "./db.js";

export function exportText() {
  const data = getAllLedger();
  if (!data.length) return "Belum ada data transaksi.";
  return data.map(r => `${r.ts} | ${r.user} | ${r.account.toUpperCase()} | ${r.amount} | ${r.note}`).join("\n");
}
