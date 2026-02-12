const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());


app.get("/", (req, res) => {
  res.send("Backend is running");
});


// 🔥 START CALL
app.post("/start-call", async (req, res) => {
  const { phone_number, agent_id } = req.body;

  try {
    const response = await axios.post(
      "https://api.retellai.com/v2/create-call",
      {
        agent_id: agent_id,
        to_number: phone_number
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Call failed" });
  }
});

// 🔥 WEBHOOK FROM RETELL
app.post("/retell-webhook", async (req, res) => {
  const callData = req.body;

  console.log("Webhook received:", callData);

  // Here we will later save to Supabase

  res.status(200).send("OK");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
