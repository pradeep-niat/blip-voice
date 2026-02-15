const express = require("express");
const axios = require("axios");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/*
================================================
IN-MEMORY STORAGE
================================================
*/
let calls = [];
let customers = [];

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
COMMON VAPI CALL FUNCTION (REUSED)
================================================
*/
async function triggerVapiCall(phone_number) {
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

  return response.data;
}

/*
================================================
START SINGLE CALL (UNCHANGED LOGIC)
================================================
*/
app.post("/start-call", async (req, res) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ error: "Phone number required" });
    }

    const response = await triggerVapiCall(phone_number);

    calls.push({
      id: response.id,
      number: phone_number,
      status: "queued",
      duration: 0,
      cost: 0,
      recordingUrl: null,
      transcript: null,
      score: 0,
      createdAt: new Date(),
      processed: false
    });

    res.json(response);

  } catch (error) {
    console.error("Vapi Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Call failed" });
  }
});

/*
================================================
UPLOAD CUSTOMERS (CSV TEXT)
================================================
*/
app.post("/upload-customers", (req, res) => {
  const { csv_data } = req.body;

  if (!csv_data) {
    return res.status(400).json({ error: "CSV data required" });
  }

  const rows = csv_data.split("\n");

  rows.forEach((row, index) => {
    if (index === 0) return;

    const [name, phone] = row.split(",");

    if (!phone) return;

    customers.push({
      id: Date.now() + Math.random(),
      name: name?.trim(),
      phone_number: phone.trim()
    });
  });

  res.json({ message: "Customers uploaded", customers });
});

/*
================================================
GET CUSTOMERS
================================================
*/
app.get("/customers", (req, res) => {
  res.json(customers);
});

/*
================================================
START CAMPAIGN (BATCH SAFE)
================================================
*/
app.post("/start-campaign", async (req, res) => {
  const { customer_ids } = req.body;

  if (!customer_ids || customer_ids.length === 0) {
    return res.status(400).json({ error: "No customers selected" });
  }

  const selectedCustomers = customers.filter(c =>
    customer_ids.includes(c.id)
  );

  const BATCH_SIZE = 3;

  for (let i = 0; i < selectedCustomers.length; i += BATCH_SIZE) {
    const batch = selectedCustomers.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (customer) => {
        try {
          const response = await triggerVapiCall(customer.phone_number);

          calls.push({
            id: response.id,
            number: customer.phone_number,
            status: "queued",
            duration: 0,
            cost: 0,
            recordingUrl: null,
            transcript: null,
            score: 0,
            createdAt: new Date(),
            processed: false
          });

        } catch (err) {
          console.error("Campaign call failed:", err.message);
        }
      })
    );
  }

  res.json({ message: "Campaign started successfully" });
});

/*
================================================
VAPI WEBHOOK (DUPLICATE SAFE)
================================================
*/
app.post("/vapi-webhook", async (req, res) => {
  const event = req.body;

  if (
    event?.message?.type === "end-of-call-report" &&
    event?.message?.call?.id
  ) {
    const callId = event.message.call.id;
    const call = calls.find(c => c.id === callId);

    if (!call) return res.sendStatus(200);
    if (call.processed === true) return res.sendStatus(200);

    call.status = "completed";
    call.duration = event.message.durationSeconds || 0;
    call.cost = event.message.cost || 0;
    call.recordingUrl = event.message.recordingUrl || null;
    call.transcript = event.message.transcript || null;

    if (call.transcript) {
      const aiScore = await calculateCallScore(call.transcript);
      call.score = aiScore;
    }

    call.processed = true;
  }

  res.sendStatus(200);
});

/*
================================================
GET CALLS
================================================
*/
app.get("/calls", (req, res) => {
  const totalCalls = calls.length;
  const completedCalls = calls.filter(c => c.status === "completed").length;
  const failedCalls = calls.filter(c => c.status === "failed").length;

  const successRate =
    totalCalls > 0
      ? ((completedCalls / totalCalls) * 100).toFixed(2)
      : "0.00";

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
HEALTH CHECK
================================================
*/
app.get("/", (req, res) => {
  res.send("Server running");
});

/*
================================================
START SERVER
================================================
*/
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
