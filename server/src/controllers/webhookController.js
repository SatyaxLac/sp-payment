const crypto = require('crypto');
const pool = require('../db');
const { transition } = require('../utils/stateMachine');

const SHARED_SECRET = 'mock_bank_webhook_secret';

const verifySignature = (payload, signature) => {
  const expected = crypto
    .createHmac('sha256', SHARED_SECRET)
    .update(payload)
    .digest('hex');
  // timing-safe comparison — prevents timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
};

const handleBankWebhook = async (req, res) => {
  const signature = req.headers['x-bank-signature'];
  const rawBody = JSON.stringify(req.body); // must match what bank signed

  // Verify signature first — reject anything that doesn't match
  if (!signature || !verifySignature(rawBody, signature)) {
    console.warn('[Webhook] Invalid signature — rejected');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { transaction_id, status, reason } = req.body;

  if (!transaction_id || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = await pool.connect();

  try {
    // Fetch current transaction state
    const txResult = await client.query(
      `SELECT * FROM transactions WHERE id = $1`, [transaction_id]
    );

    if (txResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const tx = txResult.rows[0];

    // Validate state transition — idempotency for webhooks
    // If already SUCCESS/FAILED, ignore duplicate webhook
    if (tx.status === 'SUCCESS' || tx.status === 'FAILED') {
      console.log(`[Webhook] Duplicate webhook for tx ${transaction_id} — ignoring`);
      return res.status(200).json({ message: 'Already processed' });
    }

    await client.query('BEGIN');

    if (status === 'SUCCESS') {
      // Validate transition
      transition(tx.status, 'PROCESSING');
      transition('PROCESSING', 'SUCCESS');

      // Lock wallets
      const lockOrder = [tx.sender_id, tx.receiver_id].sort();
      await client.query(
        `SELECT id FROM wallets WHERE user_id = ANY($1::uuid[]) FOR UPDATE`,
        [lockOrder]
      );

      // Now move the money
      await client.query(
        `UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`,
        [tx.amount, tx.sender_id]
      );
      await client.query(
        `UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`,
        [tx.amount, tx.receiver_id]
      );

      // Write ledger
      await client.query(
        `INSERT INTO ledger_entries (transaction_id, user_id, amount, entry_type)
         VALUES ($1, $2, $3, 'DEBIT'), ($1, $4, $5, 'CREDIT')`,
        [transaction_id, tx.sender_id, -tx.amount, tx.receiver_id, tx.amount]
      );

      // Mark SUCCESS
      await client.query(
        `UPDATE transactions SET status = 'SUCCESS', updated_at = NOW() WHERE id = $1`,
        [transaction_id]
      );

      console.log(`[Webhook] tx ${transaction_id} settled successfully`);

    } else {
      // Bank declined — mark FAILED, no money moves
      transition(tx.status, 'FAILED');
      await client.query(
        `UPDATE transactions 
         SET status = 'FAILED', failure_reason = $1, updated_at = NOW()
         WHERE id = $2`,
        [reason || 'Bank declined', transaction_id]
      );
      console.log(`[Webhook] tx ${transaction_id} failed: ${reason}`);
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Webhook processed' });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Webhook] Processing error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  } finally {
    client.release();
  }
};

module.exports = { handleBankWebhook };