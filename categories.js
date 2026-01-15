export const CATEGORIES = [
  { cat: "Pendapatan", keys: ["gaji", "bonus", "bns", "thr", "cashback", "refund", "transfer", "titip", "jual", "cair", "masuk", "cuan", "profit", "hadiah", "reimburse", "topup"] },
  { cat: "Anak", keys: ["zoey", "anak", "bayi", "pampers", "pempes", "susu", "sufor", "ssu", "mainan", "sekolah", "spp", "vaksin", "imunisasi", "dokter anak", "bubur", "snack anak", "stroller", "oi"] },
  { cat: "Makan", keys: ["makan", "mkn", "maem", "minum", "mnm", "jajan", "jjn", "kopi", "ngopi", "boba", "gofood", "grabfood", "shopeefood", "sarapan", "lunch", "dinner", "cemilan", "roti", "bakso", "mie", "warteg", "soto", "nasgor", "cafe", "resto", "galon", "aqua", "beras", "sayur", "daging", "ayam", "telur", "buah", "indomaret", "alfamart", "belanja bulanan"] },
  { cat: "Transport", keys: ["bensin", "bnsn", "pertalite", "pertamax", "parkir", "prkir", "tol", "etoll", "grab", "gojek", "gocar", "taksi", "kereta", "krl", "mrt", "bus", "tiket", "pesawat", "oli", "servis", "bengkel", "cuci", "pajak motor"] },
  { cat: "Belanja", keys: ["shopee", "shope", "tokped", "tokopedia", "tiktok", "beli", "baju", "celana", "sepatu", "tas", "skincare", "kosmetik", "makeup", "sabun", "shampo", "odol", "tisu", "gadget", "hp", "aksesoris", "hampers", "kado", "uniqlo"] },
  { cat: "Tagihan", keys: ["listrik", "pln", "token", "air", "pdam", "wifi", "internet", "pulsa", "data", "kuota", "asuransi", "bpjs", "pajak", "kontrakan", "kos", "ipl", "sampah", "cicilan", "kpr", "cc", "kartu kredit", "netflix", "spotify", "youtube", "icloud", "arisan", "iuran", "zakat", "sedekah"] },
  { cat: "Kesehatan", keys: ["dokter", "dktr", "sakit", "obat", "obt", "apotek", "halodoc", "klinik", "rs", "vitamin", "vit", "suplemen", "masker", "pijat", "urut", "gym", "fitness", "olahraga", "potong rambut"] },
  { cat: "Hiburan", keys: ["bioskop", "nonton", "cinema", "xxi", "wisata", "liburan", "hotel", "staycation", "pantai", "gunung", "dufan", "game", "topup game", "hobi", "konser", "nongkrong", "buku"] },
  { cat: "Investasi", keys: ["bibit", "mirrae", "mirae", "bca sekuritas", "bcas", "crypto", "kripto", "bitcoin", "btc", "usdt", "eth", "ajaib", "saham", "reksadana", "obligasi", "sbn", "emas", "antam", "deposito", "tabungan", "aset", "rdn", "sukuk"] }
];

export function detectCategory(note = "") {
  const noteLower = note.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.keys.some(k => noteLower.includes(k))) return c.cat;
  }
  if (noteLower.includes("beli") || noteLower.includes("belanja")) return "Belanja";
  if (noteLower.includes("bayar")) return "Tagihan";
  return "Lainnya";
}
