import { getAllLedger } from "./ledger.js";

const fmt = n => Number(n).toLocaleString("id-ID");

export function exportText() {
  const rows = getAllLedger();
  return rows.map(r =>
    `${r.ts} | ${r.user} | ${r.account.toUpperCase()} | ${fmt(r.amount)} | ${r.category}`
  ).join("\n");
}
