import express from "express";
import fs from 'fs';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument, deleteMessage, downloadFile } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, deleteLastTx, rebuildDatabase, getLatestTransactions, getAllTransactions, getTotalCCHariIni, importFromDBFile } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet, downloadFromSheet } from "./sheets.js"; 

const app = express();
app.get("/", (req, res) => res.send("Bot MaYo Locked v11.5 (Menu & Transfer UI Updated)"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

const LIQUID_LIST = ['bca', 'cash', 'gopay', 'ovo', 'shopeepay'];
const ASSET_LIST = ['bibit', 'mirrae', 'bca sekuritas'];
let lastBackupMsgId = null; 

// --- CRON JOBS ---
cron.schedule('58 */14 * * * *', async () => {
  try {
    const ownerId = process.env.TELEGRAM_USER_ID;
    if (ownerId) {
        if (lastBackupMsgId) await deleteMessage(ownerId, lastBackupMsgId);
        // [WITA TIME]
        const timeString = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
        const caption = `💾 **AUTO BACKUP**\n📅 ${timeString} WITA\n_Sheet adalah Master Data._`;
        const result = await sendDocument(ownerId, "myfinance.db", caption, true); 
        if (result && result.ok) lastBackupMsgId = result.result.message_id;
    }
  } catch (err) { console.error("[AUTO BACKUP ERROR]", err); }
});

cron.schedule('0 21 * * *', async () => {
    const ownerId = process.env.TELEGRAM_USER_ID;
    const ccData = getTotalCCHariIni();
    if (ccData && ccData.total < 0) { 
        const msg = `🔔 TAGIHAN CC HARI INI (WITA)\n${line}\nTotal: ${fmt(Math.abs(ccData.total))}\nSegera lunasi ya! 💳`;
        await sendMessage(ownerId, msg);
    }
});

const handleMessage = async (msg) => {
  try {
    const chatId = msg.chat.id;
    const fromId = msg.from.id;
    
    // [LOGIKA] Deteksi File .db untuk Restore
    if (msg.document && msg.document.file_name && msg.document.file_name.endsWith('.db')) {
        await sendMessage(chatId, "📥 **Menerima Database...**\nMohon tunggu, sedang memproses file.");
        const tempPath = "temp_restore.db";
        
        // 1. Download File
        const success = await downloadFile(msg.document.file_id, tempPath);
        if (!success) return "❌ Gagal download file. Coba lagi.";

        // 2. Import Data (Hot Restore)
        const count = importFromDBFile(tempPath);
        
        // 3. Cleanup
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

        if (count >= 0) {
            return `✅ **RESTORE SUKSES**\nDatabase berhasil diperbarui dari file.\n📊 Total Data: ${count} transaksi.`;
        } else {
            return "❌ File rusak atau format database tidak valid.";
        }
    }

    const text = msg.text ? msg.text.trim() : "";
    const lowText = text.toLowerCase();

    const isMalvin = fromId === parseInt(process.env.TELEGRAM_USER_ID || 5023700044);
    const isYovita = fromId === parseInt(process.env.USER_ID_PARTNER || 8469259152);
    
    if (!isMalvin && !isYovita) return;
    
    const userCode = isMalvin ? 'M' : 'Y';
    const userLabel = isMalvin ? "MALVIN" : "YOVITA";

    // 1. SYSTEM COMMANDS (MENU UI UPDATE)
    if (lowText === 'menu' || lowText === 'help' || lowText === '/start') {
        return `🤖 **MENU PERINTAH**\n${line}\n` +
               `📝 **CATAT TRANSAKSI**\n` +
               `Format: _[Nominal] [Ket] [Akun]_\n` +
               `👉 \`50rb makan siang bca\`\n` +
               `👉 \`gaji 10jt bca\` (Income)\n\n` +
               `🔄 **TRANSFER DANA**\n` +
               `Format: _tf [Jml] [Dari] [Ke]_\n` +
               `👉 \`tf 500k bca ke cash\` (Sendiri)\n` +
               `👉 \`tf 1jt bca ke bca yovita\` (Partner)\n\n` +
               `🔧 **UTILITIES**\n` +
               `• \`ss [akun] [jml]\` (Set Saldo)\n` +
               `• \`koreksi\` (Undo Terakhir)\n` +
               `• \`rekap\` | \`history\` | \`pdf\`\n` +
               `• \`sync\` (Tarik Data Sheet)\n` +
               `• Kirim file .db (Restore Data)`;
    }

    if (lowText.includes('rekap') || lowText.includes('saldo') || lowText === 'cek') {
        const rekap = getRekapLengkap();
        const buildUI = (code, label) => {
            const rows = rekap.rows.filter(r => r.user === code);
            let s = `\n${code === 'M' ? '🧔' : '👩'} ${label}\n💧 Liquid:\n`;
            const liquid = rows.filter(r => LIQUID_LIST.includes(r.account.toLowerCase()));
            liquid.forEach(r => s += `${r.account.toUpperCase()}: ${fmt(r.balance)}\n`);
            const totLiq = liquid.reduce((a,b)=>a+b.balance,0);
            s += `\nTotal ${code} Liquid : ${fmt(totLiq)}\n`;
            
            const assets = rows.filter(r => ASSET_LIST.includes(r.account.toLowerCase()));
            if (assets.length > 0) {
                s += `\n💼 Aset:\n`;
                assets.forEach(r => s += `${r.account.toUpperCase()}: ${fmt(r.balance)}\n`);
                const totAst = assets.reduce((a,b)=>a+b.balance,0);
                s += `\nTotal ${code} Asset : ${fmt(totAst)}\n`;
            }
            return s;
        };
        
        let res = `📊 REKAP KEUANGAN\n${line}\n`;
        res += buildUI('M', 'MALVIN');
        res += buildUI('Y', 'YOVITA');
        res += `\n${line}\n🌍 NET WORTH: ${fmt(rekap.totalWealth)}\n${line}`;
        return res;
    }

    if (lowText.startsWith('history')) {
        const numOnly = lowText.replace(/[^0-9]/g, ''); 
        const limit = parseInt(numOnly) || 10;
        const data = getLatestTransactions(limit);
        
        if (data.length === 0) return `📂 Database Kosong. Silakan ketik 'sync' untuk tarik data.`;

        let res = `🗓️ **RIWAYAT TRANSAKSI (${data.length})**\n`;
        
        data.forEach(r => {
            let dateStr = "??/??";
            // Asumsi format timestamp DB: YYYY-MM-DD HH:mm:ss
            if (r.timestamp && r.timestamp.length >= 10) {
                const mo = r.timestamp.substring(5, 7); 
                const da = r.timestamp.substring(8, 10); 
                dateStr = `${da}/${mo}`;
            }

            const icon = r.amount >= 0 ? '🟢' : '🔴';
            const userNm = r.user === 'M' ? 'Malvin' : 'Yovita';
            
            res += `${line}\n`;
            res += `📅 ${dateStr} | ${userNm}\n`;
            res += `🏦 ${r.account.toUpperCase()} | ${r.note}\n`;
            res += `${icon} **${fmt(r.amount)}**\n`;
        });
        
        return res + line;
    }

    if (lowText === 'sync') {
        await sendMessage(chatId, "⏳ **SYNC START**\nSedang menarik & validasi data Sheet...");
        const data = await downloadFromSheet();
        
        if (data.length > 0) {
            const inserted = rebuildDatabase(data);
            if (inserted > 0) {
                 return `✅ **SYNC BERHASIL**\nDatabase lokal diperbarui.\n📥 Ditemukan: ${data.length} baris\n💾 Disimpan: ${inserted} transaksi`;
            } else {
                 return `⚠️ **SYNC WARNING**\nData ditemukan (${data.length}) tapi GAGAL disimpan ke DB. Cek log console.`;
            }
        }
        return "❌ Gagal sync. Sheet kosong atau kolom 'RealAmount' tidak terbaca.";
    }

    if (lowText.startsWith('export') || lowText.startsWith('pdf')) {
        await sendMessage(chatId, "📄 Sedang membuat laporan...");
        const filePath = await createPDF(getAllTransactions(), "LAPORAN KEUANGAN");
        await sendDocument(chatId, filePath, "📄 Laporan Bulan Ini");
        return null;
    }

    if (lowText === 'koreksi' || lowText === 'undo' || lowText === 'batal') {
        const last = deleteLastTx(userCode);
        if (last) return `↩️ UNDO SUKSES\nDihapus: ${last.note} (${fmt(Math.abs(last.amount))})`;
        return "❌ Tidak ada data transaksi Anda.";
    }

    if (lowText === 'backup' || lowText === 'db') {
        const timeString = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
        return await sendDocument(chatId, "myfinance.db", `💾 Manual Backup\n🕒 ${timeString} WITA`);
    }

    // 2. PARSER
    const result = parseInput(text, userCode);
    if (result.type === 'error') {
        if (['ss', 'tf', 'laporan'].some(x => lowText.startsWith(x))) return `⚠️ **FORMAT SALAH**\nKetik \`menu\` untuk bantuan format.`;
        return null;
    }

    if (result.type === 'adjustment') {
        addTx(result.tx); appendToSheet(result.tx);
        return `✅ SALDO DIUPDATE\n👤 ${userLabel} | 🏦 ${result.tx.account.toUpperCase()}\n💰 ${fmt(result.tx.amount)}`;
    }

    // [TRANSFER UI UPDATE]
    if (result.type === 'transfer') {
        // Eksekusi Langsung
        addTx(result.txOut); appendToSheet(result.txOut);
        addTx(result.txIn);  appendToSheet(result.txIn);

        const uOut = result.txOut.user === 'M' ? 'MALVIN' : 'YOVITA';
        const uIn = result.txIn.user === 'M' ? 'MALVIN' : 'YOVITA';

        return `🔄 **TRANSFER BERHASIL**\n${line}\n` +
               `📤 ${result.txOut.account.toUpperCase()} (${uOut})\n` +
               `📥 ${result.txIn.account.toUpperCase()} (${uIn})\n` +
               `💰 **${fmt(Math.abs(result.txOut.amount))}**\n` +
               `🏷️ Kategori: Transfer`;
    }

    if (result.type === 'tx') {
        addTx(result.tx); appendToSheet(result.tx);
        return `✅ ${result.tx.category.toUpperCase()} | ${userLabel}\n${result.tx.note} : ${fmt(Math.abs(result.tx.amount))}\n(${result.tx.account.toUpperCase()})`;
    }
  
  } catch (err) {
      console.error("Handler Error:", err);
      return `❌ Sistem Error: ${err.message}`;
  }
};

pollUpdates(handleMessage);
