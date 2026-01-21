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

// --- HELPER FORMATTING (WITA / GMT+8) ---
// Fungsi ini memastikan string tanggal yang dihasilkan mengikuti waktu Makassar (WITA)
const getWITAString = (dateInput) => {
    const d = dateInput ? new Date(dateInput) : new Date();
    // Konversi ke Timezone Asia/Makassar
    return d.toLocaleString('sv-SE', { timeZone: 'Asia/Makassar' }).replace(' ', ' '); 
    // sv-SE formatnya YYYY-MM-DD HH:mm:ss, sangat cocok untuk Database & Sheet
};

const getMonthName = (dateInput) => {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        if (isNaN(d.getTime())) return "Check Date";
        return d.toLocaleString('id-ID', { month: 'long', timeZone: 'Asia/Makassar' });
    } catch { return "Error"; }
};

const getYear = (dateInput) => {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        // Trik mendapatkan tahun di timezone spesifik
        const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Makassar' }).formatToParts(d);
        return parts.find(p => p.type === 'year').value;
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
      
      // [LOGIKA] Penentuan Type
      let finalType = tx.amount >= 0 ? 'Income' : 'Expense';
      if (tx.category.toLowerCase() === 'transfer') finalType = 'Transfer';

      // Pastikan Timestamp menggunakan WITA
      const witaTimestamp = tx.timestamp ? tx.timestamp : getWITAString();

      const rowData = {
        'Timestamp': witaTimestamp,
        'User': tx.user === 'M' ? 'Malvin' : (tx.user === 'Y' ? 'Yovita' : tx.user),
        'Type': finalType,
        'Category': tx.category,
        'Note': tx.note,
        'Account': tx.account.toUpperCase(),
        'Amount': Math.abs(tx.amount), 
        'RealAmount': tx.amount,       
        'Bulan': getMonthName(witaTimestamp),
        'Tahun': getYear(witaTimestamp)
      };

      await sheet.addRow(rowData);
      console.log(`✅ Row added to Sheet: ${tx.note} [${finalType}]`);
    } catch (error) {
      console.error("❌ Error Add Row:", error.message);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  isProcessing = false;
}

export function appendToSheet(tx) {
  // Jika tx belum punya timestamp, buat timestamp sekarang (WITA)
  if (!tx.timestamp) {
      tx.timestamp = getWITAString();
  }
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
      const raw = row.toObject ? row.toObject() : row; 
      
      let u = 'M';
      const sheetUser = raw['User'];
      if (sheetUser && (sheetUser.includes('Yovita') || sheetUser === 'Y')) u = 'Y';
      
      let val = raw['RealAmount'];
      if (val === undefined || val === null || val === '') val = raw['Amount']; 

      let cleanVal = String(val).replace(/[^0-9.-]/g, ''); 
      const realAmt = parseFloat(cleanVal);

      const ts = raw['Timestamp'] || getWITAString();

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
