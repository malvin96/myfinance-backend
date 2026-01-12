import { addTransaction, getSummary, getHistory } from "./ledger.js"

export async function handleMessage(chatId, text) {
  text = text.toLowerCase().trim()

  // detect summary
  if (text.includes("rekap") || text.includes("summary")) {
    return await getSummary(chatId)
  }

  if (text.includes("history")) {
    return await getHistory(chatId)
  }

  // detect user (M / Y)
  let user = "M"
  if (text.startsWith("y ")) user = "Y"
  if (text.startsWith("m ")) user = "M"

  // amount
  const match = text.match(/(\d+(?:\.\d+)?)(\s?rb|\s?k|\s?jt)?/)
  if (!match) {
    return "❌ Tidak ada nominal terdeteksi."
  }

  let amount = parseFloat(match[1])
  const unit = match[2] || ""
  if (unit.includes("rb") || unit.includes("k")) amount *= 1000
  if (unit.includes("jt")) amount *= 1000000

  // detect income / expense
  let type = "expense"
  if (text.includes("gaji") || text.includes("income") || text.includes("pendapatan")) {
    type = "income"
  }

  // detect account
  let account = "cash"
  if (text.includes("ovo")) account = "ovo"
  if (text.includes("gopay")) account = "gopay"
  if (text.includes("shopee")) account = "shopeepay"
  if (text.includes("bca")) account = "bca"

  // detect category
  let category = "lainnya"
  if (text.includes("makan") || text.includes("ayam") || text.includes("nasi")) category = "makan"
  if (text.includes("listrik") || text.includes("air")) category = "tagihan"
  if (text.includes("bensin") || text.includes("grab")) category = "transport"
  if (text.includes("belanja") || text.includes("indomaret") || text.includes("alfamart")) category = "belanja"

  const note = text.replace(match[0], "").trim()

  await addTransaction(chatId, {
    user,
    type,
    amount,
    account,
    category,
    note
  })

  return `✅ ${user} ${type === "income" ? "mendapat" : "mengeluarkan"} Rp${amount.toLocaleString()} (${category}) via ${account}`
}
