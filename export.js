import PDFDocument from 'pdfkit';
import fs from 'fs';

export async function createPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const fileName = `Laporan_Keuangan_${new Date().toISOString().slice(0, 10)}.pdf`;
      const stream = fs.createWriteStream(fileName);

      doc.pipe(stream);
      doc.fontSize(18).text('LAPORAN KEUANGAN KELUARGA', { align: 'center' });
      doc.fontSize(10).text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, { align: 'center' });
      doc.moveDown();

      // Header Tabel
      doc.fontSize(10).font('Helvetica-Bold').text('Tanggal'.padEnd(15) + 'User'.padEnd(6) + 'Akun'.padEnd(12) + 'Kategori'.padEnd(15) + 'Nominal'.padEnd(15) + 'Note');
      doc.text('-'.repeat(110));
      doc.moveDown(0.5).font('Helvetica');

      data.forEach(r => {
        const nominal = Math.round(r.amount).toLocaleString('id-ID');
        const row = `${r.timestamp.slice(0, 10).padEnd(15)} ${r.user.padEnd(5)} ${r.account.toUpperCase().padEnd(11)} ${r.category.padEnd(14)} ${nominal.padEnd(14)} ${r.note || '-'}`;
        doc.fontSize(8).text(row);
      });

      doc.end();
      stream.on('finish', () => resolve(fileName));
    } catch (err) {
      reject(err);
    }
  });
}
