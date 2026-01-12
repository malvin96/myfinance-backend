export const db = {
  chats: {}
}

export function getChat(chatId) {
  if (!db.chats[chatId]) {
    db.chats[chatId] = {
      users: {
        M: {},
        Y: {}
      },
      ledger: [],
      lastClosing: null
    }
  }
  return db.chats[chatId]
}
