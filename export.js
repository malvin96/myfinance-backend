import PDFDocument from 'pdfkit';
import fs from 'fs';
import { getRekapLengkap } from "./db.js";

export async function createPDF(data, title = "LAPORAN KEUANGAN MAYO") {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const fileName = `Laporan_MaYo_${new Date().toISOString().slice(0,10)}.pdf`;
      const stream = fs.createWriteStream(fileName);
      doc.pipe(stream);

      const dateWITA = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
      const liquidAccs = ['bca', 'cash', 'gopay', 'ovo', 'shopeepay'];
      const assetAccs = ['bibit', 'mirrae', 'bca sekuritas'];

      // HEADER
      doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Waktu Generate: ${dateWITA} WITA`, { align: 'center' });
      doc.moveDown(2);

      // SECTION 1: POSISI KEKAYAAN (SMART SUMMARY)
      doc.fontSize(14).font('Helvetica-Bold').text('I. RINGKASAN SALDO AKHIR', { underline: true });
      doc.moveDown(0.5);

      const rekap = getRekapLengkap();
      
      const renderUserSection = (code, label) => {
          const userRows = rekap.rows.filter(r => r.user === code);
          if (userRows.length === 0) return;

          doc.fontSize(12).font('Helvetica-Bold').text(`👤 USER: ${label}`);
          doc.fontSize(10).font('Courier-Bold').text("   KATEGORI     | AKUN           | SALDO (RP)");
          doc.moveTo(40, doc.y).lineTo(400, doc.y).stroke();
          
          let subLiquid = 0, subAsset = 0;
          doc.font('Courier');

          // Render Liquid
          userRows.filter(r => liquidAccs.includes(r.account)).forEach(r => {
              doc.text(`   [LIQUID]     | ${r.account.toUpperCase().padEnd(14)} | ${Math.round(r.balance).toLocaleString('id-ID').padStart(12)}`);
              subLiquid += r.balance;
          });

          // Render Asset
          userRows.filter(r => assetAccs.includes(r.account)).forEach(r => {
              doc.text(`   [ASSET]      | ${r.account.toUpperCase().padEnd(14)} | ${Math.round(r.balance).toLocaleString('id-ID').padStart(12)}`);
              subAsset += r.balance;
          });

          doc.moveDown(0.3);
          doc.font('Helvetica-Bold').fontSize(10)
             .text(`   > TOTAL LIQUID : Rp ${subLiquid.toLocaleString('id-ID')}`)
             .text(`   > TOTAL ASSET  : Rp ${subAsset.toLocaleString('id-ID')}`)
             .text(`   > TOTAL ${label} : Rp ${(subLiquid + subAsset).toLocaleString('id-ID')}`);
          doc.moveDown(1);
      };

      renderUserSection('M', 'MALVIN');
      renderUserSection('Y', 'YOVITA');

      doc.fontSize(12).font('Helvetica-Bold').fillColor('blue')
         .text(`TOTAL NETWORTH GABUNGAN: Rp ${Math.round(rekap.totalWealth).toLocaleString('id-ID')}`)
         .fillColor('black');
      doc.moveDown(2);

      // SECTION 2: RAW DATA FOR AI ANALYSIS
      doc.fontSize(14).font('Helvetica-Bold').text('II. RIWAYAT TRANSAKSI LENGKAP', { underline: true });
      doc.fontSize(8).font('Helvetica-Oblique').text('*Data ini diformat agar mudah dibaca oleh AI GPT untuk analisis pola pengeluaran.');
      doc.moveDown(0.5);

      doc.fontSize(8).font('Courier-Bold').text("WAKTU                | U | AKUN      | KATEGORI   | NOMINAL      | CATATAN");
      doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      doc.font('Courier').fontSize(7);
      data.forEach(r => {
        const ts = r.timestamp.padEnd(20);
        const u = r.user;
        const acc = r.account.toUpperCase().padEnd(10).slice(0,10);
        const cat = r.category.padEnd(10).slice(0,10);
        const amt = r.amount.toString().padStart(12);
        const note = r.note || "-";
        
        doc.text(`${ts} | ${u} | ${acc} | ${cat} | ${amt} | ${note}`);
        if (doc.y > 750) doc.addPage();
      });

      doc.end();
      stream.on('finish', () => resolve(fileName));
    } catch (e) { reject(e); }
  });
}
