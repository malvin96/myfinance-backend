import express from "express";
import fs from 'fs';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument, deleteMessage, downloadFile } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, deleteLastTx, rebuildDatabase, getLatestTransactions, getAllTransactions, getTotalCCHariIni, importFromDBFile, searchTransactions, getDailyTransactions } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet, downloadFromSheet } from "./sheets.js"; 
import { getCategoryEmoji } from "./categories.js"; // Import Helper Emoji

const app = express();
app.get("/", (req, res) => res.send("Bot MaYo Locked v12.0 (UI & Features Updated)"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

const LIQUID_LIST = ['bca', 'cash', 'gopay', 'ovo', 'shopeepay'];
const ASSET_LIST = ['bibit', 'mirrae', 'bca sekuritas'];
let lastBackupMsgId = null; 

// --- HELPER UI ---
const buildHistoryUI = (data, title) => {
    if (data.length === 0) return `📂 ${title} Kosong.`;
    let res = `🗓️ **${title.toUpperCase()} (${data.length})**\n`;
    data.forEach(r => {
        let dateStr = "??/??";
        if (r.timestamp && r.timestamp.length >= 10) {
            const mo = r.timestamp.substring(5, 7); 
            const da = r.timestamp.substring(8, 10); 
            dateStr = `${da}/${mo}`;
        }
        const icon = r.amount >= 0 ? '🟢' : '🔴';
        const userNm = r.user === 'M' ? 'Malvin' : 'Yovita';
        const catEmoji = getCategoryEmoji(r.category); // Pakai Emoji
        
        res += `${line}\n`;
        res += `📅 ${dateStr} | ${userNm}\n`;
        res += `🏦 ${r.account.toUpperCase()} | ${catEmoji} ${r.note}\n`;
        res += `${icon} **${fmt(r.amount)}**\n`;
    });
    return res + line;
};

// --- HELPER DAILY RECAP ---
const generateDailyRecap = () => {
    const txs = getDailyTransactions();
    const todayStr = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: '2-digit' });
    
    if (txs.length === 0) return `📅 **REKAP HARIAN (${todayStr})**\n${line}\nBelum ada transaksi hari ini.`;

    let msg = `📅 **REKAP HARIAN (${todayStr})**\n${line}`;
    let grandTotalExpense = 0;

    ['M', 'Y'].forEach(code => {
        const userTxs = txs.filter(t => t.user === code);
        if (userTxs.length === 0) return;

        const label = code === 'M' ? '🧔 MALVIN' : '👩 YOVITA';
        msg += `\n${label}\n`;

        // 1. Pengeluaran
        const expenses = userTxs.filter(t => t.amount < 0 && t.category !== 'Transfer');
        if (expenses.length > 0) {
            msg += `🔻 *Pengeluaran:*\n`;
            // Group by Account
            const accGroup = {};
            expenses.forEach(t => {
                const acc = t.account.toUpperCase();
                accGroup[acc] = (accGroup[acc] || 0) + t.amount;
            });
            for (const [acc, total] of Object.entries(accGroup)) {
                msg += `   • ${acc}: ${fmt(Math.abs(total))}\n`;
            }
            const totalExp = expenses.reduce((a, b) => a + b.amount, 0);
            grandTotalExpense += Math.abs(totalExp);
        }

        // 2. Pendapatan (Jika ada)
        const incomes = userTxs.filter(t => t.amount > 0 && t.category !== 'Transfer');
        if (incomes.length > 0) {
            msg += `🟢 *Pendapatan:*\n`;
            incomes.forEach(t => {
                msg += `   • ${t.category}: ${fmt(t.amount)} (${t.account.toUpperCase()})\n`;
            });
        }
        msg += `\n`; // Spacer antar user
    });

    msg += `${line}\n💸 **TOTAL PENGELUARAN: ${fmt(grandTotalExpense)}**`;
    return msg;
};

// --- CRON JOBS ---
cron.schedule('58 */14 * * * *', async () => {
  try {
    const ownerId = process.env.TELEGRAM_USER_ID;
    if (ownerId) {
        if (lastBackupMsgId) await deleteMessage(ownerId, lastBackupMsgId);
        const timeString = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
        const caption = `💾 **AUTO BACKUP**\n📅 ${timeString} WITA\n_Sheet adalah Master Data._`;
        const result = await sendDocument(ownerId, "myfinance.db", caption, true); 
        if (result && result.ok) lastBackupMsgId = result.result.message_id;
    }
  } catch (err) { console.error("[AUTO BACKUP ERROR]", err); }
});

