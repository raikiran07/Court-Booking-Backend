const express = require('express');
const router = express.Router();
const { signUpload } = require('../controllers/uploadController');
const auth = require('../middleware/auth');

// Only authenticated users (owner or player) can request a signature
router.post('/sign', auth, signUpload);

module.exports = router;
