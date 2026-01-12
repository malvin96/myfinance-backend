import express from "express"
import cors from "cors"
import { handleMessage } from "./parser.js"

const app = express()
app.use(cors())
app.use(express.json())

app.get("/", (req,res) => {
  res.send("MY FINANCE BACKEND OK")
})

app.post("/webhook", async (req,res) => {
  try {
    const text = req.body.text || ""
    const user = req.body.user || "M"

    const reply = await handleMessage(user, text)
    res.json({ reply })
  } catch (e) {
    console.error(e)
    res.json({ reply: "⚠️ Server error" })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log("RUNNING ON", PORT))
