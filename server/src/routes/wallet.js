const router = require('express').Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');

// Get your own wallet balance
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT w.id, w.balance, w.currency, w.status
       FROM wallets w WHERE w.user_id = $1`,
      [req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch wallet' });
  }
});

// add to server/src/routes/wallet.js
router.get('/ledger-check', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        SUM(amount) as total,
        COUNT(*) as entry_count,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credits,
        SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as total_debits
      FROM ledger_entries
    `);

    const { total, entry_count, total_credits, total_debits } = result.rows[0];
    const sum = parseFloat(total || 0);

    res.json({
      balanced: Math.abs(sum) < 0.001, // floating point tolerance
      sum,
      entry_count: parseInt(entry_count),
      total_credits: parseFloat(total_credits || 0),
      total_debits: parseFloat(total_debits || 0),
      message: Math.abs(sum) < 0.001
        ? 'Ledger is balanced — all debits match credits'
        : `WARNING: Ledger imbalance of ₹${sum} detected`
    });
  } catch (err) {
    res.status(500).json({ error: 'Ledger check failed' });
  }
});

module.exports = router;