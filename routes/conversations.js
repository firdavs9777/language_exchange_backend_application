const express = require('express');
const {
  getConversations,
  getConversation,
  muteConversation,
  unmuteConversation,
  archiveConversation,
  unarchiveConversation,
  pinConversation,
  unpinConversation,
  markConversationAsRead
} = require('../controllers/conversations');
const { protect } = require('../middleware/auth');
const router = express.Router();

// All routes require authentication
router.use(protect);

router.route('/').get(getConversations);
router.route('/:id').get(getConversation);
router.route('/:id/mute').post(muteConversation);
router.route('/:id/unmute').post(unmuteConversation);
router.route('/:id/archive').post(archiveConversation);
router.route('/:id/unarchive').post(unarchiveConversation);
router.route('/:id/pin').post(pinConversation);
router.route('/:id/unpin').post(unpinConversation);
router.route('/:id/read').put(markConversationAsRead);

module.exports = router;

