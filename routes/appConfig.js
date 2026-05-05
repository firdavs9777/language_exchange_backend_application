const express = require('express');
const { getAppConfig } = require('../controllers/appConfig');

const router = express.Router();

router.route('/').get(getAppConfig);

module.exports = router;