// [FITUR BARU] Auto Daily Recap jam 23:00 WITA
cron.schedule('0 23 * * *', async () => {
    const ownerId = process.env.TELEGRAM_USER_ID;
    const msg = generateDailyRecap();
    await sendMessage(ownerId, msg);
}, { timezone: "Asia/Makassar" });

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
    
    // Logic Restore DB
    if (msg.document && msg.document.file_name && msg.document.file_name.endsWith('.db')) {
        await sendMessage(chatId, "📥 **Menerima Database...**\nMohon tunggu, sedang memproses file.");
        const tempPath = "temp_restore.db";
        const success = await downloadFile(msg.document.file_id, tempPath);
        if (!success) return "❌ Gagal download file.";
        const count = importFromDBFile(tempPath);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        if (count >= 0) return `✅ **RESTORE SUKSES**\nDatabase berhasil diperbarui.\n📊 Total Data: ${count} transaksi.`;
        return "❌ File rusak atau format database tidak valid.";
    }

    const text = msg.text ? msg.text.trim() : "";
    const lowText = text.toLowerCase();

    const isMalvin = fromId === parseInt(process.env.TELEGRAM_USER_ID || 5023700044);
    const isYovita = fromId === parseInt(process.env.USER_ID_PARTNER || 8469259152);
    
    if (!isMalvin && !isYovita) return;
    
    const userCode = isMalvin ? 'M' : 'Y';
    const userLabel = isMalvin ? "MALVIN" : "YOVITA";

    // 1. SYSTEM COMMANDS (UI MENU UPDATE)
    if (lowText === 'menu' || lowText === 'help' || lowText === '/start') {
        return `🤖 **MENU PERINTAH (WITA)**\n${line}\n` +
               `📝 **CATAT TRANSAKSI**\n` +
               `Format: _[Nominal] [Ket] [Akun]_\n` +
               `👉 \`50rb makan siang bca\`\n` +
               `👉 \`gaji 10jt bca\` (Income)\n\n` +
               `🔄 **TRANSFER DANA**\n` +
               `Format: _tf [Jml] [Dari] [Ke]_\n` +
               `👉 \`tf 500k bca ke cash\`\n` +
               `👉 \`tf 1jt bca ke bca yovita\`\n\n` +
               `🔍 **MONITORING**\n` +
               `• \`cari [kata]\` : Cari transaksi\n` +
               `• \`daily\` : Rekap harian\n` +
               `• \`rekap\` | \`saldo\` : Cek aset\n` +
               `• \`history [n]\` : Riwayat terakhir\n` +
               `• \`export\` | \`pdf\` : Laporan PDF\n\n` +
               `🔧 **UTILITIES**\n` +
               `• \`ss [akun] [jml]\` : Set Saldo\n` +
               `• \`koreksi\` | \`undo\` : Batal Tx\n` +
               `• \`sync\` : Tarik Data Sheet\n` +
               `• \`backup\` : Ambil file .db`;
    }

    // [UI UPDATE] Rekap dengan Bullet & Uppercase Header
    if (lowText.includes('rekap') || lowText.includes('saldo') || lowText === 'cek') {
        const rekap = getRekapLengkap();
        const buildUI = (code, label) => {
            const rows = rekap.rows.filter(r => r.user === code);
            let s = `\n${code === 'M' ? '🧔' : '👩'} ${label}\n`;
            
            // Liquid
            const liquid = rows.filter(r => LIQUID_LIST.includes(r.account.toLowerCase()));
            s += `💧 **LIQUID:**\n`;
            liquid.forEach(r => s += `   🔹 ${r.account.toUpperCase()}: ${fmt(r.balance)}\n`);
            const totLiq = liquid.reduce((a,b)=>a+b.balance,0);
            s += `   _Total Liquid : ${fmt(totLiq)}_\n`;
            
            // Assets
            const assets = rows.filter(r => ASSET_LIST.includes(r.account.toLowerCase()));
            if (assets.length > 0) {
                s += `\n💼 **ASSETS:**\n`;
                assets.forEach(r => s += `   🔸 ${r.account.toUpperCase()}: ${fmt(r.balance)}\n`);
                const totAst = assets.reduce((a,b)=>a+b.balance,0);
                s += `   _Total Asset : ${fmt(totAst)}_\n`;
            }
            return s;
        };
        
        let res = `📊 REKAP KEUANGAN\n${line}`;
        res += buildUI('M', 'MALVIN');
        res += `\n${line}`;
        res += buildUI('Y', 'YOVITA');
        res += `\n${line}\n🌍 NET WORTH: ${fmt(rekap.totalWealth)}\n${line}`;
        return res;
    }

    // [FITUR BARU] Cari Transaksi
    if (lowText.startsWith('cari')) {
        const parts = lowText.split(' ');
        const keyword = parts[1];
        if (!keyword) return "🔍 Ketik `cari [kata kunci]`";
        const limit = parseInt(parts[2]) || 10; // Default 10 hasil
        
        const results = searchTransactions(keyword, limit);
        return buildHistoryUI(results, `HASIL PENCARIAN "${keyword}"`);
    }

    // [FITUR BARU] Daily Recap Manual
    if (lowText === 'daily' || lowText === 'harian') {
        return generateDailyRecap();
    }

    if (lowText.startsWith('history')) {
        const numOnly = lowText.replace(/[^0-9]/g, ''); 
        const limit = parseInt(numOnly) || 10;
        const data = getLatestTransactions(limit);
        return buildHistoryUI(data, "RIWAYAT TRANSAKSI");
    }

    if (lowText === 'sync') {
        await sendMessage(chatId, "⏳ **SYNC START**\nSedang menarik & validasi data Sheet...");
        const data = await downloadFromSheet();
        if (data.length > 0) {
            const inserted = rebuildDatabase(data);
            return inserted > 0 
                ? `✅ **SYNC BERHASIL**\n📥 Ditemukan: ${data.length}\n💾 Disimpan: ${inserted} transaksi`
                : `⚠️ **SYNC WARNING**\nGagal simpan DB.`;
        }
        return "❌ Gagal sync. Sheet kosong/error.";
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

    if (result.type === 'transfer') {
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
        // [UI UPDATE] Tambah Emoji Kategori
        const catEmoji = getCategoryEmoji(result.tx.category);
        return `✅ ${catEmoji} ${result.tx.category.toUpperCase()} | ${userLabel}\n${result.tx.note} : ${fmt(Math.abs(result.tx.amount))}\n(${result.tx.account.toUpperCase()})`;
    }
  
  } catch (err) {
      console.error("Handler Error:", err);
      return `❌ Sistem Error: ${err.message}`;
  }
};

pollUpdates(handleMessage);
