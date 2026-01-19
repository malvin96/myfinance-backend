import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

// Setup Auth
const privateKey = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;
const auth = new JWT({ email: process.env.GOOGLE_CLIENT_EMAIL, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

// Helper Formatting
const fmt = (n) => "Rp " + Math.round(Math.abs(n)).toLocaleString("id-ID");
const getMonthName = (date) => new Date(date).toLocaleString('id-ID', { month: 'long', timeZone: 'Asia/Jakarta' });
const getYear = (date) => new Date(date).getFullYear();

// --- 1. QUEUE SYSTEM (Antrian Upload) ---
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
      const timestamp = tx.timestamp || now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
      const dateObj = tx.timestamp ? new Date(tx.timestamp) : now;
      
      // Logika Amount (RealAmount) vs Tampilan (Amount)
      let realAmount = tx.amount;
      if (tx.category !== "Pendapatan" && tx.category !== "Saldo Awal" && realAmount > 0) {
        realAmount = -Math.abs(realAmount);
      }
      if (tx.category === "Pendapatan") {
        realAmount = Math.abs(realAmount);
      }
      
      const type = realAmount >= 0 ? 'Income' : 'Expense';
      const userFull = tx.user === 'M' ? 'Malvin' : 'Yovita';

      // ADD ROW (Format Kolom Anda)
      await sheet.addRow({
        'Timestamp': timestamp,
        'User': userFull,
        'Type': type,
        'Category': tx.category,
        'Note': tx.note,
        'Account': tx.account.toUpperCase(),
        'Amount': fmt(realAmount),    // String "Rp ..."
        'RealAmount': realAmount,     // Angka Murni
        'Bulan': getMonthName(dateObj),
        'Tahun': getYear(dateObj)
      });
      
      console.log(`✅ Sheet Updated: ${tx.note}`);
      await delay(1500); 

    } catch (error) {
      console.error("❌ Gagal update Sheet:", error.message);
    }
  }
  isProcessing = false;
}

export async function appendToSheet(tx) {
  queue.push(tx);
  processQueue();
}

// --- 2. SYNC PULL (Sheet -> Bot) ---
export async function downloadFromSheet() {
  try {
    console.log("☁️ Mengunduh data Sheet...");
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    console.log(`📊 Ditemukan ${rows.length} data.`);

    const transactions = rows.map((row) => {
      // Baca kolom spesifik
      const accRaw = row.get('Account');
      const realAmtRaw = row.get('RealAmount'); 
      const userRaw = row.get('User');
      
      if (!accRaw || !realAmtRaw) return null;

      let user = 'M';
      if (userRaw && userRaw.toString().toLowerCase().includes('yovita')) user = 'Y';
      
      const amount = parseFloat(realAmtRaw.toString().replace(/[^0-9\.\-]/g, ''));

      return {
        timestamp: row.get('Timestamp'),
        user: user,
        account: accRaw.toString().toLowerCase(),
        category: row.get('Category') || 'Lainnya',
        note: row.get('Note') || '',
        amount: amount
      };
    }).filter(item => item !== null && !isNaN(item.amount));

    return transactions;

  } catch (error) {
    console.error("❌ Error Download Sheet:", error.message);
    return [];
  }
}

// --- 3. SYNC PUSH (Bot -> Sheet) ---
export async function overwriteSheet(transactions) {
    try {
        console.log("🔄 Force Push dimulai...");
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        
        await sheet.clear(); // Hapus Total
        
        // SET HEADER WAJIB
        await sheet.setHeaderRow([
            'Timestamp', 'User', 'Type', 'Category', 'Note', 
            'Account', 'Amount', 'RealAmount', 'Bulan', 'Tahun'
        ]);
        
        const rows = transactions.map(tx => {
            const dateObj = new Date(tx.timestamp);
            const type = tx.amount >= 0 ? 'Income' : 'Expense';
            
            return {
                'Timestamp': tx.timestamp,
                'User': tx.user === 'M' ? 'Malvin' : 'Yovita',
                'Type': type,
                'Category': tx.category,
                'Note': tx.note,
                'Account': tx.account.toUpperCase(),
                'Amount': fmt(tx.amount),
                'RealAmount': tx.amount,
                'Bulan': getMonthName(dateObj),
                'Tahun': getYear(dateObj)
            };
        });

        await sheet.addRows(rows);
        console.log(`✅ Sukses Push ${rows.length} data.`);
        return true;
    } catch (error) {
        console.error("❌ Gagal Push:", error);
        return false;
    }
}
