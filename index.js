import express from "express";
import fs from 'fs';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument, deleteMessage } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, deleteLastTx, rebuildDatabase, getLatestTransactions, getAllTransactions, getTotalCCHariIni } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet, downloadFromSheet, overwriteSheet } from "./sheets.js";

const app = express();
app.get("/", (req, res) => res.send("Bot MaYo Locked v9.1 Active (Format Fixed)"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

const pendingAdmin = {};    
const LIQUID_LIST = ['bca', 'cash', 'gopay', 'ovo', 'shopeepay'];
const ASSET_LIST = ['bibit', 'mirrae', 'bca sekuritas'];
let lastBackupMsgId = null; 

// --- CRON JOBS ---
cron.schedule('58 */14 * * * *', async () => {
  try {
    const allData = getAllTransactions();
    if (allData.length > 0) await overwriteSheet(allData); // Auto Sync format baru

    const ownerId = process.env.TELEGRAM_USER_ID;
    if (ownerId) {
        if (lastBackupMsgId) await deleteMessage(ownerId, lastBackupMsgId);
        const caption = `🔄 Auto-Backup (${new Date().toLocaleString('id-ID')})`;
        const result = await sendDocument(ownerId, "myfinance.db", caption, true); 
        if (result && result.ok) lastBackupMsgId = result.result.message_id;
    }
  } catch (err) { console.error("[AUTO BACKUP ERROR]", err); }
});

cron.schedule('0 21 * * *', async () => {
    const ownerId = process.env.TELEGRAM_USER_ID;
    const ccData = getTotalCCHariIni();
    if (ccData && ccData.total < 0) { 
        const msg = `🔔 TAGIHAN CC HARI INI\n${line}\nTotal: ${fmt(Math.abs(ccData.total))}\nSegera lunasi ya! 💳`;
        await sendMessage(ownerId, msg);
    }
});

const getSisaSaldo = (user, account) => {
  const rekap = getRekapLengkap();
  const row = rekap.rows.find(r => r.user === user && r.account.toLowerCase() === account.toLowerCase());
  return row ? row.balance : 0;
};

const handleMessage = async (msg) => {
  try {
    const chatId = msg.chat.id;
    const fromId = msg.from.id;
    const text = msg.text ? msg.text.trim() : "";
    const lowText = text.toLowerCase();

    const isMalvin = fromId === parseInt(process.env.TELEGRAM_USER_ID || 5023700044);
    const isYovita = fromId === parseInt(process.env.USER_ID_PARTNER || 8469259152);
    
    if (!isMalvin && !isYovita) return;
    
    const userCode = isMalvin ? 'M' : 'Y';
    const userLabel = isMalvin ? "MALVIN" : "YOVITA";

    // 1. SYSTEM COMMANDS
    if (lowText === 'menu' || lowText === 'help' || lowText === '/start') {
        return `🤖 MENU PERINTAH\n${line}\n` +
               `📝 50rb makan bca (Catat)\n` +
               `🔧 ss [akun] [jml] (Set Saldo)\n` +
               `🔄 tf [jml] [dari] [ke] (Transfer)\n` +
               `↩️ koreksi (Undo)\n` +
               `📊 rekap | history | pdf\n` +
               `💾 backup (Manual DB)\n` +
               `☁️ sync push (Update Sheet)`;
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
        
        let res = `🗓️ ${data.length} TRANSAKSI TERAKHIR\n${line}\n`;
        data.forEach(r => {
            const date = new Date(r.timestamp.replace(" ", "T")).getDate();
            const icon = r.amount >= 0 ? '📈' : '📉';
            let noteTrunc = r.note.length > 12 ? r.note.substring(0,12)+".." : r.note;
            res += `${date} ${icon} ${noteTrunc} : ${fmt(Math.abs(r.amount))}\n`;
        });
        return res;
    }

    if (lowText === 'sync push') {
        const allData = getAllTransactions();
        await overwriteSheet(allData);
        return `✅ Berhasil Update Format Sheet (${allData.length} data).`;
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
        return await sendDocument(chatId, "myfinance.db", "💾 Manual Backup");
    }

    // 2. LOGIKA PENDING TRANSFER FEE
    if (pendingAdmin[chatId] && !isNaN(text.replace(/k/gi, '000'))) {
        const fee = parseFloat(text.replace(/k/gi, '000'));
        const { txOut, txIn } = pendingAdmin[chatId];
        
        addTx(txOut); addTx(txIn); 
        appendToSheet(txOut); appendToSheet(txIn);
        
        if (fee > 0) {
            const txFee = { ...txOut, amount: -fee, category: 'Tagihan', note: `Admin Transfer: ${txOut.note}` };
            addTx(txFee); appendToSheet(txFee);
        }
        
        delete pendingAdmin[chatId];
        return `✅ **Transfer Sukses**\n${txOut.account.toUpperCase()} ➔ ${txIn.account.toUpperCase()}\nBiaya Admin: ${fmt(fee)}`;
    }

    // 3. PARSER TRANSAKSI
    const result = parseInput(text, userCode);
    
    if (result.type === 'error') {
        const knownCmds = ['ss', 'tf', 'sync', 'laporan'];
        if (knownCmds.some(x => lowText.startsWith(x))) {
             return `⚠️ **FORMAT SALAH**\nContoh: \`50rb makan bca\`\nAtau ketik \`menu\`.`;
        }
        return null;
    }

    if (result.type === 'adjustment') {
        addTx(result.tx); appendToSheet(result.tx);
        return `✅ SALDO DIUPDATE\n👤 ${userLabel} | 🏦 ${result.tx.account.toUpperCase()}\n💰 ${fmt(result.tx.amount)}`;
    }

    if (result.type === 'transfer') {
        pendingAdmin[chatId] = { txOut: result.txOut, txIn: result.txIn };
        return `🔄 TRANSFER\n${result.txOut.account.toUpperCase()} (${result.txOut.user}) ➔ ${result.txIn.account.toUpperCase()} (${result.txIn.user})\nNominal: ${fmt(Math.abs(result.txOut.amount))}\n\n**Biaya Admin?** (Ketik 0 jika gratis)`;
    }

    if (result.type === 'tx') {
        addTx(result.tx); appendToSheet(result.tx);
        return `✅ ${result.tx.category.toUpperCase()}\n${result.tx.note} : ${fmt(Math.abs(result.tx.amount))}\n(${result.tx.account.toUpperCase()})`;
    }
  
  } catch (err) {
      console.error("Handler Error:", err);
      return `❌ Terjadi kesalahan sistem: ${err.message}`;
  }
};

pollUpdates(handleMessage);
