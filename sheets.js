import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

// Handle Private Key (Mencegah error newline pada beberapa env)
const privateKey = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;
const auth = new JWT({ email: process.env.GOOGLE_CLIENT_EMAIL, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

// --- 1. SISTEM ANTRIAN (QUEUE) ---\nconst queue = [];
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
      
      let amount = tx.amount;
      // Logika Accounting: Expense Negatif, Income Positif
      if (tx.category !== "Pendapatan" && tx.category !== "Saldo Awal" && amount > 0) {
        amount = -Math.abs(amount);
      }
      if (tx.category === "Pendapatan") {
        amount = Math.abs(amount);
      }

      await sheet.addRow({
        'Timestamp': tx.timestamp || now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
        'User': tx.user === 'M' ? 'Malvin' : 'Yovita',
        'Account': tx.account.toUpperCase(),
        'Category': tx.category,
        'RealAmount': amount,
        'Note': tx.note
      });
      
      console.log(`✅ Sukses ke Sheet: ${tx.note}`);
      await delay(1500); // Jeda aman

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

// --- 2. FITUR SYNC: PULL (Sheet -> Bot) ---
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
        timestamp: row.get('Timestamp'),
        user: user,
        account: row.get('Account').toLowerCase(),
        category: row.get('Category'),
        note: row.get('Note'),
        amount: amount
      };
    }).filter(item => item !== null); // Hapus baris kosong/invalid

    return transactions;
  } catch (error) {
    console.error("Gagal download sheet:", error);
    return [];
  }
}

// --- 3. FITUR SYNC: PUSH (Bot -> Sheet) ---
// [BARU] Menghapus isi sheet dan menimpa dengan data Database Lokal
export async function overwriteSheet(transactions) {
    try {
        console.log("🔄 Memulai Force Push ke Google Sheet...");
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        
        // 1. Hapus semua baris (Clear Sheet)
        await sheet.clear();
        
        // 2. Pasang Header Kembali
        await sheet.setHeaderRow(['Timestamp', 'User', 'Account', 'Category', 'RealAmount', 'Note']);
        
        // 3. Mapping data DB ke format Sheet
        const rows = transactions.map(tx => ({
            'Timestamp': tx.timestamp,
            'User': tx.user === 'M' ? 'Malvin' : 'Yovita',
            'Account': tx.account.toUpperCase(),
            'Category': tx.category,
            'RealAmount': tx.amount, // Di DB sudah +/- sesuai logic, tinggal masukin
            'Note': tx.note
        }));

        // 4. Upload (Bulk Add)
        await sheet.addRows(rows);
        console.log(`✅ Berhasil Push ${rows.length} data ke Sheet.`);
        return true;
    } catch (error) {
        console.error("❌ Gagal Push ke Sheet:", error);
        return false;
    }
}
