import * as L from "./ledger.js"

export async function handleMessage(_, text){
  const t=text.toLowerCase().trim()
  let m

  if(t==="reset saldo acuan") return L.resetSaldo()
  if(t==="closing") return L.closing()
  if(t==="export") return L.exportAll()
  if(t==="saldo") return JSON.stringify(L.getDB().users,null,2)

  if(m=t.match(/^set saldo (m|y) (\w+) (\d+)$/)) return L.setSaldo(m[1].toUpperCase(),m[2],+m[3])
  if(m=t.match(/^(m|y) transfer (\d+) dari (\w+) ke (\w+)$/))
    return L.transfer(m[1].toUpperCase(),m[4],m[1].toUpperCase(),m[5],+m[2])
  if(m=t.match(/^(m|y) transfer (\d+) ke (m|y) via (\w+)$/))
    return L.transfer(m[1].toUpperCase(),m[4],m[3].toUpperCase(),m[4],+m[2])

  if(m=t.match(/^(m|y) invest (\d+) ke (\w+) via (\w+)$/))
    return L.invest(m[1].toUpperCase(),m[5],m[4],+m[2])
  if(m=t.match(/^(m|y) withdraw (\d+) dari (\w+) ke (\w+)$/))
    return L.withdraw(m[1].toUpperCase(),m[4],m[5],+m[2])

  if(m=t.match(/^(m|y) (.+) (\d+) via (\w+)$/))
    return L.addNatural(m[1].toUpperCase(),+m[3],m[4],m[2])

  return "❓"
}
