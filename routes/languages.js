const express = require('express');
const Language = require('../models/Language');
const { getLanguages,} = require('../controllers/languages');
const advancedResults = require('../middleware/advancedResults');

const router = express.Router();
// const { protect, authorize } = require('../middleware/auth');

router.route('/').get(getLanguages)
module.exports = router;
