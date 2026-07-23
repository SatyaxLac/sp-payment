const pool = require('../db');

// Wrap any route POST with this to make it idempotent
const idempotency = async (req, res, next) => {
    const key = req.headers['idempotency-key'] || req.body?.idempotency_key;

    if(!key) return next(); // Key is optional - skip if not provided

    try {
        const existing = await pool.query(
            `SELECT id, status FROM transactions WHERE idempotency_key = $1`, [key]
        );

        if(existing.rows.length > 0){
            return res.status(200).json({
                message: 'Duplicate request — returning existing transaction',
                transaction: existing.rows[0]
            });
        }

        req.idempotencyKey = key;  // pass it along to controller
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = idempotency;