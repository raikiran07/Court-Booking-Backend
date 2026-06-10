const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment } = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.post('/create-order', auth, role('player'), createOrder);
router.post('/verify', auth, role('player'), verifyPayment);

module.exports = router;
