import express from "express";
import fs from 'fs';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument, getFileLink, deleteMessage } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, getTotalCCHariIni, deleteLastTx, rebuildDatabase, getLatestTransactions, getAllTransactions } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet, downloadFromSheet, overwriteSheet } from "./sheets.js";
import { CATEGORIES } from "./categories.js";

const app = express();
app.get("/", (req, res) => res.send("Bot MaYo v8.0 No-Slash Active"));
const port = process.env.PORT || 3000;
app.listen(port);

// --- INIT ---
initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

// STATE
const pendingTxs = {};      
const pendingAdmin = {};    

// --- AUTO BACKUP ---
cron.schedule('58 */14 * * * *', async () => {
  const chatId = process.env.TELEGRAM_USER_ID; 
  if (chatId) {
     const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
     await sendDocument(chatId, 'myfinance.db', `🛡 **AUTO BACKUP**\n🕒 ${now}`, true);
     await downloadFromSheet(); // Keep Alive
  }
});

// --- CORE LOGIC ---
pollUpdates(async (msg) => {
  const chatId = msg.chat.id;
  const textRaw = msg.text || "";
  const text = textRaw.toLowerCase().trim(); // Normalisasi input
  const userCode = (msg.from.first_name && msg.from.first_name.toLowerCase().includes("yovita")) ? 'Y' : 'M';
  
  console.log(`📩 [${userCode}] Input: ${textRaw}`);

  // 1. MENU & HELP
  if (text === 'menu' || text === 'help' || text === 'start' || text === 'panduan') {
    return `🤖 **MENU UTAMA BOT MAYO**\n\n` +
           `💸 **Transaksi**\n` +
           `• \`[Item] [Harga]\` : Input Cepat\n` +
           `• \`[Akun] [Item] [Harga]\` : Input Detail\n` +
           `• \`tf [jml] [asal] [tujuan]\` : Transfer\n\n` +
           `📊 **Data**\n` +
           `• \`history [angka]\` : Cek 10-50 riwayat\n` +
           `• \`laporan\` : PDF Laporan Keuangan\n` +
           `• \`saldo\` : Cek semua saldo\n\n` +
           `🛠 **Tools**\n` +
           `• \`koreksi\` : Undo (Hapus Terakhir)\n` +
           `• \`sync pull\` : Restore DB dari Sheet\n` +
           `• \`sync push\` : Timpa Sheet dari DB\n` +
           `• \`ss [akun] [nominal]\` : Set Saldo Manual`;
  }

  // 2. HISTORY (Tanpa /)
  if (text.startsWith('history') || text.startsWith('log') || text === 'riwayat') {
     const args = text.split(' ');
     let limit = 10; 
     if (args[1] && !isNaN(args[1])) limit = parseInt(args[1]);
     if (limit > 50) limit = 50; 

     const data = getLatestTransactions(limit);
     if (data.length === 0) return "📭 Belum ada data transaksi.";

     let response = `📜 **${limit} Riwayat Terakhir:**\n${line}\n`;
     data.forEach((tx, index) => {
         const icon = tx.amount < 0 ? '🔴' : '🟢';
         const user = tx.user === 'M' ? '👨' : '👩';
         response += `${index+1}. ${icon} ${user} **${tx.account.toUpperCase()}** • ${tx.note}\n`;
         response += `    ${fmt(tx.amount)} (${tx.category})\n`;
     });
     return response;
  }

  // 3. LAPORAN PDF (Tanpa /)
  if (text === 'laporan' || text === 'pdf' || text === 'rekap') {
     const data = getAllTransactions(); 
     await createPDF(data, "LAPORAN KEUANGAN LENGKAP");
     const fileName = `Laporan_${new Date().toISOString().slice(0, 10)}.pdf`;
     await sendDocument(chatId, fileName, "📊 Laporan Keuangan Siap, Bos.");
     return null;
  }

  // 4. SYNC (Tanpa /)
  if (text.startsWith('sync')) {
      const args = text.split(' ');
      const mode = args[1] ? args[1] : '';

      if (mode === 'pull') {
          await sendMessage(chatId, "⏳ **PULL**: Sedang download data Sheet...");
          const sheetData = await downloadFromSheet();
          if (sheetData.length > 0) {
              const count = rebuildDatabase(sheetData);
              return `✅ **SYNC PULL SUKSES!**\nDatabase Bot diperbarui (${count} data).`;
          }
          return "❌ Gagal Pull / Sheet Kosong.";
      } 
      
      else if (mode === 'push') {
          await sendMessage(chatId, "⏳ **PUSH**: Sedang upload data ke Sheet...");
          const dbData = getAllTransactions();
          const success = await overwriteSheet(dbData);
          if (success) return `✅ **SYNC PUSH SUKSES!**\nGoogle Sheet diperbarui (${dbData.length} data).`;
          return "❌ Gagal Push ke Sheet.";
      }
      return "⚠️ Ketik `sync pull` (Sheet->Bot) atau `sync push` (Bot->Sheet).";
  }

  // 5. CEK SALDO (Tanpa /)
  if (text === 'saldo' || text === 'cek saldo' || text === 'balance') {
    const rekap = getRekapLengkap();
    let msg = `💰 **POSISI SALDO**\n${line}\n`;
    
    const mRows = rekap.rows.filter(r => r.user === 'M');
    const yRows = rekap.rows.filter(r => r.user === 'Y');

    if (mRows.length > 0) {
        msg += `👨 **MALVIN**\n`;
        mRows.forEach(r => msg += `• ${r.account.toUpperCase()}: ${fmt(r.balance)}\n`);
    }
    msg += `\n`;
    if (yRows.length > 0) {
        msg += `👩 **YOVITA**\n`;
        yRows.forEach(r => msg += `• ${r.account.toUpperCase()}: ${fmt(r.balance)}\n`);
    }
    
    msg += `${line}\n💎 **TOTAL: ${fmt(rekap.totalWealth)}**`;
    return msg;
  }

  // 6. ADMIN TRANSFER LOGIC
  if (pendingAdmin[chatId]) {
    const cost = parseFloat(textRaw.replace(/[^0-9]/g, '')) || 0;
    const { txOut, txIn } = pendingAdmin[chatId];
    
    addTx(txOut); appendToSheet(txOut);
    addTx(txIn); appendToSheet(txIn);
    
    let adminMsg = "";
    if (cost > 0) {
      const txAdmin = { 
        user: txOut.user, account: txOut.account, amount: -cost, category: 'Tagihan', note: `Admin Transfer` 
      };
      addTx(txAdmin); appendToSheet(txAdmin);
      adminMsg = ` + Admin ${fmt(cost)}`;
    }
    
    delete pendingAdmin[chatId];
    return `✅ **Transfer Berhasil!**\n💸 ${fmt(Math.abs(txOut.amount))} ke ${txIn.account.toUpperCase()}${adminMsg}`;
  }

  // 7. CONFIRM CATEGORY LOGIC
  if (pendingTxs[chatId]) {
    const valid = CATEGORIES.find(c => c.cat.toLowerCase() === text);
    if (valid || text) { 
       const finalCat = valid ? valid.cat : textRaw; // Use raw text for custom category
       const tx = pendingTxs[chatId];
       tx.category = finalCat;
       if (finalCat === 'Pendapatan') tx.amount = Math.abs(tx.amount);
       else tx.amount = -Math.abs(tx.amount);

       addTx(tx); appendToSheet(tx);
       delete pendingTxs[chatId];
       return `✅ **${finalCat}** dicatat: ${tx.note} (${fmt(tx.amount)})`;
    }
  }

  // 8. PARSER INPUT (Adjustment, Koreksi, TF, Transaksi)
  const result = parseInput(textRaw, userCode);
  if (!result) return null;

  if (result.type === 'transfer') {
    pendingAdmin[chatId] = { txOut: result.txOut, txIn: result.txIn };
    return `🔄 **Transfer**\nKe: ${result.txIn.account.toUpperCase()}\nNominal: ${fmt(Math.abs(result.txOut.amount))}\n\n**Biaya Admin?** (0 jika gratis)`;
  }

  if (result.type === 'adjustment') { // ss bca 100rb
    addTx(result.tx); appendToSheet(result.tx);
    return `🛠 **Adjustment**\nSaldo ${result.tx.account.toUpperCase()} diset menjadi ${fmt(result.tx.amount)}.`;
  }

  if (result.type === 'koreksi') { // koreksi / undo
    const lastTx = deleteLastTx(result.user);
    if (lastTx) {
      const reverseTx = { ...lastTx, amount: -lastTx.amount, note: `[CORRECTION] ${lastTx.note}` };
      appendToSheet(reverseTx).catch(console.error);
      return `↩️ **UNDO BERHASIL**\nDihapus: ${lastTx.note} (${fmt(Math.abs(lastTx.amount))})`;
    }
    return "❌ Tidak ada data untuk dihapus.";
  }

  if (result.type === 'tx') {
    if (result.category === 'Lainnya') {
      pendingTxs[chatId] = result;
      const buttons = CATEGORIES.map(c => `\`${c.cat}\``).join(', ');
      return `❓ **Kategori?**\n${buttons}`;
    }
    
    addTx(result); appendToSheet(result);
    
    let warning = "";
    if (result.account === 'cc') {
        const usage = getTotalCCHariIni();
        if (Math.abs(usage.total) > 5000000) warning = `\n⚠️ **WARNING:** Pemakaian CC > 5 Juta!`;
    }

    return `✅ **${result.category}** dicatat: ${fmt(result.amount)}${warning}`;
  }
});
