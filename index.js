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
app.get("/", (req, res) => res.send("Bot MaYo v5.5 CleanSync Active"));
const port = process.env.PORT || 3000;
app.listen(port);

// --- 1. INISIALISASI & KONFIGURASI ---
initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

// [KUNCI] DAFTAR AKUN SPESIFIK USER (Untuk Validasi Set Saldo)
const ACCOUNTS_M = ['bca', 'cash', 'gopay', 'ovo', 'shopeepay', 'bibit', 'mirrae'];
const ACCOUNTS_Y = ['bca', 'cash', 'gopay', 'ovo', 'shopeepay', 'bca sekuritas'];

// KATEGORI AKUN (Untuk Tampilan Rekap)
const LIQUID = ["cash", "bca", "ovo", "gopay", "shopeepay"];
const ASSETS = ["bibit", "mirrae", "bca sekuritas"];

const pendingTxs = {};

// [AUTO-SYNC] Tarik data dari Cloud saat Bot Bangun
(async () => {
  const txs = await downloadFromSheet();
  if (txs.length > 0) {
    const count = rebuildDatabase(txs);
    console.log(`✅ DATABASE PULIH: ${count} transaksi berhasil disinkronkan dari Cloud.`);
  } else {
    console.log("⚠️ Sheet Kosong atau Gagal Sync (Data Lokal 0).");
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
      const result = await sendDocument(5023700044, file, `🔄 Auto-Backup (${date})\n_File lama otomatis dihapus_`, true);
      if (result && result.ok) lastBackupMessageId = result.result.message_id;
      fs.unlinkSync(file);
    }
  } catch (e) { console.error("Backup Error:", e); }
}, { timezone: "Asia/Jakarta" });

// Reminder CC (21:00 WIB)
cron.schedule('0 21 * * *', async () => {
  const cc = getTotalCCHariIni();
  if (cc && cc.total < 0) sendMessage(5023700044, `🔔 *REMINDER CC*\n${line}\nTagihan CC hari ini: *${fmt(Math.abs(cc.total))}*\nJangan lupa dilunasi! 💳`); 
}, { timezone: "Asia/Jakarta" });

