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

// --- HELPER FORMATTING (Safety First) ---
const getSheetDate = (dateInput) => {
    // Memastikan output selalu YYYY-MM-DD HH:mm:ss untuk SQL/Sheet
    try {
        const d = dateInput ? new Date(dateInput.replace(" ", "T")) : new Date();
        if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        const pad = (n) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
        return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
};

const getMonthName = (dateInput) => {
    try {
        const d = dateInput ? new Date(dateInput.replace(" ", "T")) : new Date();
        if (isNaN(d.getTime())) return "Check Date";
        return d.toLocaleString('id-ID', { month: 'long', timeZone: 'Asia/Jakarta' });
    } catch { return "Error"; }
};

const getYear = (dateInput) => {
    try {
        const d = dateInput ? new Date(dateInput.replace(" ", "T")) : new Date();
        if (isNaN(d.getTime())) return new Date().getFullYear();
        return d.getFullYear();
    } catch { return new Date().getFullYear(); }
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
        // [FIX] Validasi Type: Jika >=0 Income, selain itu Expense. Otomatis & Akurat.
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
      console.log(`✅ Row added to Sheet: ${tx.note} [${rowData.Type}]`);
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
    console.log("📥 Memulai Download Sheet...");
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    if (rows.length === 0) {
        console.log("⚠️ Sheet kosong, tidak ada data yang ditarik.");
        return [];
    }

    const cleanedData = rows.map(row => {
      // Konversi row ke object aman
      const raw = row.toObject ? row.toObject() : row; 
      
      // Mapping User
      let u = 'M';
      const sheetUser = raw['User'];
      if (sheetUser && (sheetUser.includes('Yovita') || sheetUser === 'Y')) u = 'Y';
      
      // Ambil RealAmount (Pastikan angka)
      let val = raw['RealAmount'];
      if (val === undefined || val === null || val === '') val = raw['Amount']; 

      let cleanVal = String(val).replace(/[^0-9.-]/g, ''); 
      const realAmt = parseFloat(cleanVal);

      const ts = raw['Timestamp'] || new Date().toISOString().replace('T', ' ').slice(0, 19);

      return {
        timestamp: ts,
        user: u,
        account: raw['Account'] ? raw['Account'].toLowerCase() : 'cash',
        amount: isNaN(realAmt) ? 0 : realAmt,
        category: raw['Category'] || 'Lainnya',
        note: raw['Note'] || '-'
      };
    });

    console.log(`✅ Berhasil download ${cleanedData.length} baris dari Sheet.`);
    return cleanedData;

  } catch (error) {
    console.error("❌ Error Download Sheet:", error.message);
    return [];
  }
}
