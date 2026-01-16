import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

// Handle Private Key (Mencegah error newline pada beberapa env)
const privateKey = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;
const auth = new JWT({ email: process.env.GOOGLE_CLIENT_EMAIL, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

// --- 1. SISTEM ANTRIAN (QUEUE) ---
const queue = [];
let isProcessing = false;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;
  while (queue.length > 0) {
    const tx = queue.shift();
    try {
      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0];
      const now = new Date();
      const dateStr = now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
      const bulan = now.toLocaleString("id-ID", { month: "long", timeZone: "Asia/Jakarta" });
      const tahun = now.getFullYear();

      let amount = tx.amount;
      // Logika Accounting: Expense Negatif, Income Positif
      if (tx.category !== "Pendapatan" && tx.category !== "Saldo Awal" && amount > 0) amount = -amount;
      if (tx.category === "Transfer") amount = 0; 
      
      // Smart Correction: Jangan ubah nilai jika ini adalah koreksi
      if (tx.note && tx.note.includes("AUTO CORRECTION")) {
         // Pass
      }

      await sheet.addRow({
        Timestamp: dateStr,
        User: tx.user === 'M' ? 'Malvin' : 'Yovita',
        Type: amount > 0 ? 'Income' : 'Expense',
        Category: tx.category,
        Note: tx.note,
        Account: tx.account.toUpperCase(),
        Amount: Math.abs(amount), // Tampilan (Mutlak)
        RealAmount: amount,       // [KUNCI SYNC] Nilai Asli (+/-)
        Bulan: bulan,             // [BARU]
        Tahun: tahun              // [BARU]
      });
      
      console.log(`✅ Sukses ke Sheet: ${tx.note}`);
      await delay(2000); // Jeda 2 detik

    } catch (error) {
      console.error("Gagal update Google Sheet:", error);
    }
  }
  isProcessing = false;
}

export async function appendToSheet(tx) {
  queue.push(tx);
  processQueue();
}

// --- 2. FITUR DOWNLOAD (AUTO-SYNC) ---
export async function downloadFromSheet() {
  try {
    console.log("☁️ Mengunduh data dari Google Sheet...");
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    // Mapping Data Sheet -> Format Database
    const transactions = rows.map(row => {
      // Validasi: Wajib ada Akun dan RealAmount
      if (!row.get('Account') || !row.get('RealAmount')) return null;

      let user = 'M';
      const uRaw = row.get('User');
      if (uRaw && uRaw.toLowerCase().includes('yovita')) user = 'Y';
      
      // Bersihkan format angka
      const amount = parseFloat(row.get('RealAmount').toString().replace(/[^0-9\.\-]/g, ''));

      return {
        timestamp: row.get('Timestamp'), // Gunakan timestamp asli dari sheet
        user: user,
        account: row.get('Account').toLowerCase(),
        category: row.get('Category'),
        note: row.get('Note'),
        amount: isNaN(amount) ? 0 : amount
      };
    }).filter(t => t !== null);

    return transactions;

  } catch (error) {
    console.error("❌ Gagal Sync Sheet (Cek Izin/Env):", error);
    return [];
  }
}
