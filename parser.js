/**
 * Membersihkan angka dari format Indonesia (titik ribuan, koma desimal)
 * agar bisa dihitung oleh sistem secara akurat.
 * Contoh: "15.135.839,29" -> 15135839.29
 */
function cleanNumeric(t) {
  if (!t) return 0;
  // Ubah koma desimal menjadi titik agar parseFloat mengenalnya sebagai desimal
  let val = t.replace(/,/g, '.'); 
  const parts = val.split('.');
  
  // Jika ada lebih dari satu titik (berarti ada titik ribuan)
  if (parts.length > 2) {
    const decimalPart = parts.pop(); // Ambil bagian desimal terakhir
    val = parts.join('') + '.' + decimalPart; // Gabungkan bagian ribuan, lalu pasang kembali desimalnya
  }
  return parseFloat(val) || 0;
}

/**
 * Ekstraksi angka yang tidak sensitif terhadap huruf besar/kecil (k, rb, jt)
 */
function extractAmount(t) {
  // Regex ditambahkan flag 'i' agar "10K" atau "10k" sama saja
  const m = t.match(/([\d.,]+)\s*(k|rb|ribu|jt|juta)?/i);
  if (!m) return 0;
  
  let value = cleanNumeric(m[1]);
  const unit = (m[2] || "").toLowerCase();

  if (["k", "rb", "ribu"].includes(unit)) value *= 1000;
  if (["jt", "juta"].includes(unit)) value *= 1000000;
  
  // Menggunakan pembulatan 2 desimal agar saldo bank tetap akurat
  return Math.round(value * 100) / 100;
}

function parseLine(text, senderId) {
  const t = text.toLowerCase();
  // ... (Logika User ID tetap sama)

  // Gunakan variabel cleanT (huruf kecil semua) untuk semua pengecekan akun
  const cleanT = text.toLowerCase().trim();

  if (cleanT.startsWith("set saldo ")) {
    // Perbaikan: Mencari akun dengan membandingkan huruf kecil semua
    const acc = ACCOUNTS.find(a => cleanT.includes(a.toLowerCase())) || "cash";
    return { 
      type: "set_saldo", 
      user, 
      account: acc, 
      amount: extractAmount(cleanT), 
      note: "Set Saldo Awal" 
    };
  }
  
  // ... (Gunakan logika pencarian akun yang sama untuk type "pindah" dan "tx")
  
  return {
    type: "tx", 
    user, 
    // Perbaikan: Deteksi akun tidak sensitif huruf
    account: ACCOUNTS.find(a => cleanT.includes(a.toLowerCase())) || "cash",
    amount: (cleanT.includes("gaji") || cleanT.includes("masuk")) ? amount : -amount,
    category, 
    tag, 
    note: text // Simpan catatan dengan format asli (besar/kecil)
  };
}
