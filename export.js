import PDFDocument from 'pdfkit';
import fs from 'fs';

export async function createPDF(data, title = "LAPORAN KEUANGAN") {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const fileName = `Laporan_${new Date().toISOString().slice(0, 10)}.pdf`;
      const stream = fs.createWriteStream(fileName);
      doc.pipe(stream);

      doc.fontSize(18).text(title, { align: 'center' });
      doc.moveDown();
      
      data.forEach(r => {
        doc.fontSize(10).text(`${r.timestamp.slice(0,10)} | ${r.category} | ${r.note} | ${Math.round(r.amount)}`);
      });

      doc.end();
      stream.on('finish', () => resolve(fileName));
    } catch (err) { reject(err); }
  });
}
