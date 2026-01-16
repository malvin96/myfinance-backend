import express from "express";
import fs from 'fs';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument, getFileLink, deleteMessage } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, getTotalCCHariIni, resetAccountBalance, getBudgetSummary, getCashflowSummary, deleteLastTx, getFilteredTransactions, rebuildDatabase } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet, downloadFromSheet } from "./sheets.js";
import { CATEGORIES } from "./categories.js";
import fetch from "node-fetch";

const app = express();
app.get("/", (req, res) => res.send("Bot MaYo v6.3 FINAL Locked Active"));
const port = process.env.PORT || 3000;
app.listen(port);

// --- 1. INISIALISASI & KONFIGURASI ---
initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

// [KUNCI] DAFTAR AKUN
const ACCOUNTS_M = ['bca', 'cash', 'gopay', 'ovo', 'shopeepay', 'bibit', 'mirrae'];
const ACCOUNTS_Y = ['bca', 'cash', 'gopay', 'ovo', 'shopeepay', 'bca sekuritas'];

// KATEGORI TAMPILAN
const LIQUID = ["cash", "bca", "ovo", "gopay", "shopeepay"];
const ASSETS = ["bibit", "mirrae", "bca sekuritas"];

const pendingTxs = {};

// [AUTO-SYNC] Tarik data dari Cloud saat Bot Bangun
(async () => {
  const txs = await downloadFromSheet();
  if (txs.length > 0) {
    const count = rebuildDatabase(txs);
    console.log(`✅ DATABASE PULIH: ${count} transaksi disinkronkan.`);
  } else {
    console.log("⚠️ Data Lokal 0 / Sheet Kosong.");
  }
})();

// --- 2. BACKUP & REMINDER ---
// Backup: Detik 58, Menit ke-14 (0, 14, 28, 42, 56)
let lastBackupMessageId = null; 
cron.schedule('58 */14 * * * *', async () => {
  const date = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const file = `myfinance_backup.db`; 
  try {
    if (fs.existsSync('myfinance.db')) {
      fs.copyFileSync('myfinance.db', file);
      if (lastBackupMessageId) await deleteMessage(5023700044, lastBackupMessageId);
      const result = await sendDocument(5023700044, file, `🔄 Auto-Backup (${date})`, true);
      if (result && result.ok) lastBackupMessageId = result.result.message_id;
      fs.unlinkSync(file);
    }
  } catch (e) { console.error("Backup Error:", e); }
}, { timezone: "Asia/Jakarta" });

// Reminder CC (21:00 WIB)
cron.schedule('0 21 * * *', async () => {
  const cc = getTotalCCHariIni();
  if (cc && cc.total < 0) sendMessage(5023700044, `🔔 *TAGIHAN CC HARI INI*\n${line}\nTotal: *${fmt(Math.abs(cc.total))}*\nSegera lunasi ya! 💳`); 
}, { timezone: "Asia/Jakarta" });

