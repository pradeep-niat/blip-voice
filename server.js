const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("Outbound Call Server Running");
});

// Start outbound call
app.post("/start-call", async (req, res) => {
  const { phone_number } = req.body;

  try {
    const response = await axios.post(
      "https://api.vapi.ai/call",
      {
        assistantId: process.env.VAPI_ASSISTANT_ID,
        phoneNumber: {
          twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,   // YOUR Twilio number
          twilioAccountSid: process.env.TWILIO_ACCOUNT_SID
        },
        customer: {
          number: phone_number   // Customer number you want to call
        }
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
    console.log("Vapi Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Call failed" });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
