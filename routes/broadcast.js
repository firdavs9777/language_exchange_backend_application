/**
 * Broadcast Notification Routes
 *
 * Admin-only endpoints for sending announcements to all users
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  sendBroadcast,
  getBroadcastStats
} = require('../controllers/broadcastController');

// All routes require authentication and admin role
router.use(protect, authorize('admin'));

/**
 * @route   POST /api/v1/admin/broadcast
 * @desc    Send broadcast notification to all users
 * @access  Admin
 * @body    { title, body, imageUrl? }
 */
router.post('/', sendBroadcast);

/**
 * @route   GET /api/v1/admin/broadcast/stats
 * @desc    Get broadcast statistics
 * @access  Admin
 */
router.get('/stats', getBroadcastStats);

module.exports = router;
