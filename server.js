const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/*
====================================
IN-MEMORY CALL STORAGE
====================================
*/
let calls = [];

/*
====================================
START CALL (ONLY PHONE NUMBER)
====================================
*/
app.post("/start-call", async (req, res) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ error: "Phone number required" });
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

    calls.push({
      id: response.data.id,
      number: phone_number,
      status: response.data.status || "queued",
      duration: 0,
      cost: 0,
      recordingUrl: null,
      transcript: null,
      score: 0,
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
WEBHOOK (UPDATES CALL DETAILS)
====================================
*/
app.post("/vapi-webhook", (req, res) => {
  const event = req.body;

  console.log("Webhook received:", event);

  if (event?.id) {
    const call = calls.find(c => c.id === event.id);

    if (call) {
      call.status = event.status || call.status;
      call.duration = event.duration || call.duration;
      call.cost = event.cost || call.cost;
      call.recordingUrl = event.recordingUrl || call.recordingUrl;
      call.transcript = event.transcript || call.transcript;

      // Simple success scoring
      if (call.status === "completed" && call.duration > 10) {
        call.score = 100;
      } else if (call.status === "completed") {
        call.score = 70;
      } else {
        call.score = 0;
      }
    }
  }

  res.sendStatus(200);
});

/*
====================================
GET ALL CALLS + SUMMARY
====================================
*/
app.get("/calls", (req, res) => {

  const totalCalls = calls.length;
  const completedCalls = calls.filter(c => c.status === "completed").length;
  const failedCalls = calls.filter(c => c.status === "failed").length;

  const successRate = totalCalls === 0
    ? 0
    : ((completedCalls / totalCalls) * 100).toFixed(2);

  res.json({
    summary: {
      totalCalls,
      completedCalls,
      failedCalls,
      successRate: successRate + "%"
    },
    calls: calls
  });
});

/*
====================================
GET SINGLE CALL DETAILS
====================================
*/
app.get("/call/:id", (req, res) => {
  const { id } = req.params;

  const call = calls.find(c => c.id === id);

  if (!call) {
    return res.status(404).json({ error: "Call not found" });
  }

  res.json(call);
});

/*
====================================
START SERVER
====================================
*/
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
