const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  searchUsers,
  getUserDetail,
  banUser,
  unbanUser,
  changeRole,
  getAuditLog,
  getStats,
  getAIUsage,
  getAIUsageLogs,
  getActivity,
  getBannedUsers,
  hardDeleteUser,
} = require('../controllers/admin');

// Every endpoint in this file requires an authenticated admin.
router.use(protect);
router.use(authorize('admin'));

router.get('/users', searchUsers);
router.get('/users/:id', getUserDetail);
router.post('/users/:id/ban', banUser);
router.post('/users/:id/unban', unbanUser);
router.put('/users/:id/role', changeRole);
router.get('/banned-users', getBannedUsers);
router.delete('/users/:id', hardDeleteUser);

router.get('/audit-log', getAuditLog);
router.get('/stats', getStats);
router.get('/activity', getActivity);
router.get('/ai-usage/logs', getAIUsageLogs);
router.get('/ai-usage', getAIUsage);

module.exports = router;
