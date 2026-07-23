const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const SHARED_SECRET = 'mock_bank_webhook_secret'; // both servers know this
const MAIN_SERVER_WEBHOOK = 'http://localhost:3000/api/webhooks/bank';

app.post('/debit', async (req, res) => {
  const { transaction_id, amount, user_id } = req.body;

  console.log(`[Mock Bank] Received debit request: ₹${amount} for tx ${transaction_id}`);

  // Acknowledge immediately — "we got it"
  res.status(200).json({ message: 'Request received', transaction_id });

  // Simulate async processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 80% success, 20% failure — chaos testing
  const success = Math.random() > 0.2;
  const status = success ? 'SUCCESS' : 'FAILED';
  const reason = success ? null : 'Bank declined transaction';

  console.log(`[Mock Bank] Processing complete: ${status} for tx ${transaction_id}`);

  // Sign the webhook payload
  const payload = JSON.stringify({ transaction_id, status, reason });
  const signature = crypto
    .createHmac('sha256', SHARED_SECRET)
    .update(payload)
    .digest('hex');

  // Fire webhook back to main server
  try {
    await fetch(MAIN_SERVER_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bank-signature': signature
      },
      body: payload
    });
    console.log(`[Mock Bank] Webhook sent for tx ${transaction_id}`);
  } catch (err) {
    console.error('[Mock Bank] Failed to send webhook:', err.message);
  }
});

app.listen(4000, () => console.log('[Mock Bank] Running on port 4000'));