import express from "express";
import fs from 'fs';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, getTotalCCHariIni, resetAccountBalance, setBudget, getBudgetStatus, getChartData, getBudgetSummary, getFilteredTransactions, getCashflowSummary, deleteLastTx } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet } from "./sheets.js";
import { CATEGORIES } from "./categories.js";

const app = express();
app.get("/", (req, res) => res.send("Bot MaYo Aktif"));
const port = process.env.PORT || 3000;
app.listen(port);

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";
const LIQUID = ["cash", "bca", "ovo", "gopay", "shopeepay"];

const pendingTxs = {};

// --- AUTO BACKUP 23:59 WIB ---
cron.schedule('59 23 * * *', async () => {
  const date = new Date().toISOString().slice(0, 10);
  const file = `myfinance_backup_${date}.db`;
  try {
    if (fs.existsSync('myfinance.db')) {
      fs.copyFileSync('myfinance.db', file);
      await sendDocument(5023700044, file, `📂 **DAILY BACKUP**\n${line}\n📅: \`${date}\`\n✅ Database aman.`);
      fs.unlinkSync(file);
    }
  } catch (e) { console.error(e); }
}, { timezone: "Asia/Jakarta" });

// Reminder CC 21:00
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 21 && now.getMinutes() === 0) {
    const cc = getTotalCCHariIni();
    if (cc && cc.total < 0) sendMessage(5023700044, `🔔 *REMINDER CC*\n${line}\nTagihan CC hari ini: *${fmt(Math.abs(cc.total))}*\nJangan lupa dilunasi! 💳`); 
  }
}, 60000);

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  if (![5023700044, 8469259152].includes(senderId)) return;
  const text = msg.text.trim().toLowerCase();

  if (pendingTxs[chatId]) {
    const matched = CATEGORIES.find(c => c.cat.toLowerCase() === text);
    if (matched) {
      const p = pendingTxs[chatId]; p.category = matched.cat;
      if (p.category === "Pendapatan") p.amount = Math.abs(p.amount);
      delete pendingTxs[chatId]; addTx(p); appendToSheet(p).catch(console.error);
      return `✅ *TERCATAT DI ${p.category.toUpperCase()}*\n└ \`${fmt(Math.abs(p.amount))}\` (${p.user} | ${p.account.toUpperCase()})`;
    } else if (text === "batal") { delete pendingTxs[chatId]; return "❌ Dibatalkan."; }
    else { return `⚠️ Pilih kategori:\n${CATEGORIES.map(c => `• \`${c.cat.toLowerCase()}\``).join('\n')}`; }
  }

  const results = parseInput(msg.text, senderId);
  if (!results.length) return;

  let replies = [];
  for (let p of results) {
    try {
      if (p.type === "list") {
        let out = `📜 *DAFTAR PERINTAH LENGKAP*\n${line}\n`;
        out += `💰 *Saldo & Akun*\n├ \`set saldo bca 10jt\`\n├ \`pindah 1jt bca gopay\`\n└ \`rekap\` atau \`saldo\`\n\n`;
        out += `📉 *Transaksi Belanja*\n├ \`50k makan bca\`\n├ \`cc 100k bensin\`\n└ \`koreksi\` (Hapus input terakhir)\n\n`;
        out += `📈 *Pendapatan*\n└ \`10jt gaji bca\` (Auto +)\n\n`;
        out += `⚙️ *Sistem*\n├ \`backup\` (File .db)\n└ \`export pdf\` (Download)\n${line}`;
        replies.push(out);
      } else if (p.type === "rekap") {
        const d = getRekapLengkap();
        const cf = getCashflowSummary();
        const budgets = getBudgetSummary();
        const cc = getTotalCCHariIni();
        let out = `📊 *LAPORAN KEUANGAN KELUARGA*\n${line}\n`;
        [...new Set(d.rows.map(r => r.user))].forEach(u => {
          out += `\n*${u === 'M' ? '🧔 MALVIN' : '👩 YOVITA'}*\n`;
          const liq = d.rows.filter(r => r.user === u && LIQUID.includes(r.account));
          if (liq.length > 0) {
            out += ` 💧 *Liquid*\n`;
            liq.forEach(a => out += `  ├ \`${a.account.toUpperCase().padEnd(10)}\`: \`${fmt(a.balance).padStart(14)}\`\n`);
          }
          const ast = d.rows.filter(r => r.user === u && !LIQUID.includes(r.account) && r.account !== 'cc');
          if (ast.length > 0) {
            out += ` 💰 *Assets*\n`;
            ast.forEach(a => out += `  ├ \`${a.account.toUpperCase().padEnd(10)}\`: \`${fmt(a.balance).padStart(14)}\`\n`);
          }
          const total = d.rows.filter(r => r.user === u && r.account !== 'cc').reduce((a, b) => a + b.balance, 0);
          out += ` └ *Total Net:* \`${fmt(total).padStart(14)}\`\n`;
        });
        out += `\n📈 *CASHFLOW BULAN INI*\n 📥 *In  :*\`${fmt(cf.income).padStart(14)}\`\n 📤 *Out :*\`${fmt(cf.expense).padStart(14)}\`\n 💰 *Net :*\`${fmt(cf.income - cf.expense).padStart(14)}\`\n`;
        if (budgets.length > 0) {
          out += `\n🎯 *BUDGET SISA*\n`;
          budgets.forEach(b => out += ` ${b.spent > b.limit ? '🔴' : '🟢'} *${b.category}*: \`${fmt(b.limit - b.spent)}\` sisa\n`);
        }
        out += `\n💳 *CC HARI INI:* \`${fmt(Math.abs(cc.total || 0))}\`\n${line}\n🌍 *NET WORTH:* **${fmt(d.totalWealth)}**\n`;
        replies.push(out);
      } else if (p.type === "backup") {
        const file = `myfinance_manual.db`;
        fs.copyFileSync('myfinance.db', file);
        await sendDocument(chatId, file, `✅ **BACKUP SELESAI**`);
        fs.unlinkSync(file);
      } else if (p.type === "koreksi") {
        const del = deleteLastTx(p.user);
        replies.push(del ? `🗑️ *KOREKSI BERHASIL*\nDihapus: "${del.note}"` : "❌ Kosong.");
      } else if (p.type === "set_saldo") {
        resetAccountBalance(p.user, p.account);
        addTx({ ...p, category: "Saldo Awal" });
        replies.push(`💰 *SET SALDO ${p.account.toUpperCase()} BERHASIL*`);
      } else if (p.type === "transfer_akun") {
        addTx({ ...p, account: p.from, amount: -p.amount, category: "Transfer" });
        addTx({ ...p, account: p.to, amount: p.amount, category: "Transfer" });
        replies.push(`🔄 *TRANSFER ${p.from.toUpperCase()} ➔ ${p.to.toUpperCase()}*`);
      } else if (p.type === "tx") {
        if (p.category === "Lainnya") {
          pendingTxs[chatId] = p;
          replies.push(`❓ *KATEGORI TIDAK DIKENAL*\nUntuk: "${p.note}"\n\nPilih kategori:\n${CATEGORIES.map(c => `• \`${c.cat.toLowerCase()}\``).join('\n')}`);
        } else {
          addTx(p);
          replies.push(`${p.amount > 0 ? "📈" : "📉"} *${p.category.toUpperCase()}*\n└ \`${fmt(Math.abs(p.amount))}\` (${p.user} | ${p.account.toUpperCase()})`);
          appendToSheet(p).catch(console.error);
        }
      }
    } catch (e) { replies.push("❌ Error."); }
  }
  return replies.join('\n\n');
}

pollUpdates(handleMessage);
