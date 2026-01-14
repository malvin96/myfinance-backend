export const CATEGORIES = [
  { cat: "Pendapatan", keys: ["gaji", "bonus", "cashback", "refund", "affiliate", "thr", "komisi", "dividen", "bunga", "hibah", "transfer", "titip", "jual", "cair", "masuk", "cuan", "profit", "hadiah", "claim", "reimburse", "kembalian", "topup"] },
  { cat: "Anak", keys: ["zoey", "pampers", "pempes", "susu", "ssu", "popok", "mainan", "baju anak", "sekolah", "spp", "vaksin", "bubur", "snack anak", "baby", "stroller", "imunisasi", "obat anak"] },
  { cat: "Makan", keys: ["makan", "mkn", "minum", "mnm", "jajan", "jjn", "kopi", "boba", "grabfood", "gofood", "shopeefood", "sarapan", "lunch", "dinner", "cemilan", "snack", "roti", "bakso", "mie", "warteg", "resto", "galon", "aqua", "beras", "sayur", "daging", "ayam", "ikan", "telur", "buah"] },
  { cat: "Transport", keys: ["bensin", "bnsn", "pertalite", "pertamax", "shell", "parkir", "prkir", "tol", "grab", "gojek", "gocar", "grabcar", "taksi", "kereta", "krl", "mrt", "bus", "tiket", "oli", "servis", "service", "cuci motor", "cuci mobil", "ban", "e-toll"] },
  { cat: "Belanja", keys: ["shopee", "shope", "tokped", "tokopedia", "lazada", "tiktok shop", "baju", "celana", "pakaian", "sepatu", "tas", "skincare", "kosmetik", "makeup", "parfum", "sabun", "shampo", "odol", "deterjen", "tisu", "gadget", "hp", "aksesoris"] },
  { cat: "Tagihan", keys: ["listrik", "pln", "token", "air", "pdam", "wifi", "indihome", "biznet", "internet", "pulsa", "paket data", "kuota", "asuransi", "bpjs", "pajak", "pbb", "kontrakan", "kos", "cicilan", "kpr", "kartu kredit", "cc", "netflix", "spotify", "icloud", "sampah", "iuran"] },
  { cat: "Kesehatan", keys: ["dokter", "dktr", "sakit", "obat", "obt", "apotek", "halodoc", "klinik", "rs", "rumah sakit", "vitamin", "vit", "suplemen", "masker", "pijat", "gym", "olahraga"] },
  { cat: "Hiburan", keys: ["bioskop", "nonton", "cinema", "xxi", "wisata", "liburan", "hotel", "staycation", "villa", "pantai", "gunung", "museum", "kebun binatang", "dufan", "ancol", "game", "topup game", "hobi", "konser", "nongkrong", "cafe"] },
  { cat: "Investasi", keys: ["bibit", "ajaib", "bareksa", "saham", "reksadana", "obligasi", "sbn", "emas", "logam mulia", "antam", "uob", "crypto", "bitcoin", "deposito", "tabungan", "aset"] }
];

export function detectCategory(note = "") {
  const noteLower = note.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.keys.some(k => noteLower.includes(k))) return c.cat;
  }
  return "Lainnya";
}
