import { pollUpdates } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getSaldo, getRekapRaw } from "./db.js";

initDB();

function fmt(n) {
  return n.toLocaleString("id-ID");
}

async function handleMessage(msg) {
  const text = msg.text.trim();
  const p = parseInput(text);

  if (p.type === "saldo") {
    const s = getSaldo(p.account, true);
    return `💰 SALDO ${p.account.toUpperCase()}
━━━━━━━━━━━━
Rp ${fmt(s)}`;
  }

  if (p.type === "rekap") {
    const r = getRekapRaw();
    return `📊 REKAP KEUANGAN
━━━━━━━━━━━━
Pemasukan : Rp ${fmt(r.income)}
Pengeluaran: Rp ${fmt(Math.abs(r.expense))}
━━━━━━━━━━━━
NET        : Rp ${fmt(r.net)}`;
  }

  if (p.type === "tx") {
    addTx(p);
    const saldo = getSaldo(p.account, true);

    return `✅ TRANSAKSI TERCATAT
━━━━━━━━━━━━
User   : ${p.user}
Akun   : ${p.account.toUpperCase()}
Kategori: ${p.category}
Jumlah : Rp ${fmt(Math.abs(p.amount))}
━━━━━━━━━━━━
Saldo ${p.account.toUpperCase()}
Rp ${fmt(saldo)}`;
  }

  return "⚠️ Perintah tidak dikenali";
}

pollUpdates(handleMessage);

console.log("MY FINANCE BOT (POLLING + UI) RUNNING");
