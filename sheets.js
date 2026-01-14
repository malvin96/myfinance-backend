import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const privateKey = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;

const serviceAccountAuth = privateKey ? new JWT({
  email: 'finance-bot-sheets@myfinance-bot.iam.gserviceaccount.com',
  key: privateKey, 
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
}) : null;

const doc = (process.env.GOOGLE_SHEET_ID && serviceAccountAuth) 
  ? new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth) 
  : null;

export async function appendToSheet(data) {
  if (!doc) return;
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      Tanggal: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      User: data.user || 'M',
      Kategori: data.category || 'Lainnya',
      Jumlah: Math.abs(data.amount || 0),
      Akun: (data.account || 'Cash').toUpperCase(),
      Keterangan: data.note || '-'
    });
  } catch (e) { console.error("Sheet Error:", e.message); }
}
