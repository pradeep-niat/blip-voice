const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Test Route
app.get("/", (req, res) => {
  res.send("Vapi Backend Running");
});

// Start Call Route
app.post("/start-call", async (req, res) => {
  const { phone_number } = req.body;

  try {
    const response = await axios.post(
      "https://api.vapi.ai/call",
      {
        assistantId: process.env.VAPI_ASSISTANT_ID,
        phoneNumber: phone_number
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.log(error.response?.data || error.message);
    res.status(500).json({ error: "Call failed" });
  }
});

// Webhook Route
app.post("/vapi-webhook", (req, res) => {
  console.log("Webhook received:", req.body);
  res.status(200).send("OK");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
