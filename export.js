import PDFDocument from 'pdfkit';
import fs from 'fs';
import { getRekapLengkap } from "./db.js";

export async function createPDF(data, title = "LAPORAN KEUANGAN") {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const fileName = `Laporan_${new Date().toISOString().slice(0, 10)}.pdf`;
      const stream = fs.createWriteStream(fileName);
      doc.pipe(stream);

      doc.fontSize(16).font('Helvetica-Bold').text(title.toUpperCase(), { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString('id-ID')}`, { align: 'center' });
      doc.moveDown();

      // SALDO
      doc.fontSize(12).font('Helvetica-Bold').text('I. POSISI SALDO SAAT INI', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).font('Courier-Bold').text("USER     | AKUN      | SALDO (RP)");
      doc.moveTo(30, doc.y).lineTo(300, doc.y).stroke();
      doc.moveDown(0.5);
      const rekap = getRekapLengkap();
      doc.font('Courier');
      rekap.rows.forEach(r => {
        const user = r.user === 'M' ? 'MALVIN' : 'YOVITA';
        const account = r.account.toUpperCase().padEnd(9).slice(0, 9);
        const balance = Math.round(r.balance).toLocaleString('id-ID').padStart(12);
        doc.text(`${user.padEnd(8)} | ${account} | ${balance}`);
      });
      doc.moveDown(0.5);
      doc.font('Courier-Bold').text(`TOTAL NET WORTH: Rp ${Math.round(rekap.totalWealth).toLocaleString('id-ID')}`);
      doc.moveDown(2);

      // TRANSAKSI
      doc.font('Helvetica-Bold').fontSize(12).text('II. RINCIAN TRANSAKSI', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).font('Courier-Bold').text("TANGGAL    | USER | AKUN      | KATEGORI   | NOMINAL     | CATATAN");
      doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke();
      doc.moveDown(0.5);
      doc.font('Courier');
      if (data.length === 0) doc.text("Tidak ada data transaksi.");
      else {
        data.forEach(r => {
          const date = r.timestamp.slice(0, 10);
          const user = r.user === 'M' ? 'MALVIN' : 'YOVITA';
          const account = r.account.toUpperCase().padEnd(9).slice(0, 9);
          const category = r.category.padEnd(10).slice(0, 10);
          const amount = Math.round(r.amount).toString().padStart(11);
          const note = r.note || '-';
          doc.text(`${date} | ${user} | ${account} | ${category} | ${amount} | ${note}`);
        });
      }

      // SUMMARY
      if (data.length > 0) {
        doc.moveDown();
        const totalMasuk = data.filter(d => d.amount > 0).reduce((a, b) => a + b.amount, 0);
        const totalKeluar = data.filter(d => d.amount < 0).reduce((a, b) => a + b.amount, 0);
        doc.font('Helvetica-Bold').text(`RINGKASAN: Masuk Rp ${totalMasuk.toLocaleString('id-ID')} | Keluar Rp ${Math.abs(totalKeluar).toLocaleString('id-ID')}`);
      }
      doc.end();
      stream.on('finish', () => resolve(fileName));
    } catch (err) { reject(err); }
  });
}
