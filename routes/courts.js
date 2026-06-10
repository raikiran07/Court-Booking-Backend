const express = require('express');
const router = express.Router();
const { getCourts, getCourt, createCourt, updateCourt, deleteCourt } = require('../controllers/courtController');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/', getCourts);
router.get('/:id', getCourt);
router.post('/', auth, role('owner'), createCourt);
router.put('/:id', auth, role('owner'), updateCourt);
router.delete('/:id', auth, role('owner'), deleteCourt);

module.exports = router;