// --- 3. MAIN LOGIC ---
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  if (![5023700044, 8469259152].includes(senderId)) return; // ID User yang diizinkan
  
  // RESTORE MANUAL
  if (msg.document && (msg.document.file_name.endsWith('.db') || msg.document.file_name.endsWith('.sqlite'))) {
    sendMessage(chatId, "⏳ **MENDETEKSI DATABASE...**\nSedang memulihkan data...");
    const link = await getFileLink(msg.document.file_id);
    if (link) {
      try {
        const res = await fetch(link);
        const buffer = await res.arrayBuffer();
        fs.writeFileSync("myfinance.db", Buffer.from(buffer));
        setTimeout(() => { process.exit(0); }, 2000); 
        return "✅ **RESTORE SUKSES!**\nData telah pulih. Bot akan restart sebentar...";
      } catch (e) { console.error(e); return "❌ Gagal restore."; }
    }
  }

  const text = msg.text ? msg.text.trim().toLowerCase() : "";
  if (!text) return;

  // GREETING / SAPAAN
  if (/^(hai|halo|hello|\/start|pagi|siang|malam|tes)$/.test(text)) {
    return `👋 **Halo, Bos ${senderId === 5023700044 ? 'Malvin' : 'Yovita'}!**\n\nBot Manajemen Keuangan Keluarga siap membantu.\nSilakan ketik transaksi atau perintah.\n\n💡 Ketik \`menu\` untuk melihat daftar perintah.`;
  }

  // PENDING TRANSACTION (Konfirmasi Kategori)
  if (pendingTxs[chatId]) {
    const matched = CATEGORIES.find(c => c.cat.toLowerCase() === text);
    if (matched) {
      const p = pendingTxs[chatId]; p.category = matched.cat;
      if (p.category === "Pendapatan") p.amount = Math.abs(p.amount);
      delete pendingTxs[chatId]; addTx(p); appendToSheet(p).catch(console.error);
      return `📉 **${p.category.toUpperCase()}**\n└ \`${fmt(Math.abs(p.amount))}\` (${p.user} | ${p.account.toUpperCase()})`;
    } else if (text === "batal") { delete pendingTxs[chatId]; return "❌ Dibatalkan."; }
    else { return `⚠️ Pilih kategori:\n${CATEGORIES.map(c => `• \`${c.cat.toLowerCase()}\``).join('\n')}`; }
  }

  const results = parseInput(msg.text, senderId);
  
  if (!results.length) {
      return `⚠️ **SAYA TIDAK MENGERTI**\n\nFormat yang benar:\n\`[Angka] [Ket] [Akun]\`\n\nContoh:\n• \`50k makan bca\`\n• \`20rb bensin cash\`\n\nAtau ketik \`menu\` untuk bantuan.`;
  }

  let replies = [];
  for (let p of results) {
    try {
      if (p.type === "list") {
        let out = `🤖 **CHEATSHEET MAYO**\n${line}\n`;
        out += `📝 *TRANSAKSI CEPAT*\n• \`50k makan bca\`\n• \`20rb bensin cash\`\n_(Format: Nominal - Ket - Akun)_\n\n`;
        out += `🔧 *TOOLS*\n• \`set saldo [akun] [jml]\`\n• \`pindah [jml] [dari] [ke]\`\n• \`koreksi\` (Undo)\n• \`backup\` (Manual DB)\n\n`;
        out += `📊 *LAPORAN*\n• \`rekap\` (Cek Saldo)\n• \`history\` (Riwayat)\n• \`export pdf\` (Laporan)\n\n`;
        out += `🏦 *DAFTAR AKUN*\n💧 \`${LIQUID.map(a => a.toUpperCase()).join(", ")}\`\n💼 \`${ASSETS.map(a => a.toUpperCase()).join(", ")}\``;
        replies.push(out);
      } 
      else if (p.type === "rekap") {
        const d = getRekapLengkap();
        const cf = getCashflowSummary();
        const budgets = getBudgetSummary();
        const cc = getTotalCCHariIni();
        
        // UI REKAP VERTICAL
        let out = `📊 **LAPORAN KEUANGAN KELUARGA**\n${line}\n`;
        
        [...new Set(d.rows.map(r => r.user))].forEach(u => {
          out += `\n${u === 'M' ? '🧔 **MALVIN**' : '👩 **YOVITA**'}\n`;
          
          // Liquid Section
          const liq = d.rows.filter(r => r.user === u && LIQUID.includes(r.account));
          if (liq.length > 0) {
            out += `\n💧 **LIQUID**\n`;
            liq.forEach(a => out += `• **${a.account.toUpperCase()}**\n   \`${fmt(a.balance)}\`\n`);
          }
          
          // Asset Section
          const ast = d.rows.filter(r => r.user === u && ASSETS.includes(r.account));
          if (ast.length > 0) {
            out += `\n💼 **ASET**\n`;
            ast.forEach(a => out += `• **${a.account.toUpperCase()}**\n   \`${fmt(a.balance)}\`\n`);
          }
          
          // Other Section
          const other = d.rows.filter(r => r.user === u && !LIQUID.includes(r.account) && !ASSETS.includes(r.account) && r.account !== 'cc');
          if (other.length > 0) {
            out += `\n❓ **LAINNYA**\n`;
            other.forEach(a => out += `• **${a.account.toUpperCase()}**\n   \`${fmt(a.balance)}\`\n`);
          }
          
          const total = d.rows.filter(r => r.user === u && r.account !== 'cc').reduce((a, b) => a + b.balance, 0);
          out += `\n💰 **Total ${u === 'M' ? 'Malvin' : 'Yovita'} : ${fmt(total)}**\n`;
        });

        out += `\n${line}\n🌍 **NET WORTH : ${fmt(d.totalWealth)}**\n${line}\n`;
        out += `\n📈 **CASHFLOW BULAN INI**\n📥 Masuk  : \`${fmt(cf.income)}\`\n📤 Keluar : \`${fmt(cf.expense)}\`\n💰 **Net    : ${fmt(cf.income - cf.expense)}**\n`;
        
        if (budgets.length > 0) {
          out += `\n🎯 **BUDGET SISA**\n`;
          budgets.forEach(b => out += `• ${b.spent > b.limit ? '🔴' : '🟢'} **${b.category}**\n   \`${fmt(b.limit - b.spent)}\`\n`);
        }
        out += `\n💳 **Tagihan CC Hari Ini:** \`${fmt(Math.abs(cc.total || 0))}\``;
        replies.push(out);
      } 
      else if (p.type === "history") {
         const filter = { type: 'current', val: null }; 
         let allTxs = [];
         try { allTxs = getFilteredTransactions(filter); } catch (e) { allTxs = []; }
         
         // UI HISTORY FRIENDLY
         if (!allTxs || allTxs.length === 0) {
             replies.push("📭 **BELUM ADA TRANSAKSI**\n" + line + "\nSaat ini belum ada data transaksi tercatat.\n\nYuk, catat pengeluaranmu!\nContoh: `50rb kopi kenangan`");
         } else {
            const limit = p.limit || 10;
            const txs = allTxs.slice(0, limit);
            let out = `🗓️ **HISTORY ${txs.length} TRANSAKSI TERAKHIR**\n${line}\n`;
            txs.forEach((t, i) => {
               const icon = t.amount > 0 ? "📈" : "📉";
               const note = t.note.length > 25 ? t.note.substring(0, 25) + "..." : t.note;
               // UI Vertical List: No. Icon Note \n Nominal
               out += `${i+1}. ${icon} **${note}**\n   \`${fmt(Math.abs(t.amount))}\`\n`;
            });
            out += `\nℹ️ _Ditampilkan ${txs.length} data terakhir._`;
            replies.push(out);
         }
      }
      else if (p.type === "set_saldo") {
        resetAccountBalance(p.user, p.account);
        const tx = { ...p, category: "Saldo Awal" };
        addTx(tx);
        appendToSheet(tx).catch(console.error);
        
        // Cek akun mana saja yang belum diset berdasarkan USER
        const rekap = getRekapLengkap();
        const filledAccounts = rekap.rows.filter(r => r.user === p.user).map(r => r.account);
        const targetList = p.user === 'M' ? ACCOUNTS_M : ACCOUNTS_Y; // Logic Pemisahan Akun
        const unsetAccounts = targetList.filter(acc => !filledAccounts.includes(acc) && acc !== p.account);
        
        let msg = `✅ **UPDATE SALDO BERHASIL**\n${line}\n`;
        msg += `👤 **Pemilik Akun**\n${p.user === 'M' ? '🧔 MALVIN' : '👩 YOVITA'}\n\n`;
        msg += `🏦 **Akun**\n**${p.account.toUpperCase()}**\n\n`;
        msg += `💰 **Saldo Baru**\n\`${fmt(p.amount)}\`\n`;

        if (unsetAccounts.length > 0) {
            msg += `\n⚠️ **AKUN ANDA BELUM DI-SET:**\n${unsetAccounts.map(a => `• ${a.toUpperCase()}`).join('\n')}`;
        } else {
            msg += `\n✅ **Semua akun Anda sudah aktif!**`;
        }
        replies.push(msg);
      } 
      else if (p.type === "export_pdf") {
        const data = getFilteredTransactions(p.filter);
        if (!data || data.length === 0) replies.push(`❌ Tidak ada data: ${p.filter.title}`);
        else {
           const filePath = await createPDF(data, p.filter.title);
           await sendDocument(chatId, filePath, `📄 ${p.filter.title}`);
           fs.unlinkSync(filePath);
        }
      } 
      else if (p.type === "backup") {
        const file = `myfinance_manual.db`;
        fs.copyFileSync('myfinance.db', file);
        await sendDocument(chatId, file, `✅ **BACKUP MANUAL SELESAI**`);
        fs.unlinkSync(file);
      } 
      else if (p.type === "transfer_akun") {
        const txOut = { ...p, account: p.from, amount: -p.amount, category: "Transfer" };
        const txIn = { ...p, account: p.to, amount: p.amount, category: "Transfer" };
        addTx(txOut);
        addTx(txIn);
        appendToSheet(txOut).catch(console.error);
        appendToSheet(txIn).catch(console.error);
        replies.push(`🔄 **TRANSFER SUKSES**\n${p.from.toUpperCase()} ➔ ${p.to.toUpperCase()}\n\`${fmt(p.amount)}\``);
      } 
      else if (p.type === "koreksi") {
        const lastTx = deleteLastTx(p.user);
        if (lastTx) {
          const reverseTx = {
            ...lastTx,
            amount: -lastTx.amount, 
            note: `[AUTO CORRECTION] Mengoreksi: ${lastTx.note} (${fmt(Math.abs(lastTx.amount))})`
          };
          appendToSheet(reverseTx).catch(console.error);
          replies.push(`✅ **TRANSAKSI DIHAPUS**\n"${lastTx.note}" sebesar \`${fmt(Math.abs(lastTx.amount))}\` telah dibatalkan.`);
        } else {
          replies.push("❌ Tidak ada transaksi untuk dikoreksi.");
        }
      }
      else if (p.type === "tx") {
        if (p.category === "Lainnya") {
          pendingTxs[chatId] = p;
          replies.push(`❓ **KATEGORI TIDAK DIKENAL**\nUntuk: "${p.note}"\n\nPilih kategori:\n${CATEGORIES.map(c => `• \`${c.cat.toLowerCase()}\``).join('\n')}`);
        } else {
          addTx(p);
          // UI TRANSACTION VERTICAL
          replies.push(`${p.amount > 0 ? "📈" : "📉"} **${p.category.toUpperCase()}**\n└ \`${fmt(Math.abs(p.amount))}\` (${p.user} | ${p.account.toUpperCase()})`);
          appendToSheet(p).catch(console.error);
        }
      }
    } catch (e) { replies.push("❌ Error Sistem."); console.error(e); }
  }
  return replies.join('\n\n');
}

pollUpdates(handleMessage);
