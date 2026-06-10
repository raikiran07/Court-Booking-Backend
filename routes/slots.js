const express = require('express');
const router = express.Router();
const { getSlots, createSlots, deleteSlot } = require('../controllers/slotController');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/court/:courtId', getSlots);
router.post('/court/:courtId', auth, role('owner'), createSlots);
router.delete('/:slotId', auth, role('owner'), deleteSlot);

module.exports = router;
