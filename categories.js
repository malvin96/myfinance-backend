export const CATEGORIES = [
  { cat: "Pendapatan", keys: ["gaji", "bonus", "bns", "thr", "cashback", "refund", "transfer", "titip", "jual", "cair", "masuk", "cuan", "profit", "hadiah", "reimburse", "topup"] },
  { cat: "Anak", keys: ["zoey", "anak", "bayi", "pampers", "pempes", "susu", "sufor", "ssu", "mainan", "sekolah", "spp", "vaksin", "imunisasi", "dokter anak", "bubur", "snack anak", "stroller", "oi"] },
  { cat: "Makan", keys: ["makan", "mkn", "maem", "minum", "mnm", "jajan", "jjn", "kopi", "ngopi", "boba", "gofood", "grabfood", "shopeefood", "sarapan", "lunch", "dinner", "cemilan", "roti", "bakso", "mie", "warteg", "soto", "nasgor", "cafe", "resto", "galon", "aqua", "beras", "sayur", "daging", "ayam", "telur", "buah", "indomaret", "alfamart", "belanja bulanan"] },
  { cat: "Transport", keys: ["bensin", "bnsn", "pertalite", "pertamax", "parkir", "prkir", "tol", "etoll", "grab", "gojek", \"gocar\", "taksi", "kereta", "kai", "pesawat", "tiket", "travel", "servis", "service", "bengkel", "cuci motor", "cuci mobil", "ban", "oli"] },
  { cat: "Belanja", keys: ["belanja", "blnj", "beli", "shop", "shopping", "tokopedia", "shopee", "lazada", "tiktok", "superindo", "hypermart", "indo", "alfa", "baju", "celana", "sepatu", "tas", "skincare", "kosmetik", "makeup", "sabun", "shampo", "odol", "tisu", "gadget", "hp", "aksesoris", "hampers", "kado", "uniqlo"] },
  { cat: "Tagihan", keys: ["listrik", "pln", "token", "air", "pdam", "wifi", "internet", "pulsa", "data", "kuota", "asuransi", "bpjs", "pajak", "kontrakan", "kos", "ipl", "sampah", "cicilan", "kpr", "cc", "kartu kredit", "netflix", "spotify", "youtube", "icloud", "arisan", "iuran", "zakat", "sedekah", "art", "pembantu"] },
  { cat: "Kesehatan", keys: ["dokter", "dktr", "sakit", "obat", "obt", "apotek", "halodoc", "klinik", "rs", "vitamin", "vit", "suplemen", "masker", "pijat", "urut", "gym", "fitness", "olahraga", "potong rambut"] },
  { cat: "Hiburan", keys: ["bioskop", "nonton", "cinema", "xxi", "wisata", "liburan", "hotel", "staycation", "pantai", "gunung", "dufan", "game", "topup game", "hobi", "konser", "nongkrong", "buku"] },
  { cat: "Investasi", keys: ["bibit", "mirrae", "mirae", "bca sekuritas", "bcas", "saham", "reksadana", "rdn", "emas", "deposito", "tabungan", "nabung"] },
  { cat: "Transfer", keys: ["tf", "trf", "transfer", "kirim", "tarik", "wd", "withdraw", "setor", "pindah"] }
];

export function detectCategory(text) {
  const low = text.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.keys.some(k => low.includes(k))) return c.cat;
  }
  return "Lainnya";
}

// [FITUR BARU] Mapping Emoji untuk UI Visual
export function getCategoryEmoji(catName) {
    const map = {
        'Pendapatan': '💰',
        'Anak': '👶',
        'Makan': '🍔',
        'Transport': '🚗',
        'Belanja': '🛒',
        'Tagihan': '⚡',
        'Kesehatan': '💊',
        'Hiburan': '🎬',
        'Investasi': '📈',
        'Transfer': '🔄',
        'Lainnya': '📝'
    };
    return map[catName] || '📝';
}
