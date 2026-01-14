export const CATEGORIES = [
  {
    cat: "Pendapatan",
    keys: ["gaji", "bonus", "cashback", "refund", "affiliate", "thr", "komisi", "dividen", "bunga", "hibah", "transfer", "titip", "jual", "laku", "cair", "masuk", "cuan", "profit", "royalti", "angpao", "kado", "hadiah", "claim", "reimburse", "asuransi", "sisa", "kembalian", "modal", "topup", "transferan", "bayar", "lunas", "cicilan", "tagihan", "piutang", "pinjam", "utang", "tarik", "ambil", "setor", "tabungan"]
  },
  {
    cat: "Anak",
    keys: ["zoey", "pampers", "susu", "popok", "mainan", "baju anak", "sekolah", "spp", "vaksin", "dokter anak", "bubur", "snack anak", "vitamin anak", "pakaian anak", "sepatu anak", "buku anak", "les", "playground", "kereta bayi", "stroller", "baby", "balita", "penerangan", "perlengkapan bayi", "bedak", "sabun bayi", "tisu basah", "botol", "dot", "gendongan", "tas bayi", "imunisasi", "obat anak", "tabungan anak", "pendidikan", "ultah", "hadiah anak", "wisata anak", "renang", "kursus"]
  },
  {
    cat: "Makan",
    keys: ["makan", "minum", "jajan", "kopi", "boba", "starbucks", "grabfood", "gofood", "shopeefood", "sarapan", "lunch", "dinner", "cemilan", "snack", "roti", "bakso", "nasi", "mie", "kfc", "mcd", "pizza", "warteg", "cafe", "resto", "galon", "aqua", "beras", "bumbu", "sayur", "daging", "ayam", "ikan", "telur", "buah", "indomaret", "alfamart", "supermarket", "jajanan", "es krim", "cokelat"]
  },
  {
    cat: "Transport",
    keys: ["bensin", "pertalite", "pertamax", "shell", "parkir", "tol", "grab", "gojek", "gocar", "grabcar", "taxsi", "taksi", "kereta", "krl", "mrt", "lrt", "bus", "way", "tiket", "pesawat", "travel", "oli", "servis", "service", "cuci motor", "cuci mobil", "ban", "sparepart", "helm", "jaket", "pajak motor", "pajak mobil", "sim", "stnk", "e-toll", "flazz", "emoney", "ojek", "angkot", "perjalanan"]
  },
  {
    cat: "Belanja",
    keys: ["shopee", "tokped", "tokopedia", "lazada", "tiktok shop", "baju", "celana", "kaos", "pakaian", "sepatu", "tas", "skincare", "kosmetik", "makeup", "parfum", "sabun", "shampo", "odol", "deterjen", "tisu", "perabotan", "dapur", "elektronik", "gadget", "hp", "laptop", "aksesoris", "perhiasan", "jam tangan", "kado", "hampers", "belanja bulanan", "mall", "outlet", "diskon", "promo", "voucher", "belanjaan", "kebutuhan", "peralatan"]
  },
  {
    cat: "Tagihan",
    keys: ["listrik", "pln", "token", "air", "pdam", "wifi", "indihome", "biznet", "internet", "pulsa", "paket data", "kuota", "hp pascabayar", "asuransi", "bpjs", "prudential", "manulife", "pajak", "pbb", "kontrakan", "kos", "cicilan", "kpr", "leasing", "kartu kredit", "netflix", "spotify", "youtube premium", "disney", "icloud", "google one", "zoom", "canva", "keamanan", "kebersihan", "iuran", "lingkungan", "rt", "rw", "sampah"]
  },
  {
    cat: "Kesehatan",
    keys: ["dokter", "sakit", "obat", "apotek", "halodoc", "klinik", "rs", "rumah sakit", "lab", "cek darah", "vitamin", "suplemen", "masker", "handsanitizer", "betadine", "plester", "minyak kayu putih", "urut", "pijat", "spa", "gym", "fitness", "olahraga", "fisioterapi", "gigi", "mata", "kacamata", "softlens", "rawat inap", "rawat jalan", "medical", "checkup", "vaksinasi", "darurat", "ambulance", "perawat", "bidan", "terapi", "herbal", "jamu"]
  },
  {
    cat: "Hiburan",
    keys: ["bioskop", "nonton", "cinema", "xxi", "cgv", "tiket", "wisata", "liburan", "hotel", "staycation", "villa", "pantai", "gunung", "museum", "kebun binatang", "dufan", "ancol", "game", "topup game", "steam", "psn", "nintendo", "hobi", "pancing", "sepeda", "kamera", "fotografi", "konser", "musik", "karaoke", "party", "clubbing", "nongkrong", "cafe", "buku", "novel", "komik", "majalah", "koleksi", "mainan"]
  },
  {
    cat: "Investasi",
    keys: ["bibit", "ajaib", "bareksa", "saham", "reksadana", "obligasi", "sbn", "ori", "su001", "emas", "logam mulia", "antam", "uob", "pajak investasi", "crypto", "binance", "tokocrypto", "indodax", "bitcoin", "ethereum", "properti", "tanah", "deposito", "tabungan berjangka", "rdn", "sekuritas", "trading", "forex", "p2p", "lending", "st010", "st011", "sukuk", "pasar modal", "investasi", "aset", "kekayaan", "pensiun", "dana darurat", "modal usaha"]
  }
];

export function detectCategory(note) {
  const noteLower = note.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.keys.some(k => noteLower.includes(k))) return c.cat;
  }
  return "Lainnya";
}
