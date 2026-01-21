import PDFDocument from 'pdfkit';
import fs from 'fs';
import { getRekapLengkap } from "./db.js";

export async function createPDF(data, title = "LAPORAN KEUANGAN") {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const fileName = `Laporan_Lengkap_${new Date().toISOString().slice(0,10)}.pdf`;
      const stream = fs.createWriteStream(fileName);
      doc.pipe(stream);

      // [UPDATE WITA] Generate Date
      const dateString = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });

      doc.fontSize(16).font('Helvetica-Bold').text(title.toUpperCase(), { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Generated: ${dateString} WITA`, { align: 'center' });
      doc.moveDown();

      // --- I. SALDO AKHIR ---
      doc.fontSize(12).font('Helvetica-Bold').text('I. POSISI SALDO AKHIR', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).font('Courier-Bold').text("USER     | AKUN           | SALDO (RP)");
      doc.moveTo(30, doc.y).lineTo(350, doc.y).stroke();
      doc.moveDown(0.5);

      const rekap = getRekapLengkap();
      doc.font('Courier');
      rekap.rows.forEach(r => {
        const u = r.user === 'M' ? 'MALVIN' : 'YOVITA';
        const a = r.account.toUpperCase().padEnd(14);
        const b = Math.round(r.balance).toString().padStart(12);
        doc.text(`${u.padEnd(8)} | ${a} | ${b}`);
      });
      doc.moveDown();
      doc.font('Helvetica-Bold').text(`TOTAL KEKAYAAN: ${Math.round(rekap.totalWealth).toLocaleString('id-ID')}`);
      doc.moveDown(2);

      // --- II. ALL HISTORY LOG ---
      doc.fontSize(12).font('Helvetica-Bold').text('II. SEMUA RIWAYAT TRANSAKSI', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(8).font('Courier-Bold').text("WAKTU                | U | AKUN     | KATEGORI | NOMINAL     | CATATAN");
      doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke();
      doc.moveDown(0.5);
      doc.font('Courier');

      data.forEach(r => {
        const ts = r.timestamp.padEnd(20);
        const u = r.user;
        const acc = r.account.toUpperCase().padEnd(9).slice(0, 9);
        const cat = r.category.padEnd(9).slice(0, 9);
        const amt = Math.round(r.amount).toString().padStart(11);
        const note = r.note.slice(0, 25);
        
        doc.text(`${ts} | ${u} | ${acc} | ${cat} | ${amt} | ${note}`);
      });

      doc.end();
      stream.on('finish', () => resolve(fileName));
      stream.on('error', reject);
    } catch (err) { reject(err); }
  });
}