// --- 3. MAIN LOGIC ---
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  if (![5023700044, 8469259152].includes(senderId)) return; 
  
  // RESTORE MANUAL (Drag & Drop File .db)
  if (msg.document && (msg.document.file_name.endsWith('.db') || msg.document.file_name.endsWith('.sqlite'))) {
    sendMessage(chatId, "⏳ *Restoring Database...*");
    const link = await getFileLink(msg.document.file_id);
    if (link) {
      try {
        const res = await fetch(link);
        const buffer = await res.arrayBuffer();
        fs.writeFileSync("myfinance.db", Buffer.from(buffer));
        setTimeout(() => { process.exit(0); }, 2000); 
        return "✅ **RESTORE SUKSES!** Bot merestart...";
      } catch (e) { console.error(e); return "❌ Gagal restore."; }
    }
  }

  const text = msg.text ? msg.text.trim().toLowerCase() : "";
  if (!text) return;

  if (/^(hai|halo|hello|\/start|pagi|siang|malam|tes)$/.test(text)) {
    return `👋 **Siap, Bos ${senderId === 5023700044 ? 'Malvin' : 'Yovita'}!**\nKetik \`menu\` untuk bantuan.`;
  }

  // PENDING TX (Konfirmasi Kategori)
  if (pendingTxs[chatId]) {
    const matched = CATEGORIES.find(c => c.cat.toLowerCase() === text);
    if (matched) {
      const p = pendingTxs[chatId]; p.category = matched.cat;
      if (p.category === "Pendapatan") p.amount = Math.abs(p.amount);
      delete pendingTxs[chatId]; addTx(p); appendToSheet(p).catch(console.error);
      return `✅ Tersimpan: **${p.category}** - ${fmt(Math.abs(p.amount))}`;
    } else if (text === "batal") { delete pendingTxs[chatId]; return "❌ Dibatalkan."; }
    else { return `⚠️ Pilih kategori:\n${CATEGORIES.map(c => `\`${c.cat.toLowerCase()}\``).join(', ')}`; }
  }

  const results = parseInput(msg.text, senderId);
  
  if (!results.length) {
      return `⚠️ **FORMAT SALAH**\nContoh: \`50rb makan bca\`\nAtau ketik \`menu\`.`;
  }

  let replies = [];
  for (let p of results) {
    try {
      if (p.type === "list") {
        let out = `🤖 **MENU PERINTAH**\n${line}\n`;
        out += `📝 \`50rb makan bca\` (Catat)\n`;
        out += `🔧 \`set saldo [akun] [jml]\`\n`;
        out += `🔄 \`pindah [jml] [dari] [ke]\`\n`;
        out += `↩️ \`koreksi\` (Undo)\n`;
        out += `📊 \`rekap\` | \`history\` | \`pdf\`\n`;
        out += `💾 \`backup\` (Manual DB)`;
        replies.push(out);
      } 
      else if (p.type === "rekap") {
        const d = getRekapLengkap();
        const cf = getCashflowSummary();
        const budgets = getBudgetSummary();
        
        // UI REKAP (FLAT & SUB-TOTAL)
        let out = `📊 **REKAP KEUANGAN**\n${line}\n`;
        
        [...new Set(d.rows.map(r => r.user))].forEach(u => {
          out += `${u === 'M' ? '🧔 MALVIN' : '👩 YOVITA'}\n`;
          
          // LIQUID
          const liq = d.rows.filter(r => r.user === u && LIQUID.includes(r.account));
          if (liq.length) {
            const totalLiq = liq.reduce((a,b) => a + b.balance, 0);
            out += `💧 Liquid:\n`;
            out += liq.map(a => `${a.account.toUpperCase()}: \`${fmt(a.balance)}\``).join('\n');
            out += `\n**Total ${u} Liquid : ${fmt(totalLiq)}**\n\n`; // Subtotal
          }
          
          // ASSETS
          const ast = d.rows.filter(r => r.user === u && ASSETS.includes(r.account));
          if (ast.length) {
            const totalAst = ast.reduce((a,b) => a + b.balance, 0);
            out += `💼 Aset:\n`;
            out += ast.map(a => `${a.account.toUpperCase()}: \`${fmt(a.balance)}\``).join('\n');
            out += `\n**Total ${u} Asset : ${fmt(totalAst)}**\n`; // Subtotal
          }
          out += `\n`;
        });

        out += `${line}\n🌍 **NET WORTH: ${fmt(d.totalWealth)}**\n${line}\n`;
        out += `📈 **Cashflow:** In \`${fmt(cf.income)}\` | Out \`${fmt(cf.expense)}\`\n`;
        out += `💰 **Net:** \`${fmt(cf.income - cf.expense)}\`\n`;
        
        if (budgets.length > 0) {
          out += `\n🎯 **Sisa Budget:**\n`;
          out += budgets.map(b => `${b.spent > b.limit ? '🔴' : '🟢'} ${b.category}: \`${fmt(b.limit - b.spent)}\``).join('\n');
        }
        
        const cc = getTotalCCHariIni();
        out += `💳 **Tagihan CC Hari Ini:** \`${fmt(Math.abs(cc.total || 0))}\``;
        
        replies.push(out);
      } 
      else if (p.type === "history") {
         const filter = { type: 'current', val: null }; 
         let allTxs = [];
         try { allTxs = getFilteredTransactions(filter); } catch (e) { allTxs = []; }
         
         if (!allTxs.length) {
             replies.push("📭 Belum ada transaksi bulan ini.");
         } else {
            const limit = p.limit || 10;
            const txs = allTxs.slice(0, limit);
            let out = `🗓️ **${txs.length} TRANSAKSI TERAKHIR**\n${line}\n`;
            txs.forEach((t, i) => {
               const icon = t.amount > 0 ? "📈" : "📉";
               const dateShort = t.timestamp.substring(8,10); 
               const noteShort = t.note.length > 15 ? t.note.substring(0, 15)+".." : t.note;
               // UI HISTORY (FLAT ONE-LINER)
               out += `\`${dateShort}\` ${icon} ${noteShort} : \`${fmt(Math.abs(t.amount))}\`\n`;
            });
            replies.push(out);
         }
      }
      else if (p.type === "set_saldo") {
        resetAccountBalance(p.user, p.account);
        const tx = { ...p, category: "Saldo Awal" };
        addTx(tx);
        appendToSheet(tx).catch(console.error);
        
        const rekap = getRekapLengkap();
        const filledAccounts = rekap.rows.filter(r => r.user === p.user).map(r => r.account);
        const targetList = p.user === 'M' ? ACCOUNTS_M : ACCOUNTS_Y; 
        const unsetAccounts = targetList.filter(acc => !filledAccounts.includes(acc) && acc !== p.account);
        
        // UI SET SALDO (COMPACT WARNING)
        let msg = `✅ **SALDO DIUPDATE**\n`;
        msg += `👤 ${p.user === 'M' ? 'Malvin' : 'Yovita'} | 🏦 ${p.account.toUpperCase()}\n`;
        msg += `💰 **${fmt(p.amount)}**\n${line}\n`;

        if (unsetAccounts.length > 0) {
            msg += `⚠️ **${unsetAccounts.length} Akun Belum Aktif:**\n`;
            msg += `_${unsetAccounts.map(a => a.toUpperCase()).join(', ')}_`; 
        } else {
            msg += `🎉 **Semua Akun Siap!**`;
        }
        replies.push(msg);
      } 
      else if (p.type === "export_pdf") {
        const data = getFilteredTransactions(p.filter);
        if (!data.length) replies.push(`❌ Data kosong.`);
        else {
           const filePath = await createPDF(data, p.filter.title);
           await sendDocument(chatId, filePath, `📄 ${p.filter.title}`);
           fs.unlinkSync(filePath);
        }
      } 
      else if (p.type === "backup") {
        const file = `myfinance_manual.db`;
        fs.copyFileSync('myfinance.db', file);
        await sendDocument(chatId, file, `✅ Manual Backup`);
        fs.unlinkSync(file);
      } 
      else if (p.type === "transfer_akun") {
        const txOut = { ...p, account: p.from, amount: -p.amount, category: "Transfer" };
        const txIn = { ...p, account: p.to, amount: p.amount, category: "Transfer" };
        addTx(txOut); addTx(txIn);
        appendToSheet(txOut).catch(console.error); appendToSheet(txIn).catch(console.error);
        replies.push(`🔄 **TRANSFER**\n${p.from.toUpperCase()} ➔ ${p.to.toUpperCase()}\nNominal: \`${fmt(p.amount)}\``);
      } 
      else if (p.type === "koreksi") {
        const lastTx = deleteLastTx(p.user);
        if (lastTx) {
          const reverseTx = { ...lastTx, amount: -lastTx.amount, note: `[CORRECTION] ${lastTx.note}` };
          appendToSheet(reverseTx).catch(console.error);
          replies.push(`↩️ **UNDO SUKSES**\nDihapus: ${lastTx.note} (\`${fmt(Math.abs(lastTx.amount))}\`)`);
        } else {
          replies.push("❌ History kosong.");
        }
      }
      else if (p.type === "tx") {
        if (p.category === "Lainnya") {
          pendingTxs[chatId] = p;
          replies.push(`❓ **Kategori?** "${p.note}"\nPilih: ${CATEGORIES.map(c => `\`${c.cat.toLowerCase()}\``).join(', ')}`);
        } else {
          addTx(p);
          appendToSheet(p).catch(console.error);
          // UI TRANSACTION (SIMPLE)
          replies.push(`✅ **${p.category.toUpperCase()}**\n${p.note} : \`${fmt(Math.abs(p.amount))}\`\n(${p.account.toUpperCase()})`);
        }
      }
    } catch (e) { replies.push("❌ Error Sistem."); console.error(e); }
  }
  return replies.join('\n\n');
}

pollUpdates(handleMessage);
