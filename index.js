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
app.get("/", (req, res) => res.send("Bot MaYo v7.0 FINAL Active"));
const port = process.env.PORT || 3000;
app.listen(port);

// --- 1. INISIALISASI ---
initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

// STATE MANAGEMENT
const pendingTxs = {};      // Konfirmasi kategori
const pendingAdmin = {};    // Konfirmasi admin transfer

// --- 2. AUTO BACKUP (WITA) ---
cron.schedule('58 */14 * * * *', async () => {
  const chatId = process.env.TELEGRAM_USER_ID; 
  if (chatId) {
     const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
     await sendDocument(chatId, 'myfinance.db', `🛡 **AUTO BACKUP**\n🕒 ${now}`, true); // Silent
     // Ping sheet agar connection keep alive
     await downloadFromSheet(); 
  }
});

// --- 3. CORE LOGIC ---
pollUpdates(async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const userCode = (msg.from.first_name && msg.from.first_name.toLowerCase().includes("yovita")) ? 'Y' : 'M';
  
  console.log(`📩 [${userCode}] Input: ${text}`);

  // A. HANDLE MENU
  if (text === '/start' || text === '/menu' || text === '/help') {
    return `🤖 **MENU UTAMA BOT MAYO**\n\n` +
           `💸 **Transaksi**\n` +
           `• \`[Item] [Harga]\` : Input Cepat (Cash)\n` +
           `• \`[Akun] [Item] [Harga]\` : Input Detail\n` +
           `• \`tf [jml] [asal] [tujuan]\` : Transfer\n\n` +
           `📊 **Laporan & Data**\n` +
           `• \`/history [angka]\` : Cek 10-50 riwayat\n` +
           `• \`/laporan\` : Download PDF Laporan\n` +
           `• \`/saldo\` : Cek posisi saldo akun\n\n` +
           `🛠 **Tools & Sync**\n` +
           `• \`/koreksi\` : Undo transaksi terakhir\n` +
           `• \`/sync pull\` : Restore DB dari Sheet\n` +
           `• \`/sync push\` : Timpa Sheet dari DB (Hati-hati!)\n` +
           `• \`/ss [akun] [nominal]\` : Set Saldo Manual`;
  }

  // B. HANDLE HISTORY (READ ONLY)
  if (text.startsWith('/history') || text.startsWith('/log')) {
     const args = text.split(' ');
     let limit = 10; // Default
     if (args[1] && !isNaN(args[1])) limit = parseInt(args[1]);
     
     // Batas maksimal agar chat tidak spam
     if (limit > 50) limit = 50; 

     const data = getLatestTransactions(limit);
     if (data.length === 0) return "📭 Belum ada data transaksi.";

     let response = `📜 **${limit} Riwayat Transaksi Terakhir:**\n${line}\n`;
     data.forEach((tx, index) => {
         const icon = tx.amount < 0 ? '🔴' : '🟢';
         const user = tx.user === 'M' ? '👨' : '👩';
         response += `${index+1}. ${icon} ${user} **${tx.account.toUpperCase()}** • ${tx.note}\n`;
         response += `    ${fmt(tx.amount)} (${tx.category})\n`;
     });
     return response;
  }

  // C. HANDLE LAPORAN PDF
  if (text === '/laporan' || text === '/pdf') {
     const data = getAllTransactions(); // Ambil semua untuk laporan
     const title = "LAPORAN KEUANGAN LENGKAP";
     await createPDF(data, title);
     const fileName = `Laporan_${new Date().toISOString().slice(0, 10)}.pdf`;
     await sendDocument(chatId, fileName, "📊 Ini laporan keuangannya, Bos.");
     return null; // Tidak perlu reply text lagi
  }

  // D. HANDLE SYNC (DUA ARAH)
  if (text.startsWith('/sync')) {
      const args = text.split(' ');
      const mode = args[1] ? args[1].toLowerCase() : '';

      if (mode === 'pull') {
          await sendMessage(chatId, "⏳ **PULL**: Mengunduh data dari Google Sheet...");
          const sheetData = await downloadFromSheet();
          if (sheetData.length > 0) {
              const count = rebuildDatabase(sheetData);
              return `✅ **SYNC PULL SUKSES!**\nDatabase Lokal telah di-update dengan ${count} data dari Google Sheet.`;
          }
          return "❌ Gagal Pull atau Sheet Kosong.";
      } 
      
      else if (mode === 'push') {
          await sendMessage(chatId, "⏳ **PUSH**: Mengupload data ke Google Sheet...");
          const dbData = getAllTransactions();
          const success = await overwriteSheet(dbData);
          if (success) return `✅ **SYNC PUSH SUKSES!**\nGoogle Sheet kini sama persis dengan Database Lokal (${dbData.length} data).`;
          return "❌ Gagal Push ke Google Sheet.";
      }
      
      return "⚠️ Gunakan `/sync pull` (Sheet->Bot) atau `/sync push` (Bot->Sheet).";
  }

  // E. HANDLE CEK SALDO
  if (text === '/saldo' || text === 'saldo' || text === 'cek saldo') {
    const rekap = getRekapLengkap();
    let msg = `💰 **POSISI SALDO SAAT INI**\n${line}\n`;
    
    // Grouping by User
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
    
    msg += `${line}\n💎 **TOTAL KEKAYAAN: ${fmt(rekap.totalWealth)}**`;
    return msg;
  }

  // F. HANDLE PENDING ADMIN (TRANSFER)
  if (pendingAdmin[chatId]) {
    const cost = parseFloat(text.replace(/[^0-9]/g, '')) || 0;
    const { txOut, txIn } = pendingAdmin[chatId];
    
    // 1. Simpan Transaksi Keluar
    addTx(txOut); appendToSheet(txOut);
    
    // 2. Simpan Transaksi Masuk
    addTx(txIn); appendToSheet(txIn);
    
    // 3. Simpan Admin (Jika ada)
    let adminMsg = "";
    if (cost > 0) {
      const txAdmin = { 
        user: txOut.user, 
        account: txOut.account, 
        amount: -cost, 
        category: 'Tagihan', 
        note: `Admin Transfer ${txOut.account}->${txIn.account}` 
      };
      addTx(txAdmin); appendToSheet(txAdmin);
      adminMsg = ` + Admin ${fmt(cost)}`;
    }
    
    delete pendingAdmin[chatId];
    return `✅ **Transfer Sukses!**\n💸 ${fmt(Math.abs(txOut.amount))} dari ${txOut.account.toUpperCase()} ke ${txIn.account.toUpperCase()}${adminMsg}`;
  }

  // G. HANDLE KONFIRMASI KATEGORI
  if (pendingTxs[chatId]) {
    const chosenCat = text.trim();
    // Validasi apakah input user ada di daftar kategori
    const valid = CATEGORIES.find(c => c.cat.toLowerCase() === chosenCat.toLowerCase());
    
    if (valid || chosenCat) { // Terima input apapun sebagai kategori jika user maksa
       const finalCat = valid ? valid.cat : chosenCat;
       const tx = pendingTxs[chatId];
       tx.category = finalCat;
       
       // Logika Ulang Amount jika ternyata Pendapatan
       if (finalCat === 'Pendapatan') tx.amount = Math.abs(tx.amount);
       else tx.amount = -Math.abs(tx.amount);

       addTx(tx);
       appendToSheet(tx);
       delete pendingTxs[chatId];
       return `✅ **${finalCat}** dicatat: ${tx.note} (${fmt(tx.amount)})`;
    }
  }

  // H. PARSE INPUT UTAMA
  const result = parseInput(text, userCode);
  if (!result) return null; // Abaikan chat curhat/sampah

  // 1. TRANSFER
  if (result.type === 'transfer') {
    pendingAdmin[chatId] = { txOut: result.txOut, txIn: result.txIn };
    return `🔄 **Konfirmasi Transfer**\nDari: ${result.txOut.account.toUpperCase()}\nKe: ${result.txIn.account.toUpperCase()}\nNominal: ${fmt(Math.abs(result.txOut.amount))}\n\n**Berapa biaya admin?** (Ketik 0 jika gratis)`;
  }

  // 2. MANUAL ADJUSTMENT (SS)
  if (result.type === 'adjustment') {
    addTx(result.tx);
    appendToSheet(result.tx);
    return `🛠 **Adjustment Saldo**\nAkun ${result.tx.account.toUpperCase()} dikoreksi sebesar ${fmt(result.tx.amount)}.`;
  }

  // 3. KOREKSI (UNDO)
  if (result.type === 'koreksi') {
    const lastTx = deleteLastTx(result.user);
    if (lastTx) {
      const reverseTx = { ...lastTx, amount: -lastTx.amount, note: `[CORRECTION] ${lastTx.note}` };
      appendToSheet(reverseTx).catch(console.error);
      return `↩️ **UNDO SUKSES**\nDihapus: ${lastTx.note} (${fmt(Math.abs(lastTx.amount))})`;
    }
    return "❌ History kosong, tidak ada yang bisa dihapus.";
  }

  // 4. TRANSAKSI BIASA
  if (result.type === 'tx') {
    if (result.category === 'Lainnya') {
      pendingTxs[chatId] = result;
      const buttons = CATEGORIES.map(c => `\`${c.cat}\``).join(', ');
      return `❓ **Kategori tidak dikenali:** "${result.note}"\nSilakan ketik salah satu:\n${buttons}`;
    }
    
    addTx(result);
    appendToSheet(result);
    
    // Cek Warning Kartu Kredit
    let warning = "";
    if (result.account === 'cc') {
        const usage = getTotalCCHariIni();
        if (Math.abs(usage.total) > 5000000) warning = `\n⚠️ **WARNING:** Pemakaian CC hari ini > 5 Juta!`;
    }

    return `✅ **${result.category}** dicatat: ${fmt(result.amount)}${warning}`;
  }
});
