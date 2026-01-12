import express from "express"
import cors from "cors"
import { handleMessage } from "./parser.js"

const app = express()
app.use(cors())
app.use(express.json())

app.get("/", (req,res)=>{
  res.send("MY FINANCE v2.2 OK")
})

app.post("/webhook", async (req,res)=>{
  try{
    const text = req.body.text || req.body.message || ""
    const reply = await handleMessage(req.body.chat_id || "default", text)
    res.json({ reply })
  }catch(e){
    console.error(e)
    res.json({ reply:"⚠️ Server error" })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, ()=> console.log("MY FINANCE RUNNING ON", PORT))
