import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

const privateKey = process.env.GOOGLE_PRIVATE_KEY 
  ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
  : undefined;

const auth = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: privateKey, 
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

export async function appendToSheet(tx) {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const date = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    let amount = tx.amount;
    // Logika: Pendapatan Positif, Pengeluaran Negatif
    if (tx.category !== "Pendapatan" && tx.category !== "Saldo Awal" && amount > 0) amount = -amount;
    if (tx.category === "Transfer") amount = 0;

    await sheet.addRow({
      Timestamp: date,
      User: tx.user === 'M' ? 'Malvin' : 'Yovita',
      Type: tx.amount > 0 ? 'Income' : 'Expense',
      Category: tx.category,
      Note: tx.note,
      Account: tx.account.toUpperCase(),
      Amount: Math.abs(amount),
      RealAmount: amount
    });
  } catch (error) { console.error("Gagal update Google Sheet:", error); }
}
