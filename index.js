import express from "express";
import fs from 'fs';
import http from 'http';
import https from 'https';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument, deleteMessage, downloadFile } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, deleteLastTx, rebuildDatabase, getLatestTransactions, getAllTransactions, getTotalCCHariIni, importFromDBFile, searchTransactions, getDailyTransactions } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet, downloadFromSheet } from "./sheets.js"; 
import { getCategoryEmoji } from "./categories.js"; 

const app = express();
const botStartTime = new Date(); 

app.get("/", (req, res) => res.send("Bot MaYo Finance v12.9 (Fixed Rekap UI & Strict Whitelist)"));
app.get("/health", (req, res) => res.status(200).json({ status: "ok", uptime: botStartTime }));

// [FITUR] Keep-Alive Internal
const startKeepAlive = () => {
    setInterval(() => {
        const url = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
        if (!url) return;
        const protocol = url.startsWith("https") ? https : http;
        protocol.get(url, (res) => {}).on('error', (e) => console.error("Keep-Alive Error:", e.message));
    }, 10 * 60 * 1000); 
};

const fmt = (num) => new Intl.NumberFormat("id-ID").format(num);

async function handleMessage(msg) {
    const text = msg.text;
    if (!text) return null;
    
    // --- [KONTEKS 1] STRICT SECURITY WHITELIST ---
    const chatId = msg.chat.id;
    const senderId = msg.from ? msg.from.id.toString() : chatId.toString();
    
    const ID_MALVIN = process.env.TELEGRAM_USER_ID; 
    const ID_PARTNER = process.env.USER_ID_PARTNER;

    let userCode = null;
    let userLabel = '';

    if (senderId === ID_MALVIN) {
        userCode = 'M';
        userLabel = 'MALVIN';
    } else if (senderId === ID_PARTNER) {
        userCode = 'Y';
        userLabel = 'YOVITA';
    } else {
        console.log(`⛔ Unauthorized Access: ${senderId}`);
        return null; // Silent Ignore
    }
    
    const lowText = text.toLowerCase().trim();
    const line = "────────────────";

    // --- 1. FITUR MENU ---
    if (lowText === 'menu') {
        return `🏠 **MENU MAYO FINANCE**\n${line}\n` +
               `👤 **User:** ${userLabel}\n` +
               `🆔 **ID:** \`${senderId}\`\n\n` +
               `💰 **Input Cepat:**\n\`15k bca mkn siang\`\n\`50rb gopay bensin\`\n\n` +
               `🔄 **Transfer & Saldo:**\n\`tf 50k bca ke gopay\`\n\`ss bca 1.500.000\`\n\n` +
               `📊 **Laporan & Data:**\n• \`rekap\` : Lihat saldo per kategori\n• \`daily\` : Transaksi hari ini\n• \`history\` : 10 transaksi terakhir\n• \`cari [kata]\` : Cari transaksi\n\n` +
               `⚙️ **Sistem:**\n• \`sync\` : Ambil data dari Google Sheet\n• \`export\` : Download PDF Laporan\n• \`backup\` : File Database (.db)\n• \`koreksi\` : Hapus transaksi terakhir\n• \`status\` : Cek kesehatan bot`;
    }

    // --- 2. [UPDATE REQUEST] FITUR REKAP UI ---
    if (lowText === 'rekap') {
        const rekap = getRekapLengkap();
        if (rekap.rows.length === 0) return "📭 Belum ada data transaksi.";

        // Pengelompokan Akun
        const liquidAccs = ['bca', 'cash', 'gopay', 'ovo', 'shopeepay'];
        const assetAccs = ['bibit', 'mirrae', 'bca sekuritas'];

        let res = `📊 **REKAP SALDO KATEGORI**\n${line}\n`;

        const renderUser = (code, name) => {
            const userRows = rekap.rows.filter(r => r.user === code);
            if (userRows.length === 0) return "";

            let section = `👤 **${name}**\n`;
            
            // Sub-kategori Liquid
            const liquids = userRows.filter(r => liquidAccs.includes(r.account));
            if (liquids.length > 0) {
                section += `*-- Liquid --*\n`;
                let subTotal = 0;
                liquids.forEach(r => {
                    section += `• ${r.account.toUpperCase()}: ${fmt(r.balance)}\n`;
                    subTotal += r.balance;
                });
                section += `Sub-Total: ${fmt(subTotal)}\n`;
            }

            // Sub-kategori Assets
            const assets = userRows.filter(r => assetAccs.includes(r.account));
            if (assets.length > 0) {
                section += `*-- Asset/Invest --*\n`;
                let subTotal = 0;
                assets.forEach(r => {
                    section += `• ${r.account.toUpperCase()}: ${fmt(r.balance)}\n`;
                    subTotal += r.balance;
                });
                section += `Sub-Total: ${fmt(subTotal)}\n`;
            }

            // Total per User
            const totalU = userRows.reduce((a, b) => a + b.balance, 0);
            section += `**TOTAL ${code}: Rp ${fmt(totalU)}**\n\n`;
            return section;
        };

        res += renderUser('M', 'MALVIN');
        res += renderUser('Y', 'YOVITA');
        res += `${line}\n💰 **NETWORTH: Rp ${fmt(rekap.totalWealth)}**`;
        return res;
    }

    // --- 3. FITUR STATUS (WITA CONTEXT) ---
    if (lowText === 'status') {
        const diff = Math.floor((new Date() - botStartTime) / 1000);
        const hours = Math.floor(diff / 3600);
        const mins = Math.floor((diff % 3600) / 60);
        const rekap = getRekapLengkap(); 
        return `🤖 **STATUS BOT MAYO**\n${line}\n` +
               `✅ Sistem: **ONLINE**\n` +
               `👤 User Aktif: **${userLabel}**\n` + 
               `🛡️ Security: **Whitelist Active**\n` +
               `🕒 Uptime: ${hours}j ${mins}m\n` +
               `📊 Database: ${rekap.rows.length} Akun\n` +
               `📅 WITA: ${new Date().toLocaleString('id-ID', {timeZone: 'Asia/Makassar'})}`;
    }

    // --- FITUR LAINNYA (LOCKED/STABIL) ---
    if (lowText === 'sync') {
        await sendMessage(chatId, "🔄 **SYNC STARTED**...");
        try {
            const data = await downloadFromSheet();
            if (data && data.length > 0) {
                const count = rebuildDatabase(data);
                return `✅ **SYNC SUKSES**\nTotal: ${count} baris data.`;
            }
            return "⚠️ Sheet kosong.";
        } catch (e) { return `❌ Gagal: ${e.message}`; }
    }

    if (lowText === 'daily' || lowText === 'history') {
        const txs = lowText === 'daily' ? getDailyTransactions() : getLatestTransactions(10);
        if (txs.length === 0) return "📭 Kosong.";
        let res = `📑 **${lowText.toUpperCase()}**\n${line}\n`;
        txs.forEach(t => {
            const emoji = getCategoryEmoji(t.category);
            res += `${t.user}|${t.account.toUpperCase()}|${fmt(t.amount)}|${emoji}${t.note || t.category}\n`;
        });
        return res;
    }

    if (lowText.startsWith('cari ')) {
        const keyword = lowText.replace('cari ', '').trim();
        const txs = searchTransactions(keyword);
        if (txs.length === 0) return `🔍 Tidak ada hasil untuk "${keyword}"`;
        let res = `🔍 **CARI: ${keyword.toUpperCase()}**\n${line}\n`;
        txs.slice(0, 10).forEach(t => res += `• ${t.timestamp.split(' ')[0]} | ${fmt(t.amount)} | ${t.note}\n`);
        return res;
    }

    if (lowText === 'export') {
        await sendMessage(chatId, "⏳ Exporting PDF...");
        const pdfPath = await createPDF(getAllTransactions());
        await sendDocument(chatId, pdfPath, "📊 Laporan MaYo");
        fs.unlinkSync(pdfPath);
        return null;
    }

    if (lowText === 'backup') {
        await sendDocument(chatId, "./myfinance.db", "📦 Database Backup");
        return null;
    }

    if (lowText === 'koreksi') {
        const deleted = deleteLastTx(userCode);
        if (deleted) return `🗑️ **DIHAPUS**\n${deleted.account.toUpperCase()} | ${fmt(deleted.amount)}\n${deleted.note}`;
        return "⚠️ Tidak ada data.";
    }

    // LOGIKA PARSER (NON-COMMAND)
    const result = parseInput(text, userCode);
    if (result.type === 'error') return null;

    if (result.type === 'adjustment') {
        addTx(result.tx); appendToSheet(result.tx);
        return `✅ **SALDO DIUPDATE**\n👤 ${userLabel} | 🏦 ${result.tx.account.toUpperCase()}\n💰 Posisi: ${fmt(result.tx.amount)}`;
    }

    if (result.type === 'transfer') {
        addTx(result.txOut); appendToSheet(result.txOut);
        addTx(result.txIn);  appendToSheet(result.txIn);
        return `🔄 **TRANSFER BERHASIL**\n💰 **${fmt(Math.abs(result.txOut.amount))}**\n📤 ${result.txOut.account.toUpperCase()}\n📥 ${result.txIn.account.toUpperCase()}`;
    }

    if (result.type === 'tx') {
        addTx(result.tx); appendToSheet(result.tx);
        const emoji = getCategoryEmoji(result.tx.category);
        return `✅ **BERHASIL DICATAT**\n${line}\n👤 ${userLabel} | 🏦 ${result.tx.account.toUpperCase()}\n💰 **${fmt(result.tx.amount)}**\n🏷️ ${emoji} ${result.tx.category}\n📝 ${result.tx.note}`;
    }

    return null;
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server v12.9 running on port ${PORT}`);
    initDB(); 
    startKeepAlive(); 
    pollUpdates(handleMessage); 
});

cron.schedule('55 23 * * *', async () => {
    try {
        const data = await downloadFromSheet();
        if (data.length > 0) rebuildDatabase(data);
    } catch (e) { console.error("Cron Error:", e.message); }
}, { timezone: "Asia/Makassar" });
