const express = require('express');
const router = express.Router();
const { reverse, forward } = require('../controllers/geocode');
router.get('/reverse', reverse);
router.get('/forward', forward);
module.exports = router;
