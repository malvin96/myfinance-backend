import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

// Setup Auth
const privateKey = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;
const auth = new JWT({ 
    email: process.env.GOOGLE_CLIENT_EMAIL, 
    key: privateKey, 
    scopes: ['https://www.googleapis.com/auth/spreadsheets'] 
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

// --- HELPER FORMATTING (Sesuai CSV Anda) ---
const getSheetDate = (dateInput) => {
    // Output: YYYY-MM-DD HH:mm:ss (Sesuai format tabel Anda)
    const d = dateInput ? new Date(dateInput.replace(" ", "T")) : new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const getMonthName = (dateInput) => {
    const d = dateInput ? new Date(dateInput.replace(" ", "T")) : new Date();
    return d.toLocaleString('id-ID', { month: 'long', timeZone: 'Asia/Jakarta' });
};

const getYear = (dateInput) => {
    const d = dateInput ? new Date(dateInput.replace(" ", "T")) : new Date();
    return d.getFullYear();
};

// --- 1. QUEUE SYSTEM (Antrian Upload) ---
const queue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;
  while (queue.length > 0) {
    const tx = queue.shift();
    try {
      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0];
      
      // Persiapan Data Baris (Row)
      const rowData = {
        'Timestamp': getSheetDate(tx.timestamp),
        'User': tx.user === 'M' ? 'Malvin' : (tx.user === 'Y' ? 'Yovita' : tx.user),
        'Type': tx.amount >= 0 ? 'Income' : 'Expense',
        'Category': tx.category,
        'Note': tx.note,
        'Account': tx.account.toUpperCase(),
        'Amount': Math.abs(tx.amount), // Angka Absolut (Positif)
        'RealAmount': tx.amount,       // Angka Asli (+/-)
        'Bulan': getMonthName(tx.timestamp), // Auto-fill Value
        'Tahun': getYear(tx.timestamp)       // Auto-fill Value
      };

      await sheet.addRow(rowData);
      console.log(`✅ Row added to Sheet: ${tx.note} | ${rowData.Timestamp}`);
    } catch (error) {
      console.error("❌ Error Add Row:", error.message);
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay aman
  }
  isProcessing = false;
}

export function appendToSheet(tx) {
  queue.push(tx);
  processQueue();
}

// --- 2. SYNC PULL (Sheet -> Bot) ---
export async function downloadFromSheet() {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    return rows.map(row => ({
      timestamp: row.get('Timestamp'),
      user: (row.get('User') === 'Malvin' || row.get('User') === 'M') ? 'M' : 'Y',
      account: row.get('Account') ? row.get('Account').toLowerCase() : 'cash',
      amount: parseFloat(row.get('RealAmount')), // Ambil value asli
      category: row.get('Category'),
      note: row.get('Note')
    }));
  } catch (error) {
    console.error("❌ Error Download Sheet:", error.message);
    return [];
  }
}

// --- 3. SYNC PUSH (Force Overwrite) ---
export async function overwriteSheet(transactions) {
    try {
        console.log("🔄 Sync Push dimulai...");
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        
        await sheet.clear(); 
        
        // Header sesuai CSV Anda
        await sheet.setHeaderRow([
            'Timestamp', 'User', 'Type', 'Category', 'Note', 
            'Account', 'Amount', 'RealAmount', 'Bulan', 'Tahun'
        ]);
        
        const rows = transactions.map(tx => {
            return {
                'Timestamp': getSheetDate(tx.timestamp),
                'User': tx.user === 'M' ? 'Malvin' : (tx.user === 'Y' ? 'Yovita' : tx.user),
                'Type': tx.amount >= 0 ? 'Income' : 'Expense',
                'Category': tx.category,
                'Note': tx.note,
                'Account': tx.account.toUpperCase(),
                'Amount': Math.abs(tx.amount), // Absolut
                'RealAmount': tx.amount,       // Signed
                'Bulan': getMonthName(tx.timestamp),
                'Tahun': getYear(tx.timestamp)
            };
        });

        await sheet.addRows(rows);
        console.log(`✅ Sukses Push ${rows.length} data dengan Format Baru.`);
        return true;
    } catch (error) {
        console.error("❌ Error Overwrite Sheet:", error.message);
        return false;
    }
}
