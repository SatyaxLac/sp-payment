const express = require('express');
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors({ origin: [
  'http://localhost:5173',
  'https://flo-payments.vercel.app'
  ] 
}));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/webhooks', require('./routes/webhooks'));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});