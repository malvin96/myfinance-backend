export const CATEGORIES = [
  { 
    cat: "Pendapatan", 
    type: "Income", 
    keys: ["gaji", "bonus", "thr", "dividen", "komisi", "insentif", "refund", "claim", "klaim", "bunga", "cashback", "masuk", "hibah", "affiliate", "reimburse", "titipan", "penjualan", "untung", "upah", "honor", "royalti", "angpao", "hadiah", "sisa"] 
  },
  { 
    cat: "Anak", 
    type: "Kebutuhan", 
    keys: ["zoey","anak","susu","pampers","popok","sekolah","mainan","bubur","daycare","vitamin anak","baju anak","sepatu anak","kado","lego","boneka","pensil","buku","spp","baby","bayi","sweety","mamy","merries"] 
  },
  { 
    cat: "Makan", 
    type: "Kebutuhan", 
    keys: ["makan","ayam","nasi","bakso","mie","kopi","gofood","grabfood","cafe","jajan","warung","restoran","pizza","mcd","burger","haus","mixue","soto","minum","resto","kantin","sate","ikan","seafood","steak","martabak","starbucks","boba","jus","es","pecel","padang","angkringan","bakmie"] 
  },
  { 
    cat: "Transport", 
    type: "Kebutuhan", 
    keys: ["grab","gojek","maxim","bensin","parkir","tol","taksi","service","bengkel","oli","ban","pertalite","pertamax","shell","bp","krl","mrt","lrt","bus","taksi","bluebird","pesawat","tiket","traveloka","cuci","rem","helm","stnk","gocar","grabbike"] 
  },
  { 
    cat: "Belanja", 
    type: "Keinginan", 
    keys: ["shopee","tokopedia","indomaret","alfamart","sayur","buah","beras","sabun","odol","deterjen","pasar","superindo","hypermart","tokped","lazada","blibli","alfamidi","lulu","transmart","gula","shampoo","tisu","baju","celana","sepatu","tas","makeup","skincare","skintific","uniqlo","h&m","mall","elektronik","perabotan"] 
  },
  { 
    cat: "Tagihan", 
    type: "Kebutuhan", 
    keys: ["listrik","pln","air","pdam","internet","wifi","pulsa","kuota","bpjs","asuransi","pajak","pbb","cicilan","cc","indihome","biznet","firstmedia","telkomsel","xl","indosat","tri","axis","smartfren","prudential","kartu","paylater","iuran","keamanan","kebersihan"] 
  },
  { 
    cat: "Kesehatan", 
    type: "Kebutuhan", 
    keys: ["dokter","obat","apotek","rs","vitamin","klinik","periksa","rumah sakit","puskesmas","kimia farma","k24","halodoc","alodokter","suplemen","madu","lab","swab","gigi","mata","optik","kacamata","masker","antiseptik","betadine","rawat"] 
  },
  { 
    cat: "Hiburan", 
    type: "Keinginan", 
    keys: ["netflix","spotify","bioskop","game","liburan","hotel","karaoke","hobi","youtube","disney","movie","xxi","cgv","topup","diamond","mlbb","pubg","steam","staycation","pantai","gunung","nonton","wisata","rekreasi"] 
  },
  { 
    cat: "Investasi", 
    type: "Netral", 
    keys: ["bibit","mirae","emas","saham","crypto","reksadana","obligasi","sekuritas","antam","pegadaian","binance","pintu","deposito","p2p","properti","tabungan"] 
  }
];

export function detectCategory(text = "") {
  const t = text.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.keys.some(k => t.includes(k))) return { category: c.cat, needType: c.type };
  }
  return { category: "Lainnya", needType: "Keinginan" };
}
