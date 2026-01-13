import { pollUpdates } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getSaldo } from "./db.js";
import { getRekapRaw } from "./aggregate.js";

initDB();

const fmt = n => `Rp ${Number(n).toLocaleString("id-ID")}`;

async function handleMessage(msg) {
  const text = msg.text.trim();
  const p = parseInput(text);

  if (p.type === "saldo") {
    const saldo = getSaldo(p.account, true);
    return `💰 SALDO ${p.account.toUpperCase()}
━━━━━━━━━━━━
${fmt(saldo)}`;
  }

  if (p.type === "rekap") {
    const r = getRekapRaw();
    return `📊 REKAP KEUANGAN
━━━━━━━━━━━━
Pemasukan  : ${fmt(r.income)}
Pengeluaran: ${fmt(Math.abs(r.expense))}
━━━━━━━━━━━━
NET        : ${fmt(r.net)}`;
  }

  if (p.type === "tx") {
    addTx(p);
    const saldo = getSaldo(p.account, true);

    return `✅ TRANSAKSI TERCATAT
━━━━━━━━━━━━
User     : ${p.user}
Akun     : ${p.account.toUpperCase()}
Kategori : ${p.category}
Jumlah   : ${fmt(Math.abs(p.amount))}
━━━━━━━━━━━━
Saldo ${p.account.toUpperCase()}
${fmt(saldo)}`;
  }

  return "⚠️ Perintah tidak dikenali";
}

pollUpdates(handleMessage);

console.log("MY FINANCE BOT (POLLING + UI) RUNNING");
