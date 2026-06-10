const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, handleWebhook } = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.post('/create-order', auth, role('player'), createOrder);
router.post('/verify', auth, role('player'), verifyPayment);
router.post('/webhook', handleWebhook);

module.exports = router;
