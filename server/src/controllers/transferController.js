const pool = require('../db');
const { transition } = require('../utils/stateMachine');

// Helper — update transaction state with validation
const updateTxStatus = async (client, txId, currentStatus, nextStatus, failureReason = null) => {
  transition(currentStatus, nextStatus); // throws if invalid
  await client.query(
    `UPDATE transactions 
     SET status = $1, failure_reason = $2, updated_at = NOW()
     WHERE id = $3`,
    [nextStatus, failureReason, txId]
  );
};

const transfer = async (req, res) => {
  const senderId = req.userId;
  const { receiver_email, amount } = req.body;
  const idempotency_key = req.idempotencyKey || req.body.idempotency_key || null;

  if (!amount || amount <= 0)
    return res.status(400).json({ error: 'Amount must be positive' });
  if (!receiver_email)
    return res.status(400).json({ error: 'Receiver email required' });

  const client = await pool.connect();

  try {
    const receiverResult = await client.query(
      `SELECT id FROM users WHERE email = $1`, [receiver_email]
    );
    if (receiverResult.rows.length === 0)
      return res.status(404).json({ error: 'Receiver not found' });

    const receiverId = receiverResult.rows[0].id;
    if (receiverId === senderId)
      return res.status(400).json({ error: 'Cannot transfer to yourself' });

    // Quick balance pre-check (not the real guard — webhook handler is)
    const senderWallet = await client.query(
      `SELECT balance FROM wallets WHERE user_id = $1`, [senderId]
    );
    if (parseFloat(senderWallet.rows[0].balance) < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Create transaction — INITIATED
    const txResult = await client.query(
      `INSERT INTO transactions (sender_id, receiver_id, amount, status, idempotency_key)
       VALUES ($1, $2, $3, 'INITIATED', $4) RETURNING id`,
      [senderId, receiverId, amount, idempotency_key]
    );
    const txId = txResult.rows[0].id;

    // Move to PENDING
    await client.query(
      `UPDATE transactions SET status = 'PENDING', updated_at = NOW() WHERE id = $1`,
      [txId]
    );

    // Fire request to mock bank — don't await the result
    // The webhook will handle settlement asynchronously
    fetch(`${process.env.MOCK_BANK_URL}/debit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: txId, amount, user_id: senderId })
    }).catch(err => console.error('[Transfer] Failed to reach mock bank:', err.message));

    // Return immediately — don't wait for bank
    res.status(202).json({
      message: 'Payment initiated — pending bank confirmation',
      transaction_id: txId,
      status: 'PENDING'
    });

  } catch (err) {
    console.error('Transfer error:', err);
    res.status(500).json({ error: 'Transfer failed', detail: err.message });
  } finally {
    client.release();
  }
};

const getTransactionHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        t.id,
        t.amount,
        t.status,
        t.created_at,
        t.failure_reason,
        sender.name as sender_name,
        receiver.name as receiver_name,
        CASE 
          WHEN t.sender_id = $1 THEN 'SENT'
          ELSE 'RECEIVED'
        END as direction
       FROM transactions t
       JOIN users sender ON sender.id = t.sender_id
       JOIN users receiver ON receiver.id = t.receiver_id
       WHERE t.sender_id = $1 OR t.receiver_id = $1
       ORDER BY t.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch transactions' });
  }
};

module.exports = { transfer, getTransactionHistory };