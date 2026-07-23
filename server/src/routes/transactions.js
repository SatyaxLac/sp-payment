const router = require('express').Router();
const authenticate = require('../middleware/auth');
const idempotency = require('../middleware/idempotency')
const { transfer, getTransactionHistory } = require('../controllers/transferController');

router.post('/transfer', authenticate, idempotency, transfer);
router.get('/history', authenticate, getTransactionHistory);

router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const result = await require('../db').query(
    `SELECT * FROM transactions WHERE id = $1`, [id]
  );
  res.json(result.rows[0]);
});

module.exports = router;