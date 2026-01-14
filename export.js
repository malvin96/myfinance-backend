import PDFDocument from 'pdfkit';
import fs from 'fs';

export async function createPDF(data, title = "LAPORAN KEUANGAN") {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const safeTitle = title.replace(/\s+/g, '_');
      const fileName = `${safeTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const stream = fs.createWriteStream(fileName);

      doc.pipe(stream);
      doc.fontSize(18).font('Helvetica-Bold').text(title.toUpperCase(), { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, { align: 'center' });
      doc.moveDown();

      doc.fontSize(9).font('Helvetica-Bold');
      const head = `TANGGAL`.padEnd(14) + `USER`.padEnd(6) + `AKUN`.padEnd(10) + `KATEGORI`.padEnd(14) + `NOMINAL`.padEnd(14) + `NOTE`;
      doc.text(head);
      doc.text('-'.repeat(105));
      doc.moveDown(0.5).font('Helvetica');

      if (data.length === 0) {
        doc.text("Tidak ada data untuk periode ini.", { align: 'center' });
      } else {
        data.forEach(r => {
          const nominal = Math.round(r.amount).toLocaleString('id-ID');
          const row = `${r.timestamp.slice(0, 10).padEnd(14)} ${r.user.padEnd(5)} ${r.account.toUpperCase().padEnd(9)} ${r.category.padEnd(13)} ${nominal.padEnd(13)} ${r.note || '-'}`;
          doc.fontSize(8).text(row);
        });
      }

      doc.end();
      stream.on('finish', () => resolve(fileName));
    } catch (err) { reject(err); }
  });
}
