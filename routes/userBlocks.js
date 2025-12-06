const express = require('express');
const {
  blockUser,
  unblockUser,
  getBlockedUsers,
  checkBlockStatus
} = require('../controllers/userBlocks');
const { protect } = require('../middleware/auth');
const router = express.Router();

// All routes require authentication
router.use(protect);

router.post('/:userId/block', blockUser);
router.delete('/:userId/block', unblockUser);
router.get('/:userId/blocked', getBlockedUsers);
router.get('/:userId/block-status/:targetUserId', checkBlockStatus);

module.exports = router;

