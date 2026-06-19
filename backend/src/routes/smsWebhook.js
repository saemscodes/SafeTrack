const router = require('express').Router();
const { prisma } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * SMS Fallback Webhook
 * Receives structured SMS messages from the SMS gateway (e.g. Twilio)
 * Payload format in SMS body: LOC,<userId>,<lat>,<lng>,<accuracy>,<batteryPct>,<timestamp>
 * 
 * Protected by HMAC signature or a shared webhook secret.
 */

function verifyWebhookSecret(req) {
  const secret = req.headers['x-webhook-secret'];
  return secret === process.env.SMS_WEBHOOK_SECRET;
}

// POST /webhook/sms/inbound
router.post('/inbound', async (req, res) => {
  if (!verifyWebhookSecret(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Twilio sends form-encoded, raw body varies by provider
  const body = req.body.Body || req.body.body || req.body.message || '';
  const from = req.body.From || req.body.from || '';

  console.log(`[SMS Webhook] FROM: ${from} — BODY: ${body}`);

  // Parse our structured payload: LOC,<userId>,<lat>,<lng>,<acc>,<bat>,<ts>
  // Alternatively, look up user by phone number
  let lat, lng, accuracy, batteryPct, timestamp, userId;

  const parts = body.trim().split(',');
  if (parts[0] === 'LOC' && parts.length >= 5) {
    // Named format: LOC,<userId>,<lat>,<lng>,<accuracy>,<batteryPct>,<timestamp>
    userId = parts[1];
    lat = parseFloat(parts[2]);
    lng = parseFloat(parts[3]);
    accuracy = parseFloat(parts[4]);
    batteryPct = parts[5] ? parseInt(parts[5], 10) : null;
    timestamp = parts[6] ? new Date(parseInt(parts[6], 10)) : new Date();
  } else {
    // Fallback: look up by sender phone
    const user = await prisma.user.findUnique({ where: { phone: from } });
    if (!user) {
      console.warn('[SMS Webhook] Unknown sender phone:', from);
      return res.status(200).send('<Response/>'); // Twilio expects 200 even for ignored msgs
    }
    // Try minimal format: <lat>,<lng>
    if (parts.length >= 2) {
      userId = user.id;
      lat = parseFloat(parts[0]);
      lng = parseFloat(parts[1]);
      accuracy = null;
      batteryPct = null;
      timestamp = new Date();
    } else {
      console.warn('[SMS Webhook] Unrecognised body format');
      return res.status(200).send('<Response/>');
    }
  }

  if (!userId || isNaN(lat) || isNaN(lng)) {
    console.warn('[SMS Webhook] Parse failed — invalid coords');
    return res.status(200).send('<Response/>');
  }

  const now = timestamp || new Date();

  // Upsert current_location
  await prisma.currentLocation.upsert({
    where: { userId },
    create: { userId, lat, lng, accuracy, batteryPct, source: 'SMS_FALLBACK' },
    update: { lat, lng, accuracy, batteryPct, source: 'SMS_FALLBACK', updatedAt: now }
  });

  // Append to history
  await prisma.locationHistory.create({
    data: { userId, lat, lng, accuracy, batteryPct, source: 'SMS_FALLBACK', recordedAt: now }
  });

  console.log(`[SMS Webhook] Location recorded for user ${userId}: (${lat}, ${lng})`);
  res.status(200).send('<Response/>'); // Twilio TwiML-compatible empty reply
});

module.exports = router;
