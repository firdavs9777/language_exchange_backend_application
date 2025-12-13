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
const advancedMessages = require('../controllers/advancedMessages');
const { protect } = require('../middleware/auth');
const router = express.Router();

// All routes require authentication
router.use(protect);

// ========== BASIC CONVERSATION ROUTES ==========
router.route('/').get(getConversations);
router.route('/:id').get(getConversation);
router.route('/:id/mute').post(muteConversation);
router.route('/:id/unmute').post(unmuteConversation);
router.route('/:id/archive').post(archiveConversation);
router.route('/:id/unarchive').post(unarchiveConversation);
router.route('/:id/pin').post(pinConversation);
router.route('/:id/unpin').post(unpinConversation);
router.route('/:id/read').put(markConversationAsRead);

// ========== ADVANCED FEATURES (KakaoTalk/HelloTalk Style) ==========

// Theme customization
router.route('/:id/theme').put(advancedMessages.setConversationTheme);

// Nicknames
router.route('/:id/nickname').put(advancedMessages.setNickname);

// Secret chat
router.route('/:id/secret').post(advancedMessages.enableSecretChat);

// Quick replies
router.route('/:id/quick-replies')
  .get(advancedMessages.getQuickReplies)
  .post(advancedMessages.addQuickReply);

module.exports = router;

