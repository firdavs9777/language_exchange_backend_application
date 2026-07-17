// routes/og.js
//
// Public OG/link-preview endpoint for crawlers. Mounted OUTSIDE /api/v1
// in server.js (no auth, no /api/v1 rate limiter) so social/chat-app link
// unfurlers can hit it directly: GET /og/:type/:id
const express = require('express');
const router = express.Router();
const { getOg } = require('../controllers/og');

router.route('/:type/:id').get(getOg);

module.exports = router;
