// =======================
// Soundwave Dono-Train Backend
// =======================
const express = require("express");
const cors = require("cors");
const app = express();

// ---- Middleware ----
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true })); // wichtig für Ko-Fi (form-data)

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
app.use(cors({ origin: ALLOWED_ORIGIN === "*" ? true : [ALLOWED_ORIGIN] }));

// ---- Speicher (RAM-basierend) ----
const store = new Map();
const eurosToCents = (e) => Math.round(Number(e) * 100);
const getState = (key) => store.get(key) || { totalCents: 0, lastUpdated: null };
const setState = (key, totalCents) =>
  store.set(key, { totalCents, lastUpdated: new Date().toISOString() });

// ---- Health Check ----
app.get("/health", (_, res) => res.json({ ok: true }));

// ---- Get aktueller Stand ----
app.get("/state", (req, res) => {
  const key = (req.query.channel || "default").toLowerCase();
  res.json(getState(key));
});

// ---- Add von StreamElements ----
app.post("/add", (req, res) => {
  const { channel = "default", amount } = req.body || {};
  if (typeof amount !== "number")
    return res.status(400).json({ error: "amount required (number €)" });

  const key = String(channel).toLowerCase();
  const cur = getState(key).totalCents;
  const next = cur + eurosToCents(amount);
  setState(key, next);
  console.log(`💰 Added ${amount}€ via StreamElements to ${channel}, total: €${(next / 100).toFixed(2)}`);
  res.json({ ok: true, totalCents: next });
});

// ---- Reset ----
app.post("/reset", (req, res) => {
  const { channel = "default", token } = req.body || {};
  if (token !== process.env.KOFI_SECRET)
    return res.status(403).json({ error: "forbidden" });
  const key = String(channel).toLowerCase();
  setState(key, 0);
  console.log(`🔄 Reset total for ${channel}`);
  res.json({ ok: true });
});

// ---- Ko-Fi Webhook ----
app.post("/kofi", (req, res) => {
  console.log("💬 Incoming POST /kofi");
  console.log("Body received:", req.body);

  // Dein Ko-Fi Verification Token (automatisch generiert)
  const kofiVerification = "b1c80c22-ba70-4368-a35b-fcb517c562b6";
  if (
    req.body?.verification_token &&
    req.body.verification_token !== kofiVerification
  ) {
    console.log("❌ Invalid verification_token:", req.body.verification_token);
    return res.status(403).json({ error: "invalid token" });
  }

  const channel = (req.query.channel || "default").toLowerCase();
  let data = req.body?.data || req.body;

  // Falls data als String kommt, in JSON umwandeln
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      console.log("⚠️ Could not parse data JSON:", e);
    }
  }

  // Betrag extrahieren
  let amount = Number(data?.amount || 0);
  if (isNaN(amount)) amount = 0;

  const cur = getState(channel).totalCents;
  const next = cur + eurosToCents(amount);
  setState(channel, next);

  console.log(`✅ Added ${amount} to ${channel}, new total: €${(next / 100).toFixed(2)}`);
  res.json({ ok: true, totalCents: next });
});

// ---- Start Server ----
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("🚀 Dono-Train backend running on port " + port)); 
