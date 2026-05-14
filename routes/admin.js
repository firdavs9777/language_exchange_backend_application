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
} = require('../controllers/admin');

// Every endpoint in this file requires an authenticated admin.
router.use(protect);
router.use(authorize('admin'));

router.get('/users', searchUsers);
router.get('/users/:id', getUserDetail);
router.post('/users/:id/ban', banUser);
router.post('/users/:id/unban', unbanUser);
router.put('/users/:id/role', changeRole);

router.get('/audit-log', getAuditLog);

module.exports = router;
