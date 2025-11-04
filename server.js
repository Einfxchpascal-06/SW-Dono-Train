import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ========== CONFIG ==========
const PORT = process.env.PORT || 10000;
const KOFI_SECRET = process.env.KOFI_SECRET || "soundwave-secret-123";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

// ========== STATE STORAGE ==========
let totals = {}; // { channelName: totalCents }
let lastDonation = {}; // track last donation timestamp

// ========== HEALTH ==========
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ========== STREAM ELEMENTS ==========
app.post("/streamelements", (req, res) => {
  try {
    const data = req.body;
    const { channel, amount } = data;

    if (!channel || !amount) {
      return res.status(400).json({ error: "Missing channel or amount" });
    }

    const cents = Math.round(Number(amount) * 100);
    if (!totals[channel]) totals[channel] = 0;
    totals[channel] += cents;
    lastDonation[channel] = Date.now();

    console.log(`💰 Added ${amount}€ via StreamElements to ${channel}, total: €${(totals[channel] / 100).toFixed(2)}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Error handling StreamElements:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ========== KO-FI ==========
app.post("/kofi", (req, res) => {
  console.log("☕ Incoming POST /kofi");

  try {
    const body = req.body;

    // Allow raw string or parsed JSON
    let data = body;
    if (typeof body === "string") {
      try {
        data = JSON.parse(body);
      } catch (err) {
        console.warn("Could not parse Ko-Fi body as JSON");
      }
    }

    console.log("Body received:", JSON.stringify(data));

    const verification = data.verification_token;
    if (verification !== "b1c80c22-ba70-4368-a35b-fcb517c562b6") {
      console.warn("⚠️ Invalid verification token");
      return res.status(403).json({ error: "Invalid verification token" });
    }

    const channel = req.query.channel || "Soundwave1111";
    const amount = Number(data.amount || 0);
    if (!totals[channel]) totals[channel] = 0;
    totals[channel] += Math.round(amount * 100);
    lastDonation[channel] = Date.now();

    console.log(`☕ Added ${amount}€ via Ko-Fi to ${channel}, total: €${(totals[channel] / 100).toFixed(2)}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Error handling Ko-Fi:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ========== MANUAL ADD (used by overlay) ==========
app.post("/add", (req, res) => {
  const { channel, amount } = req.body;
  if (!channel || !amount) {
    return res.status(400).json({ error: "Missing channel or amount" });
  }

  const cents = Math.round(Number(amount) * 100);
  if (!totals[channel]) totals[channel] = 0;
  totals[channel] += cents;
  lastDonation[channel] = Date.now();

  console.log(`💾 Manual add ${amount}€ to ${channel}, new total: €${(totals[channel] / 100).toFixed(2)}`);
  res.json({ success: true });
});

// ========== GET CURRENT STATE ==========
app.get("/state", (req, res) => {
  const channel = req.query.channel || "Soundwave1111";
  const totalCents = totals[channel] || 0;

  res.json({
    channel,
    totalCents,
    totalEuros: (totalCents / 100).toFixed(2),
    lastDonation: lastDonation[channel] || null,
  });
});

// ========== RESET ENDPOINT (optional) ==========
app.post("/reset", (req, res) => {
  const { channel } = req.body;
  if (!channel) return res.status(400).json({ error: "Missing channel" });

  totals[channel] = 0;
  lastDonation[channel] = null;

  console.log(`🔄 Reset total for ${channel}`);
  res.json({ success: true });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log("");
  console.log("🚂 Dono-Train backend running on port", PORT);
  console.log("✅ Your service is live 🎉");
  console.log("////////////////////////////////////////////////////////////////");
  console.log("👉 Available at your primary URL https://sw-dono-train.onrender.com");
  console.log("////////////////////////////////////////////////////////////////");
});
