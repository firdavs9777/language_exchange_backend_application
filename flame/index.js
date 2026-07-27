const express = require('express');
const corsMiddleware = require('./middleware/cors');
const errorMiddleware = require('./middleware/error');
const asyncHandler = require('./middleware/asyncHandler');
const { getConn } = require('./db');

const router = express.Router();

router.use(corsMiddleware);
router.use(express.json({ limit: '5mb' }));

// Flame health check (different from BananaTalk's /health)
router.get('/health', asyncHandler(async (_req, res) => {
  let dbStatus = 'unknown';
  try {
    const conn = getConn();
    dbStatus = conn.readyState === 1 ? 'connected' : 'disconnected';
  } catch {
    dbStatus = 'uninitialized';
  }
  res.json({ success: true, data: { service: 'flame', dbStatus, ts: new Date().toISOString() } });
}));

// Routes mounted in later tasks:
router.use('/auth', require('./routes/auth'));
router.use('/users', require('./routes/users'));
router.use('/stories', require('./routes/stories'));
router.use('/discover', require('./routes/discovery'));
router.use('/swipes', require('./routes/swipes'));
router.use('/matches', require('./routes/matches'));
router.use('/conversations', require('./routes/conversations'));
router.use('/messages', require('./routes/messages'));
router.use('/billing', require('./routes/billing'));
router.use('/notifications', require('./routes/notifications'));

// Error middleware MUST be last so it catches everything in this sub-app
router.use(errorMiddleware);

module.exports = router;
