import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const serviceAccountAuth = new JWT({
  email: 'finance-bot-sheets@myfinance-bot.iam.gserviceaccount.com',
  key: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n", // Gunakan private key asli Anda
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet('1KXwvsfy4UdWG7I4AkweeCph8rTm-aiQAvUPe08kdmdA', serviceAccountAuth);

export async function appendToSheet(data) {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      Tanggal: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      User: data.user || 'System',
      Kategori: data.category || 'Lainnya',
      Jumlah: Math.abs(data.amount || 0),
      Akun: (data.account || 'Cash').toUpperCase(),
      Keterangan: data.note || '-'
    });
  } catch (e) { console.error("Sheet Error:", e.message); }
}
