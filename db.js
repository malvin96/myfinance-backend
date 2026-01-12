import fs from "fs"

const FILE = "./finance_db.json"

export function loadDB(){
  if(!fs.existsSync(FILE)){
    fs.writeFileSync(FILE, JSON.stringify({
      locked:false,
      users:{ M:{}, Y:{} },
      investments:{ M:{}, Y:{} },
      ledger:[],
      closings:[],
      lastId:0
    }, null, 2))
  }
  return JSON.parse(fs.readFileSync(FILE,"utf8"))
}

export function saveDB(db){
  fs.writeFileSync(FILE, JSON.stringify(db,null,2))
}
