import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

// Menangani Private Key dengan aman
const privateKey = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;
const auth = new JWT({ email: process.env.GOOGLE_CLIENT_EMAIL, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

// --- SISTEM ANTRIAN (QUEUE) ---
const queue = [];
let isProcessing = false;

// Fungsi delay untuk memberi jeda nafas ke Google API
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  
  isProcessing = true;
  while (queue.length > 0) {
    const tx = queue.shift(); // Ambil data antrian pertama
    try {
      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0];
      const date = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
      
      let amount = tx.amount;
      // Logika Amount: Expense jadi negatif, Income positif
      if (tx.category !== "Pendapatan" && tx.category !== "Saldo Awal" && amount > 0) amount = -amount;
      if (tx.category === "Transfer") amount = 0; 
      
      // Smart Correction: Biarkan apa adanya jika ini koreksi (karena sudah dibalik logicnya)
      if (tx.note && tx.note.includes("AUTO CORRECTION")) {
         // Pass
      }

      await sheet.addRow({
        Timestamp: date,
        User: tx.user === 'M' ? 'Malvin' : 'Yovita',
        Type: amount > 0 ? 'Income' : 'Expense',
        Category: tx.category,
        Note: tx.note,
        Account: tx.account.toUpperCase(),
        Amount: Math.abs(amount),
        RealAmount: amount
      });
      
      console.log(`✅ Sukses ke Sheet: ${tx.note}`);
      // JEDA 2 DETIK AGAR TIDAK DITOLAK GOOGLE (Safety)
      await delay(2000); 

    } catch (error) {
      console.error("Gagal update Google Sheet:", error);
      // Jika error critical, bisa dimasukkan logic retry disini
    }
  }
  isProcessing = false;
}

export async function appendToSheet(tx) {
  queue.push(tx); // Masukkan ke antrian
  processQueue(); // Jalankan proses di background
}
