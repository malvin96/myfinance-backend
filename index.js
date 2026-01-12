import express from "express"
import cors from "cors"
import { handleMessage } from "./parser.js"

const app = express()
app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
  res.send("MY FINANCE BACKEND OK")
})

app.post("/webhook", async (req, res) => {
  try {
    console.log("REQ BODY:", req.body)

    const chat_id = req.body.chat_id || "default"
    const text = req.body.text || req.body.message || ""

    if (!text) return res.json({ reply: "❌ Empty message" })

    const reply = await handleMessage(chat_id, text)
    res.json({ reply })
  } catch (e) {
    console.error("ERROR:", e)
    res.json({ reply: "⚠️ Server error" })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log("RUNNING ON", PORT))
