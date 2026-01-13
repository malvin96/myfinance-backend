import express from "express";
import { pollUpdates } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getSaldo, getRekapLengkap, getHistory, getBudgetValue, getTotalExpenseMonth } from "./db.js";
import { appendToSheet } from "./sheets.js";

const app = express();
app.get("/", (req, res) => res.send("Bot Aktif"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => `Rp ${Number(n).toLocaleString("id-ID")}`;

async function handleMessage(msg) {
  const senderId = msg.from.id;
  if (![5023700044, 8469259152].includes(senderId)) return;

  const results = parseInput(msg.text, senderId);
  const line = "━━━━━━━━━━━━━━━━━━";

  // Mode Rekap / Saldo / History (Hanya jika 1 baris input)
  if (results.length === 1) {
    const p = results[0];
    if (p.type === "rekap") {
      const d = getRekapLengkap();
      let out = `📊 *REKAPITULASI KEUANGAN*\n${line}\n\n👤 *PER USER*\n`;
      d.perUser.forEach(u => out += `• ${u.user === 'M' ? 'Malvin' : 'Yovita'} : \`${fmt(u.balance)}\`\n`);
      out += `\n🏦 *SALDO AKUN*\n`;
      d.perAccount.forEach(a => out += `• ${a.account.toUpperCase().padEnd(8)} : \`${fmt(a.balance)}\`\n`);
      out += `\n📈 *STATISTIK*\n🟢 Masuk: ${fmt(d.total.income)}\n🔴 Keluar: ${fmt(Math.abs(d.total.expense))}\n${line}\n💰 *NET SISA*: *${fmt(d.total.net)}*`;
      return out;
    }
    if (p.type === "saldo") return `💰 *SALDO ${p.account.toUpperCase()}*\n${line}\n*Total*: \`${fmt(getSaldo(p.account))}\``;
    if (p.type === "history") return `📜 *10 TRANSAKSI TERAKHIR*\n${line}\n` + getHistory().map(r => `• ${r.user} | \`${fmt(r.amount)}\` | ${r.note}`).join('\n');
  }

  // Mode Transaksi (Batch/Single)
  let replies = [];
  for (let p of results) {
    if (p.type === "tx") {
      addTx(p); await appendToSheet(p);
      const limit = getBudgetValue(p.category);
      const used = getTotalExpenseMonth(p.category);
      const warn = (limit && used > limit) ? `\n⚠️ *OVER BUDGET!* (${fmt(used)}/${fmt(limit)})` : '';
      replies.push(`✅ *${p.category}* : \`${fmt(Math.abs(p.amount))}\` (${p.user})${warn}`);
    } else if (p.type === "set_saldo") {
      addTx({ ...p, category: "Saldo Awal", amount: p.amount }); await appendToSheet(p);
      replies.push(`💰 *Saldo ${p.account.toUpperCase()}* diset ke \`${fmt(p.amount)}\``);
    } else if (p.type === "transfer_akun") {
      addTx({ user: p.user, account: p.from, amount: -p.amount, category: "Transfer", note: `Ke ${p.to}` });
      addTx({ user: p.user, account: p.to, amount: p.amount, category: "Transfer", note: `Dari ${p.from}` });
      await appendToSheet(p);
      replies.push(`🔄 *${p.from.toUpperCase()} ➔ ${p.to.toUpperCase()}* : \`${fmt(p.amount)}\``);
    } else if (p.type === "transfer_user") {
      addTx({ user: p.fromUser, account: p.account, amount: -p.amount, category: "Transfer User", note: `Kasih ke ${p.toUser}` });
      addTx({ user: p.toUser, account: p.account, amount: p.amount, category: "Transfer User", note: `Terima dari ${p.fromUser}` });
      await appendToSheet(p);
      replies.push(`🎁 *${p.fromUser} ➔ ${p.toUser}* : \`${fmt(p.amount)}\` (${p.account.toUpperCase()})`);
    }
  }
  return replies.join('\n') || "⚠️ Perintah tidak dipahami.";
}

pollUpdates(handleMessage);
