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
const LIQUID_ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay"];

const pendingTxs = {};

// --- AUTO BACKUP 23:59 WIB ---
cron.schedule('59 23 * * *', async () => {
  const date = new Date().toISOString().slice(0, 10);
  const backupFile = `myfinance_backup_${date}.db`;
  try {
    if (fs.existsSync('myfinance.db')) {
      fs.copyFileSync('myfinance.db', backupFile);
      await sendDocument(5023700044, backupFile, `📂 **DAILY BACKUP**\n${line}\n📅: \`${date}\`\n✅ Database aman.`);
      fs.unlinkSync(backupFile);
    }
  } catch (e) { console.error(e); }
}, { timezone: "Asia/Jakarta" });

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  if (![5023700044, 8469259152].includes(senderId)) return;
  const text = msg.text.trim().toLowerCase();

  // Manual Backup
  if (text === "backup") {
    await sendMessage(chatId, "⏳ *Menyiapkan database...*");
    const file = `myfinance_manual.db`;
    try {
      fs.copyFileSync('myfinance.db', file);
      await sendDocument(chatId, file, `✅ **BACKUP SELESAI**`);
      fs.unlinkSync(file);
    } catch (e) { await sendMessage(chatId, "❌ Gagal."); }
    return;
  }

  // Pending Category Handler
  if (pendingTxs[chatId]) {
    const matched = CATEGORIES.find(c => c.cat.toLowerCase() === text);
    if (matched) {
      const p = pendingTxs[chatId];
      p.category = matched.cat;
      if (p.category === "Pendapatan") p.amount = Math.abs(p.amount);
      delete pendingTxs[chatId];
      addTx(p);
      appendToSheet(p).catch(e => console.error(e));
      return `✅ *TERCATAT DI ${p.category.toUpperCase()}*\n└ \`${fmt(Math.abs(p.amount))}\` (${p.user} | ${p.account.toUpperCase()})`;
    } else if (text === "batal") {
      delete pendingTxs[chatId];
      return "❌ Transaksi dibatalkan.";
    } else {
      return `⚠️ Pilih kategori:\n${CATEGORIES.map(c => `• \`${c.cat.toLowerCase()}\``).join('\n')}`;
    }
  }

  const results = parseInput(msg.text, senderId);
  if (!results.length) return;

  // UI LIST PERINTAH
  if (results.length === 1 && results[0].type === "list") {
    let out = `📜 *DAFTAR PERINTAH LENGKAP*\n${line}\n`;
    out += `💰 *Saldo & Akun*\n├ \`set saldo bca 10jt\`\n├ \`pindah 1jt bca gopay\`\n└ \`rekap\` atau \`saldo\`\n\n`;
    out += `📉 *Transaksi Belanja*\n├ \`50k makan bca\`\n├ \`cc 100k bensin\`\n└ \`koreksi\` (Hapus input terakhir)\n\n`;
    out += `📈 *Pendapatan*\n└ \`10jt gaji bca\` (Auto +)\n\n`;
    out += `⚙️ *Sistem*\n├ \`backup\` (File .db)\n└ \`export pdf\` (Download)\n${line}`;
    return out;
  }

  // Laporan Rekap
  if (results.length === 1 && results[0].type === "rekap") {
    const d = getRekapLengkap();
    const catData = getChartData();
    const budgets = getBudgetSummary();
    const cc = getTotalCCHariIni();
    const cf = getCashflowSummary();
    let out = `📊 *LAPORAN KEUANGAN KELUARGA*\n${line}\n`;
    
    [...new Set(d.rows.map(r => r.user))].forEach(u => {
      out += `\n*${u === 'M' ? '🧔 MALVIN' : '👩 YOVITA'}*\n`;
      const liquid = d.rows.filter(r => r.user === u && LIQUID_ACCOUNTS.includes(r.account));
      if (liquid.length > 0) {
        out += ` 💧 *Liquid*\n`;
        liquid.forEach(a => out += `  ├ \`${a.account.toUpperCase().padEnd(8)}\`: \`${fmt(a.balance).padStart(13)}\`\n`);
      }
      const userTotal = d.rows.filter(r => r.user === u && r.account !== 'cc').reduce((a, b) => a + b.balance, 0);
      out += ` └ *Total Net:* \`${fmt(userTotal).padStart(13)}\`\n`;
    });

    const netSavings = cf.income - cf.expense;
    out += `\n📈 *CASHFLOW*\n 📥 *In* : \`${fmt(cf.income).padStart(13)}\`\n 📤 *Out* : \`${fmt(cf.expense).padStart(13)}\`\n 💰 *Net* : \`${fmt(netSavings).padStart(13)}\`\n`;
    
    if (budgets.length > 0) {
      out += `\n🎯 *BUDGET SISA*\n`;
      budgets.forEach(b => out += ` ${b.spent > b.limit ? '🔴' : '🟢'} *${b.category}*: \`${fmt(b.limit - b.spent)}\` sisa\n`);
    }

    out += `\n💳 *CC HARI INI:* \`${fmt(Math.abs(cc.total || 0))}\`\n${line}\n🌍 *NET WORTH:* *${fmt(d.totalWealth)}*\n`;
    return out;
  }

  let replies = [];
  for (let p of results) {
    try {
      if (p.type === "export_pdf") {
        const data = getFilteredTransactions(p.filter);
        const filePath = await createPDF(data, p.filter.title);
        await sendDocument(chatId, filePath);
        fs.unlinkSync(filePath); 
        continue;
      } else if (p.type === "koreksi") {
        const del = deleteLastTx(p.user);
        replies.push(del ? `🗑️ *KOREKSI BERHASIL*\nDihapus: "${del.note}"` : "❌ Kosong.");
      } else if (p.type === "set_saldo") {
        resetAccountBalance(p.user, p.account);
        addTx({ ...p, category: "Saldo Awal" });
        replies.push(`💰 *SET SALDO ${p.account.toUpperCase()}*`);
      } else if (p.type === "transfer_akun") {
        addTx({ ...p, account: p.from, amount: -p.amount, category: "Transfer" });
        addTx({ ...p, account: p.to, amount: p.amount, category: "Transfer" });
        replies.push(`🔄 *TRANSFER ${p.from.toUpperCase()} ➔ ${p.to.toUpperCase()}*`);
      } else if (p.type === "tx") {
        if (p.category === "Lainnya") {
          pendingTxs[chatId] = p;
          replies.push(`❓ *KATEGORI TIDAK DIKENAL*\nUntuk: "${p.note}"\n\nPilih kategori:\n${CATEGORIES.map(c => `• \`${c.cat.toLowerCase()}\``).join('\n')}`);
        } else {
          if (p.category === "Pendapatan") p.amount = Math.abs(p.amount);
          addTx(p);
          let msgReply = `${p.amount > 0 ? "📈" : "📉"} *${p.category.toUpperCase()}*\n└ \`${fmt(Math.abs(p.amount))}\` (${p.user} | ${p.account.toUpperCase()})`;
          replies.push(msgReply);
          appendToSheet(p).catch(console.error);
        }
      }
    } catch (e) { replies.push("❌ Error."); }
  }
  return replies.join('\n\n');
}

pollUpdates(handleMessage);
