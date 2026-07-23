const router = require('express').Router();
const { handleBankWebhook } = require('../controllers/webhookController');

router.post('/bank', handleBankWebhook);

module.exports = router;