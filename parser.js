import { detectCategory } from "./categories.js";

function parseAmount(str) {
  // Bersihkan karakter aneh, hanya terima angka, titik, koma, dan suffix
  let cleanStr = str.replace(/[^0-9kjtbrb.,]/g, '');
  let num = parseFloat(cleanStr.replace(/[k|jt|rb]/g, ''));
  
  if (str.includes('k') || str.includes('rb')) num *= 1000;
  else if (str.includes('jt')) num *= 1000000;
  
  return num;
}

export function parseInput(text, senderId) {
  if (!text) return [];
  const lines = text.split('\n');
  const results = [];

  for (let line of lines) {
    line = line.trim().toLowerCase();
    if (!line) continue;

    // Deteksi User (M/Y)
    let user = senderId === 5023700044 ? 'M' : 'Y';
    if (line.startsWith('y ')) { user = 'Y'; line = line.substring(2).trim(); }
    else if (line.startsWith('m ')) { user = 'M'; line = line.substring(2).trim(); }

    // --- COMMANDS ---
    if (['list', 'help', 'menu', '?'].includes(line)) { results.push({ type: 'list' }); continue; }
    if (['rekap', 'saldo', 'cek'].includes(line)) { results.push({ type: 'rekap' }); continue; }
    if (['koreksi', 'undo', 'batal'].includes(line)) { results.push({ type: 'koreksi', user }); continue; }
    if (line === 'backup') { results.push({ type: 'backup' }); continue; }
    if (line === 'export pdf') { results.push({ type: 'export_pdf', filter: { title: 'Laporan Bulanan' } }); continue; }

    // --- SET SALDO ---
    const mSaldo = line.match(/^set saldo (\w+) (\d+[k|jt|rb]*)$/);
    if (mSaldo) { 
      results.push({ type: 'set_saldo', user, account: mSaldo[1], amount: parseAmount(mSaldo[2]) }); 
      continue; 
    }

    // --- TRANSFER ---
    const mPindah = line.match(/^pindah (\d+[k|jt|rb]*) (\w+) (\w+)$/);
    if (mPindah) {
      results.push({ type: 'transfer_akun', user, amount: parseAmount(mPindah[1]), from: mPindah[2], to: mPindah[3], note: `Pindah ${mPindah[2]} ke ${mPindah[3]}` });
      continue;
    }

    // --- SMART TRANSACTION PARSER (FLEKSIBEL) ---
    // Pecah kalimat jadi kata-kata (tokens)
    const tokens = line.split(/\s+/);
    
    // Cari token yang bentuknya Angka (Nominal)
    const amountIdx = tokens.findIndex(t => /^\d+([.,]\d+)?[k|jt|rb]*$/i.test(t));

    if (amountIdx !== -1 && tokens.length >= 2) {
      // 1. Ambil Nominal
      const amountRaw = parseAmount(tokens[amountIdx]);
      
      // 2. Pisahkan token sisa (non-angka)
      const otherTokens = tokens.filter((_, i) => i !== amountIdx);
      
      // 3. Asumsi: Kata TERAKHIR adalah AKUN (Standar manusia: beli bakso bca)
      const account = otherTokens.pop(); 
      
      // 4. Sisanya adalah CATATAN
      let note = otherTokens.join(' ');
      
      // 5. Deteksi Kategori
      const category = detectCategory(note);
      
      // Jika note kosong (misal cuma "50k bca"), note jadi nama kategori
      if (!note) note = category;

      // 6. Tentukan Plus/Minus
      const amount = (category === "Pendapatan") ? Math.abs(amountRaw) : -Math.abs(amountRaw);

      results.push({ type: 'tx', user, amount, note, account, category });
    }
  }
  return results;
}
