const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Temporary in-memory storage
let calls = [];

/*
====================================
START CALL ENDPOINT
====================================
*/
app.post("/start-call", async (req, res) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const response = await axios.post(
      "https://api.vapi.ai/call",
      {
        assistantId: process.env.VAPI_ASSISTANT_ID,
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: phone_number
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    // Store call locally
    calls.push({
      id: response.data.id,
      number: phone_number,
      status: response.data.status || "queued",
      createdAt: new Date()
    });

    res.json(response.data);

  } catch (error) {
    console.error("Vapi Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Call failed" });
  }
});

/*
====================================
VAPI WEBHOOK ENDPOINT
====================================
*/
app.post("/vapi-webhook", (req, res) => {
  const event = req.body;

  console.log("Webhook received:", event);

  if (event?.id && event?.status) {
    const call = calls.find(c => c.id === event.id);
    if (call) {
      call.status = event.status;
    }
  }

  res.sendStatus(200);
});

/*
====================================
GET ALL CALLS
====================================
*/
app.get("/calls", (req, res) => {
  res.json(calls);
});

/*
====================================
GET SUCCESS RATE
====================================
*/
app.get("/success-rate", (req, res) => {
  const total = calls.length;
  const completed = calls.filter(c => c.status === "completed").length;

  const successRate = total === 0 ? 0 : (completed / total) * 100;

  res.json({
    totalCalls: total,
    completedCalls: completed,
    successRate: successRate.toFixed(2) + "%"
  });
});

/*
====================================
SERVER START
====================================
*/
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
