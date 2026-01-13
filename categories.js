const CATEGORIES = [
  {
    cat: "Makan",
    type: "Kebutuhan",
    keys: [
      "makan","ayam","nasi","bakso","mie","kopi",
      "gofood","grabfood","cafe","jajan"
    ]
  },
  {
    cat: "Belanja",
    type: "Keinginan",
    keys: [
      "shopee","tokopedia","belanja",
      "indomaret","alfamart","sayur","buah","susu"
    ]
  },
  {
    cat: "Transport",
    type: "Kebutuhan",
    keys: [
      "grab","gojek","bensin","parkir",
      "tol","taksi","bus","kereta","pesawat"
    ]
  },
  {
    cat: "Tagihan",
    type: "Kebutuhan",
    keys: [
      "listrik","air","internet","wifi",
      "pulsa","cicilan","kartu kredit","asuransi"
    ]
  },
  {
    cat: "Anak",
    type: "Kebutuhan",
    keys: [
      "zoey","anak","susu","pampers",
      "sekolah","les","mainan"
    ]
  },
  {
    cat: "Kesehatan",
    type: "Kebutuhan",
    keys: [
      "dokter","obat","apotek","rs",
      "vitamin","klinik"
    ]
  },
  {
    cat: "Hiburan",
    type: "Keinginan",
    keys: [
      "netflix","spotify","bioskop",
      "game","liburan","hotel","villa"
    ]
  },
  {
    cat: "Investasi",
    type: "Netral",
    keys: [
      "bibit","mirae","saham",
      "reksadana","crypto","emas"
    ]
  }
];

function detectCategory(text = "") {
  const t = text.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.keys.some(k => t.includes(k))) {
      return { category: c.cat, needType: c.type };
    }
  }
  return { category: "Lainnya", needType: "Keinginan" };
}

module.exports = {
  CATEGORIES,
  detectCategory
};
