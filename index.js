import express from "express";
import fs from 'fs';
import { pollUpdates, sendMessage, sendDocument } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, getTotalCCHariIni, resetAccountBalance, setBudget, getBudgetStatus, getChartData, getBudgetSummary, getFilteredTransactions, getCashflowSummary, deleteLastTx } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet } from "./sheets.js";
import { CATEGORIES } from "./categories.js";

const app = express();
app.get("/", (req, res) => res.send("Bot Aktif"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━";
const LIQUID_ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay"];

const pendingTxs = {};

setInterval(() => {
  const now = new Date();
  if (now.getHours() === 21 && now.getMinutes() === 0) {
    const cc = getTotalCCHariIni();
    if (cc && cc.total < 0) {
      sendMessage(5023700044, `🔔 *REMINDER CC*\n${line}\nTagihan CC hari ini: *${fmt(Math.abs(cc.total))}*\nJangan lupa dilunasi malam ini! 💳`); 
    }
  }
}, 60000);

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  if (![5023700044, 8469259152].includes(senderId)) return;

  const text = msg.text.trim().toLowerCase();

  if (pendingTxs[chatId]) {
    const matchedCat = CATEGORIES.find(c => c.cat.toLowerCase() === text);
    if (matchedCat) {
      const p = pendingTxs[chatId];
      p.category = matchedCat.cat;
      delete pendingTxs[chatId];
      addTx(p);
      appendToSheet(p).catch(e => console.error(e));
      let res = `✅ *TERCATAT DI ${p.category.toUpperCase()}*\n└ \`${fmt(Math.abs(p.amount))}\` (${p.user} | ${p.account.toUpperCase()})`;
      const b = getBudgetStatus(p.category);
      if (b && p.amount < 0) res += `\n\n⚠️ *STATUS BUDGET*\n└ Sisa: \`${fmt(b.limit - b.spent)}\``;
      return res;
    } else if (text === "batal") {
      delete pendingTxs[chatId];
      return "❌ Transaksi dibatalkan.";
    } else {
      return `⚠️ Kategori *'${text}'* tidak ditemukan.\n\nBalas dengan salah satu:\n${CATEGORIES.map(c => `• \`${c.cat.toLowerCase()}\``).join('\n')}\n\nAtau ketik *'batal'*.`;
    }
  }

  const results = parseInput(msg.text, senderId);
  if (!results.length) return;

  if (results.length === 1 && results[0].type === "list") {
    let out = `📜 *RINGKASAN PERINTAH BOT*\n${line}\n`;
    out += `💰 *Akun & Saldo*\n├ \`set saldo bca 10jt\`\n└ \`pindah 1jt bca gopay\`\n\n`;
    out += `📉 *Transaksi*\n├ \`50k makan bca\`\n├ \`cc 100k bensin\`\n└ \`lunas cc bca 100k\`\n\n`;
    out += `📊 *Laporan*\n├ \`rekap\` (Cashflow & Aset)\n├ \`export pdf\` (Bulan ini)\n├ \`export pdf minggu\`\n└ \`export pdf all\`\n\n`;
    out += `⚙️ *Lainnya*\n├ \`koreksi\` (Hapus terakhir)\n└ \`list\` (Menu ini)\n${line}`;
    return out;
  }

  if (results.length === 1 && results[0].type === "rekap") {
    const d = getRekapLengkap();
    const catData = getChartData();
    const budgets = getBudgetSummary();
    const cc = getTotalCCHariIni();
    const cf = getCashflowSummary();
    let out = `📊 *LAPORAN KEUANGAN KELUARGA*\n${line}\n`;
    const users = [...new Set(d.rows.map(r => r.user))];
    users.forEach(u => {
      out += `\n*${u === 'M' ? '🧔 MALVIN' : '👩 YOVITA'}*\n`;
      const liquid = d.rows.filter(r => r.user === u && LIQUID_ACCOUNTS.includes(r.account));
      if (liquid.length > 0) {
        out += ` 💧 *Liquid*\n`;
        liquid.forEach(a => out += `  ├ \`${a.account.toUpperCase().padEnd(8)}\`: \`${fmt(a.balance).padStart(13)}\`\n`);
      }
      const assets = d.rows.filter(r => r.user === u && !LIQUID_ACCOUNTS.includes(r.account) && r.account !== 'cc');
      if (assets.length > 0) {
        out += ` 💰 *Assets*\n`;
        assets.forEach(a => out += `  ├ \`${a.account.toUpperCase().padEnd(8)}\`: \`${fmt(a.balance).padStart(13)}\`\n`);
      }
      const userTotal = d.rows.filter(r => r.user === u && r.account !== 'cc').reduce((a, b) => a + b.balance, 0);
      out += ` └ *Total Net:* \`${fmt(userTotal).padStart(13)}\`\n`;
    });
    const netSavings = cf.income - cf.expense;
    const savingRate = cf.income > 0 ? Math.round((netSavings / cf.income) * 100) : 0;
    out += `\n📈 *CASHFLOW BULAN INI*\n 📥 *In* : \`${fmt(cf.income).padStart(13)}\`\n 📤 *Out* : \`${fmt(cf.expense).padStart(13)}\`\n 💰 *Net* : \`${fmt(netSavings).padStart(13)}\`\n 🔄 *Rate*: \`${savingRate}% Saving Rate\`\n`;
    if (budgets.length > 0) {
      out += `\n🎯 *RINGKASAN BUDGET*\n`;
      budgets.forEach(b => {
        const sisa = b.limit - b.spent;
        out += ` ${sisa < 0 ? '🔴' : '🟢'} *${b.category}*: \`${fmt(sisa)}\` sisa\n`;
      });
    }
    out += `\n💳 *CC HARI INI:* \`${fmt(Math.abs(cc.total || 0))}\`\n${line}\n🌍 *NET WORTH GABUNGAN*\n👉 *${fmt(d.totalWealth)}*\n`;
    if (catData.length > 0) {
      const labels = catData.map(i => i.category);
      const values = catData.map(i => i.total);
      const chartUrl = `https://quickchart.io/chart?c={type:'doughnut',data:{labels:[${labels.map(l=>`'${l}'`)}],datasets:[{data:[${values}]}]}}`;
      out += `\n📈 *ANALISA PENGELUARAN*\n└ [Klik Lihat Grafik Donat](${chartUrl})`;
    }
    return out;
  }

  let replies = [];
  for (let p of results) {
    try {
      if (p.type === "set_budget") {
        setBudget(p.category, p.amount);
        replies.push(`🎯 Budget *${p.category}* diset ke \`${fmt(p.amount)}\``);
      } else if (p.type === "export_pdf") {
        const data = getFilteredTransactions(p.filter);
        const filePath = await createPDF(data, p.filter.title);
        await sendDocument(chatId, filePath);
        fs.unlinkSync(filePath); 
        continue;
      } else if (p.type === "koreksi") {
        const del = deleteLastTx(p.user);
        replies.push(del ? `🗑️ *KOREKSI BERHASIL*\nDihapus: "${del.note}"` : "❌ Tidak ada transaksi.");
      } else if (p.type === "set_saldo") {
        resetAccountBalance(p.user, p.account);
        addTx({ ...p, category: "Saldo Awal" });
        replies.push(`💰 *SET SALDO ${p.account.toUpperCase()} (${p.user}) - ${fmt(p.amount)}*`);
      } else if (p.type === "transfer_akun") {
        addTx({ ...p, account: p.from, amount: -p.amount, category: "Transfer" });
        addTx({ ...p, account: p.to, amount: p.amount, category: "Transfer" });
        replies.push(`🔄 *TRANSFER ${p.from.toUpperCase()} ➔ ${p.to.toUpperCase()} (${p.user}) - ${fmt(p.amount)}*`);
      } else if (p.type === "tx") {
        if (p.category === "Lainnya") {
          pendingTxs[chatId] = p;
          replies.push(`❓ *KATEGORI TIDAK DIKENAL*\nUntuk: "${p.note}"\n\nPilih kategori:\n${CATEGORIES.map(c => `• \`${c.cat.toLowerCase()}\``).join('\n')}\n\n_Ketik 'batal'._`);
        } else {
          addTx(p);
          let msgReply = `${p.amount > 0 ? "📈" : "📉"} *${p.category.toUpperCase()}*\n└ \`${fmt(Math.abs(p.amount))}\` (${p.user} | ${p.account.toUpperCase()})`;
          const b = getBudgetStatus(p.category);
          if (b && p.amount < 0) msgReply += `\n\n⚠️ *STATUS BUDGET*\n└ Sisa: \`${fmt(b.limit - b.spent)}\` (${Math.round((b.spent/b.limit)*100)}%)`;
          replies.push(msgReply);
          appendToSheet(p).catch(e => console.error(e));
        }
      }
    } catch (e) { replies.push("❌ Terjadi kesalahan."); }
  }
  return replies.join('\n\n');
}

pollUpdates(handleMessage);
