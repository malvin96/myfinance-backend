export const CATEGORIES = [
  { cat: "Makan", type: "Kebutuhan", keys: ["makan","ayam","nasi","bakso","mie","kopi","gofood","grabfood","cafe","jajan"] },
  { cat: "Belanja", type: "Keinginan", keys: ["shopee","tokopedia","indomaret","alfamart","sayur","buah","susu"] },
  { cat: "Transport", type: "Kebutuhan", keys: ["grab","gojek","bensin","parkir","tol","taksi"] },
  { cat: "Tagihan", type: "Kebutuhan", keys: ["listrik","air","internet","wifi","pulsa","cicilan","asuransi"] },
  { cat: "Anak", type: "Kebutuhan", keys: ["zoey","anak","susu","pampers","sekolah","mainan"] },
  { cat: "Kesehatan", type: "Kebutuhan", keys: ["dokter","obat","apotek","rs","vitamin"] },
  { cat: "Hiburan", type: "Keinginan", keys: ["netflix","spotify","bioskop","game","liburan","hotel"] },
  { cat: "Investasi", type: "Netral", keys: ["bibit","mirae","emas","saham","crypto"] }
];

export function detectCategory(text = "") {
  const t = text.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.keys.some(k => t.includes(k))) return { category: c.cat, needType: c.type };
  }
  return { category: "Lainnya", needType: "Keinginan" };
}
