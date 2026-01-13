import express from "express";
import { pollUpdates } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getSaldo, getHistory, setInitialSaldo, getBudgetValue, getTotalExpenseMonth } from "./db.js";
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
  let replies = [];

  for (let p of results) {
    if (p.type === "tx") {
      addTx(p);
      await appendToSheet(p);
      const limit = getBudgetValue(p.category);
      const used = getTotalExpenseMonth(p.category);
      const budgetWarn = (limit && used > limit) ? `\n⚠️ OVER BUDGET! (${fmt(used)}/${fmt(limit)})` : '';
      replies.push(`✅ ${p.category}: ${fmt(Math.abs(p.amount))} (${p.user})${budgetWarn}`);
    } 
    else if (p.type === "set_saldo") {
      setInitialSaldo(p);
      await appendToSheet(p);
      replies.push(`💰 Saldo ${p.account.toUpperCase()} diset ke ${fmt(p.amount)}`);
    }
    else if (p.type === "transfer_akun") {
      addTx({ user: p.user, account: p.from, amount: -p.amount, category: "Transfer", note: `Ke ${p.to}` });
      addTx({ user: p.user, account: p.to, amount: p.amount, category: "Transfer", note: `Dari ${p.from}` });
      await appendToSheet(p);
      replies.push(`🔄 ${p.from.toUpperCase()} ➔ ${p.to.toUpperCase()}: ${fmt(p.amount)}`);
    }
    else if (p.type === "transfer_user") {
      addTx({ user: p.fromUser, account: p.account, amount: -p.amount, category: "Transfer User", note: `Kasih ke ${p.toUser}` });
      addTx({ user: p.toUser, account: p.account, amount: p.amount, category: "Transfer User", note: `Terima dari ${p.fromUser}` });
      await appendToSheet(p);
      replies.push(`🎁 ${p.fromUser} ➔ ${p.toUser}: ${fmt(p.amount)}`);
    }
  }

  // Handle perintah non-transaksi (saldo/history) jika hanya 1 baris
  if (results.length === 1) {
    const p = results[0];
    if (p.type === "saldo") return `💰 Saldo ${p.account.toUpperCase()}: ${fmt(getSaldo(p.account))}`;
    if (p.type === "history") return `📜 Histori:\n` + getHistory().map(r => `${r.user}|${fmt(r.amount)}|${r.note}`).join('\n');
  }

  return replies.length ? replies.join('\n') : "⚠️ Perintah tidak dipahami.";
}

pollUpdates(handleMessage);
