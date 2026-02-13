const express = require("express");
const axios = require("axios");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// In-memory storage
let calls = [];

/*
================================================
AI CALL SCORING FUNCTION
================================================
*/
async function calculateCallScore(transcript) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional call quality evaluator.
Score the call from 0 to 100.
Return ONLY valid JSON like:
{ "score": number }`
        },
        {
          role: "user",
          content: transcript
        }
      ]
    });

    const text = response.choices[0].message.content.trim();
    const parsed = JSON.parse(text);

    return parsed.score || 0;

  } catch (error) {
    console.error("OpenAI scoring error:", error.message);
    return 0;
  }
}

/*
================================================
START CALL
================================================
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
        customer: { number: phone_number }
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
================================================
VAPI WEBHOOK
================================================
*/
app.post("/vapi-webhook", async (req, res) => {
  const event = req.body;

  console.log("Webhook received:", JSON.stringify(event, null, 2));

  if (event?.message?.call?.id) {

    const callId = event.message.call.id;
    const call = calls.find(c => c.id === callId);

    if (call) {

      // When full report comes
      if (event.message.type === "end-of-call-report") {

        call.status = "completed";
        call.duration = event.message.durationSeconds || 0;
        call.cost = event.message.cost || 0;
        call.recordingUrl = event.message.recordingUrl || null;
        call.transcript = event.message.transcript || null;

        // AI Score
        if (call.transcript) {
          const aiScore = await calculateCallScore(call.transcript);
          call.score = aiScore;
        }
      }

      // Status updates
      if (event.message.type === "status-update") {
        call.status = event.message.status || call.status;
      }
    }
  }

  res.sendStatus(200);
});

/*
================================================
GET ALL CALLS
================================================
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
    calls
  });
});

/*
================================================
GET SINGLE CALL
================================================
*/
app.get("/call/:id", (req, res) => {
  const call = calls.find(c => c.id === req.params.id);

  if (!call) {
    return res.status(404).json({ error: "Call not found" });
  }

  res.json(call);
});

/*
================================================
START SERVER
================================================
*/
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

