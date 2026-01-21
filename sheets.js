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

// --- HELPER FORMATTING ---
const getSheetDate = (dateInput) => {
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

// --- 1. QUEUE SYSTEM (Antrian Upload ke Sheet) ---
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
      
      const rowData = {
        'Timestamp': getSheetDate(tx.timestamp),
        'User': tx.user === 'M' ? 'Malvin' : (tx.user === 'Y' ? 'Yovita' : tx.user),
        'Type': tx.amount >= 0 ? 'Income' : 'Expense',
        'Category': tx.category,
        'Note': tx.note,
        'Account': tx.account.toUpperCase(),
        'Amount': Math.abs(tx.amount), 
        'RealAmount': tx.amount,       
        'Bulan': getMonthName(tx.timestamp),
        'Tahun': getYear(tx.timestamp)
      };

      await sheet.addRow(rowData);
      console.log(`✅ Row added to Sheet: ${tx.note}`);
    } catch (error) {
      console.error("❌ Error Add Row:", error.message);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  isProcessing = false;
}

export function appendToSheet(tx) {
  queue.push(tx);
  processQueue();
}

// --- 2. SYNC PULL (Sheet adalah Master Data) ---
export async function downloadFromSheet() {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    return rows.map(row => {
      // Mapping User agar kompatibel dengan Bot
      let u = 'M';
      const sheetUser = row.get('User');
      if (sheetUser === 'Yovita' || sheetUser === 'Y') u = 'Y';
      
      // Mengambil 'RealAmount' karena itu yang mengandung nilai +/-
      const realAmt = parseFloat(row.get('RealAmount')); 

      return {
        timestamp: row.get('Timestamp'),
        user: u,
        account: row.get('Account') ? row.get('Account').toLowerCase() : 'cash',
        amount: isNaN(realAmt) ? 0 : realAmt,
        category: row.get('Category'),
        note: row.get('Note')
      };
    });
  } catch (error) {
    console.error("❌ Error Download Sheet:", error.message);
    return [];
  }
}
