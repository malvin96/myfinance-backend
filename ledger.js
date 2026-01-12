import { loadDB, saveDB } from "./db.js"
import { detectCategory } from "./categories.js"

const IN_KEYS = ["gaji","bonus","refund","cashback","dividen","bunga"]

function isIncome(note){
  return IN_KEYS.some(k=>note.includes(k))
}

function newId(db){
  db.lastId++
  return db.lastId
}

export function resetSaldo(){
  const db=loadDB()
  db.locked=false
  db.users={M:{},Y:{}}
  db.investments={M:{},Y:{}}
  db.ledger=[]
  db.closings=[]
  db.lastId=0
  saveDB(db)
  return "🔄 Saldo acuan dibuka"
}

export function setSaldo(u,a,v){
  const db=loadDB()
  if(db.locked) return "❌ Sudah closing"
  db.users[u][a]=v
  saveDB(db)
  return `✅ ${u} ${a} = Rp${v.toLocaleString()}`
}

export function closing(){
  const db=loadDB()
  if(db.locked) return "ℹ️ Sudah closing"
  db.locked=true
  db.closings.push({t:new Date().toISOString(), users:JSON.parse(JSON.stringify(db.users)), investments:JSON.parse(JSON.stringify(db.investments))})
  saveDB(db)
  return "🔒 Closing berhasil"
}

export function addNatural(u,amount,akun,note){
  const db=loadDB()
  if(!db.locked) return "❌ Belum closing"
  const dir = isIncome(note) ? "IN" : "OUT"
  const bal = db.users[u][akun] || 0
  if(dir==="OUT" && bal<amount) return "❌ Saldo tidak cukup"
  db.users[u][akun] = dir==="IN"? bal+amount : bal-amount
  const cat = detectCategory(note)
  db.ledger.push({ id:newId(db), t:new Date().toISOString(), user:u, akun, type:dir, amount, note, ...cat })
  saveDB(db)
  return `✅ ${u} ${dir==="IN"?"masuk":"keluar"} Rp${amount.toLocaleString()}`
}

export function transfer(fromU,fromA,toU,toA,amount){
  const db=loadDB()
  if((db.users[fromU][fromA]||0)<amount) return "❌ Saldo tidak cukup"
  db.users[fromU][fromA]-=amount
  db.users[toU][toA]=(db.users[toU][toA]||0)+amount
  db.ledger.push({ id:newId(db), t:new Date().toISOString(), type:"TRANSFER", fromU,fromA,toU,toA,amount })
  saveDB(db)
  return "🔁 Transfer sukses"
}

export function invest(u,fromA,toInv,amount){
  const db=loadDB()
  if((db.users[u][fromA]||0)<amount) return "❌ Saldo tidak cukup"
  db.users[u][fromA]-=amount
  db.investments[u][toInv]=(db.investments[u][toInv]||0)+amount
  db.ledger.push({ id:newId(db), t:new Date().toISOString(), type:"INVEST_IN", u, fromA, toInv, amount })
  saveDB(db)
  return "📈 Investasi tercatat"
}

export function withdraw(u,fromInv,toA,amount){
  const db=loadDB()
  if((db.investments[u][fromInv]||0)<amount) return "❌ Investasi tidak cukup"
  db.investments[u][fromInv]-=amount
  db.users[u][toA]=(db.users[u][toA]||0)+amount
  db.ledger.push({ id:newId(db), t:new Date().toISOString(), type:"INVEST_OUT", u, fromInv, toA, amount })
  saveDB(db)
  return "📉 Withdraw tercatat"
}

export function undo(u){
  const db=loadDB()
  const last = [...db.ledger].reverse().find(l=>l.user===u)
  if(!last) return "❌ Tidak ada transaksi"
  if(last.type==="IN") db.users[u][last.akun]-=last.amount
  if(last.type==="OUT") db.users[u][last.akun]+=last.amount
  db.ledger.push({ id:newId(db), t:new Date().toISOString(), type:"UNDO", ref:last.id })
  saveDB(db)
  return "↩️ Undo sukses"
}

export function exportAll(){
  return JSON.stringify(loadDB(),null,2)
}

export function getDB(){ return loadDB() }
