const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1', [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Create user AND wallet in a single transaction
    // If either fails, both roll back — user without wallet is a broken state
    const result = await pool.query('BEGIN');

    const userResult = await pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3) RETURNING id, name, email`,
      [name, email, hashed]
    );

    const user = userResult.rows[0];

    await pool.query(
      `INSERT INTO wallets (user_id, balance)
       VALUES ($1, $2)`,
      [user.id, 1000.00] // seed balance so you can test transfers
    );

    await pool.query('COMMIT');

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({ user, token });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT u.*, w.balance, w.id as wallet_id
       FROM users u
       JOIN wallets w ON w.user_id = u.id
       WHERE u.email = $1`,
      [email]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      wallet: { id: user.wallet_id, balance: user.balance },
      token
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
};

module.exports = { register, login };