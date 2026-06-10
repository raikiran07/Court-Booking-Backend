const express = require('express');
const router = express.Router();
const { createBooking, getMyBookings, getCourtBookings, cancelBooking } = require('../controllers/bookingController');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.post('/', auth, role('player'), createBooking);
router.get('/my', auth, role('player'), getMyBookings);
router.get('/court/:courtId', auth, role('owner'), getCourtBookings);
router.put('/:id/cancel', auth, role('player'), cancelBooking);

module.exports = router;
