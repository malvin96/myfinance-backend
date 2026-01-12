import { getChat } from "./db.js"

export function setSaldo(chatId, user, akun, jumlah) {
  const chat = getChat(chatId)
  chat.users[user][akun] = Number(jumlah)
}

export function addTransaction(chatId, trx) {
  const chat = getChat(chatId)
  chat.ledger.push({
    ...trx,
    time: new Date().toISOString()
  })

  const { user, akun, amount, type } = trx
  const saldo = chat.users[user][akun] || 0

  if (type === "IN") chat.users[user][akun] = saldo + amount
  if (type === "OUT") chat.users[user][akun] = saldo - amount
}

export function getSaldo(chatId) {
  return getChat(chatId).users
}

export function getLedger(chatId) {
  return getChat(chatId).ledger
}

export function closing(chatId) {
  const chat = getChat(chatId)
  chat.lastClosing = {
    time: new Date().toISOString(),
    snapshot: JSON.parse(JSON.stringify(chat.users))
  }
}
