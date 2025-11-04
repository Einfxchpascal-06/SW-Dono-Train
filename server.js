const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: ALLOWED_ORIGIN === '*' ? true : [ALLOWED_ORIGIN] }));

const store = new Map();
const eurosToCents = (e) => Math.round(Number(e) * 100);
const getState = (key) => store.get(key) || { totalCents: 0, lastUpdated: null };
const setState = (key, totalCents) =>
  store.set(key, { totalCents, lastUpdated: new Date().toISOString() });

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/state', (req, res) => {
  const key = (req.query.channel || 'default').toLowerCase();
  res.json(getState(key));
});

app.post('/add', (req, res) => {
  const { channel = 'default', amount } = req.body || {};
  if (typeof amount !== 'number')
    return res.status(400).json({ error: 'amount required (number €)' });

  const key = String(channel).toLowerCase();
  const cur = getState(key).totalCents;
  const next = cur + eurosToCents(amount);
  setState(key, next);
  res.json({ ok: true, totalCents: next });
});

app.post('/reset', (req, res) => {
  const { channel = 'default', token } = req.body || {};
  if (token !== process.env.KOFI_SECRET)
    return res.status(403).json({ error: 'forbidden' });
  const key = String(channel).toLowerCase();
  setState(key, 0);
  res.json({ ok: true });
});

app.post('/kofi', (req, res) => {
  console.log("💬 Incoming POST /kofi");
  console.log("Body received:", req.body);

  const kofiVerification = "b1c80c22-ba70-4368-a35b-fcb517c562b6";
  if (req.body?.verification_token && req.body.verification_token !== kofiVerification) {
    console.log("❌ Invalid verification_token:", req.body.verification_token);
    return res.status(403).json({ error: 'invalid token' });
  }

  const channel = (req.query.channel || 'default').toLowerCase();
  const data = req.body?.data || req.body;

  let amount = Number(data?.amount || 0);
  if (isNaN(amount)) amount = 0;

  const cur = getState(channel).totalCents;
  const next = cur + eurosToCents(amount);
  setState(channel, next);

  console.log(`✅ Added ${amount} to ${channel}, new total: €${(next/100).toFixed(2)}`);

  res.json({ ok: true, totalCents: next });
});


const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Dono-Train backend running on port ' + port));
