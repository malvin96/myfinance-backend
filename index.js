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
app.get("/", (req, res) => res.send("Bot MaYo v8.0 Active"));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

// --- INIT ---
initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

// STATE
const pendingTxs = {};      
const pendingAdmin = {};    

// --- AUTO BACKUP (Setiap 14 Menit, Detik ke-58) ---
cron.schedule('58 */14 * * * *', async () => {
  const chatId = process.env.TELEGRAM_USER_ID; 
  if (chatId) {
     const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
     // Kirim ke Admin (Malvin)
     await sendDocument(chatId, 'myfinance.db', `🛡 **AUTO BACKUP**\n🕒 ${now}`, true);
     
     // Keep Alive Connection to Sheets
     await downloadFromSheet(); 
     console.log(`[AUTO] Backup sent to ${chatId} at ${now}`);
  }
});

// --- CORE LOGIC ---
async function handleMessage(msg) {
  const chatId = msg.chat.id.toString();
  const text = msg.text || "";
  const msgId = msg.message_id;

  // 1. AUTHENTICATION & USER DETECTION
  const adminId = process.env.TELEGRAM_USER_ID;
  const partnerId = process.env.USER_ID_PARTNER;
  
  let userCode = null;
  if (chatId === adminId) userCode = 'M';        // Malvin
  else if (chatId === partnerId) userCode = 'Y'; // Partner
  
  if (!userCode) {
      console.log(`Unauthorized access from: ${chatId}`);
      return; // Abaikan pesan dari orang asing
  }

  // 2. FILE HANDLING (.db restore)
  if (msg.document && msg.document.file_name.endsWith('.db') && userCode === 'M') {
    const fileLink = await getFileLink(msg.document.file_id);
    if (fileLink) {
      const response = await fetch(fileLink);
      const buffer = await response.buffer();
      fs.writeFileSync('myfinance.db', buffer);
      return "✅ **Database Restored!**\nSilakan cek `/saldo`.";
    }
  }

  if (!text) return null;

  // 3. COMMANDS
  const lowerText = text.toLowerCase();

  // --- REPORTING ---
  if (lowerText === 'laporan' || lowerText === '/report') {
    const data = getAllTransactions();
    const pdfPath = await createPDF(data);
    await sendDocument(chatId, pdfPath, "📊 **Laporan Keuangan**");
    fs.unlinkSync(pdfPath); // Hapus file lokal setelah kirim
    return null;
  }

  if (lowerText === 'saldo' || lowerText === '/balance') {
    const rekap = getRekapLengkap();
    const totalCC = getTotalCCHariIni();
    
    let msgStr = `💰 **POSISI SALDO**\n${line}\n`;
    rekap.rows.forEach(r => {
        const icon = r.user === 'M' ? '👨🏻' : '👩🏻';
        msgStr += `${icon} **${r.account.toUpperCase()}**: ${fmt(r.balance)}\n`;
    });
    
    msgStr += `${line}\n💵 **TOTAL KEKAYAAN: ${fmt(rekap.totalWealth)}**`;
    
    if (totalCC.total < 0) {
        msgStr += `\n\n⚠️ **TAGIHAN CC HARI INI:**\n${fmt(Math.abs(totalCC.total))}`;
    }
    return msgStr;
  }

  if (lowerText === 'history' || lowerText === '/history') {
    const data = getLatestTransactions(10);
    if (data.length === 0) return "Belum ada transaksi.";
    
    let msgStr = `📜 **10 TRANSAKSI TERAKHIR**\n${line}\n`;
    data.forEach(d => {
        const arrow = d.amount >= 0 ? '🟢' : '🔴';
        const userIcon = d.user === 'M' ? '👨🏻' : '👩🏻';
        msgStr += `${arrow} ${d.category} (${userIcon} ${d.account.toUpperCase()})\nRs ${parseInt(Math.abs(d.amount)).toLocaleString()} - ${d.note}\n\n`;
    });
    return msgStr;
  }

  if (lowerText === 'help' || lowerText === 'panduan') {
      return `🤖 **PANDUAN MAYO V8.0**\n\n` +
             `✏️ **Input Transaksi:**\n` +
             `• \`50k makan siang\` (Default Cash)\n` +
             `• \`bca 100rb beli pulsa\`\n` +
             `• \`2.5jt gopay topup\`\n\n` +
             `🛠 **Fitur Admin:**\n` +
             `• \`koreksi\` (Hapus transaksi terakhirmu)\n` +
             `• \`ss [akun] [nominal]\` (Set Saldo)\n` +
             `• \`sync push\` (DB -> Sheets)\n` +
             `• \`sync pull\` (Sheets -> DB)\n` +
             `• \`laporan\` (Download PDF)\n` +
             `• \`saldo\` (Cek Saldo)`;
  }

  // --- SYNC COMMANDS ---
  if (lowerText === 'sync push') {
      if (userCode !== 'M') return "⛔ Hanya Admin yang boleh Sync.";
      const allTx = getAllTransactions();
      const success = await overwriteSheet(allTx);
      return success ? "✅ **Sync Push Sukses!**\nDatabase Lokal -> Google Sheets." : "❌ Sync Gagal.";
  }

  if (lowerText === 'sync pull') {
      if (userCode !== 'M') return "⛔ Hanya Admin yang boleh Sync.";
      const sheetData = await downloadFromSheet();
      if (sheetData.length > 0) {
          const count = rebuildDatabase(sheetData);
          return `✅ **Sync Pull Sukses!**\nDatabase di-restore (${count} transaksi).`;
      }
      return "❌ Gagal download atau Sheet kosong.";
  }

  // --- INTERACTIVE BUTTONS HANDLING ---
  if (pendingTxs[chatId]) {
    const catMatch = CATEGORIES.find(c => c.cat.toLowerCase() === lowerText);
    if (catMatch) {
        const tx = pendingTxs[chatId];
        tx.category = catMatch.cat;
        
        // Finalize Transaction
        addTx(tx);
        appendToSheet(tx);
        delete pendingTxs[chatId];
        
        await deleteMessage(chatId, msgId); // Hapus chat user (tombol)
        return `✅ **Tersimpan!**\n${tx.category}: ${fmt(Math.abs(tx.amount))} (${tx.account.toUpperCase()})`;
    } else if (lowerText === 'batal') {
        delete pendingTxs[chatId];
        return "❌ Transaksi dibatalkan.";
    }
  }

  // --- TRANSFER CONFIRMATION ---
  if (pendingAdmin[chatId]) {
      const fee = parseFloat(text.replace(/[^0-9]/g, ''));
      if (!isNaN(fee)) {
          const { txOut, txIn } = pendingAdmin[chatId];
          
          addTx(txOut); appendToSheet(txOut);
          addTx(txIn); appendToSheet(txIn);
          
          let msgStr = `✅ **Transfer Berhasil**\nFrom: ${txOut.account.toUpperCase()}\nTo: ${txIn.account.toUpperCase()}\nNominal: ${fmt(Math.abs(txOut.amount))}`;

          if (fee > 0) {
              const txFee = {
                  user: userCode,
                  account: txOut.account,
                  amount: -fee,
                  category: 'Tagihan',
                  note: `Admin Transfer ke ${txIn.account}`,
                  timestamp: new Date().toISOString()
              };
              addTx(txFee); appendToSheet(txFee);
              msgStr += `\n+ Admin Fee: ${fmt(fee)}`;
          }

          delete pendingAdmin[chatId];
          return msgStr;
      }
  }

  // 4. PARSING NATURAL LANGUAGE
  // Inject userCode (M/Y) ke dalam hasil parsing
  const result = parseInput(text);

  if (!result) return null; // Bukan format transaksi

  // Inject User Identity Here
  if (result.tx) result.tx.user = userCode;
  if (result.user) result.user = userCode; // Untuk command 'koreksi'
  
  if (result.type === 'transfer') {
    // Inject user juga ke objek transfer
    result.txOut.user = userCode;
    result.txIn.user = userCode;
    
    pendingAdmin[chatId] = { txOut: result.txOut, txIn: result.txIn };
    return `🔄 **Transfer**\nKe: ${result.txIn.account.toUpperCase()}\nNominal: ${fmt(Math.abs(result.txOut.amount))}\n\n**Biaya Admin?** (Ketik '0' jika gratis)`;
  }

  if (result.type === 'adjustment') { // ss bca 100rb
    addTx(result.tx); appendToSheet(result.tx);
    return `🛠 **Adjustment**\nSaldo ${result.tx.account.toUpperCase()} diset menjadi ${fmt(result.tx.amount)}.`;
  }

  if (result.type === 'koreksi') { // koreksi / undo
    const lastTx = deleteLastTx(userCode); // Hapus milik user yang request saja
    if (lastTx) {
      const reverseTx = { ...lastTx, amount: -lastTx.amount, note: `[CORRECTION] ${lastTx.note}` };
      appendToSheet(reverseTx).catch(console.error);
      return `↩️ **UNDO BERHASIL**\nDihapus: ${lastTx.note} (${fmt(Math.abs(lastTx.amount))})`;
    }
    return "❌ Tidak ada data untuk dihapus.";
  }

  if (result.type === 'tx') {
    if (result.category === 'Lainnya') {
      pendingTxs[chatId] = result.tx;
      const buttons = CATEGORIES.map(c => `\`${c.cat}\``).join(', ');
      return `📂 **Pilih Kategori:**\n${buttons}\n\n_Ketik nama kategori di atas atau 'batal'_`;
    }
    
    addTx(result.tx);
    appendToSheet(result.tx);
    
    const icon = result.tx.amount >= 0 ? '🤑' : '💸';
    return `${icon} **Tersimpan!**\n${result.tx.category}: ${fmt(Math.abs(result.tx.amount))}\nAccount: ${result.tx.account.toUpperCase()}`;
  }

  return null;
}

// Start Polling
pollUpdates(handleMessage);
