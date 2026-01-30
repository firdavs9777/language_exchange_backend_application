const express = require('express');
const Message = require('../models/Message');
const {
  getMessages,
  createMessage,
  updateMessage,
  deleteMessage,
  getMessage,
  getUserMessages,
  getUserSenders,
  getMessagesFromUser,
  getConversation,
  createConversationRoom,
  getConversationRooms
} = require('../controllers/messages');
const { searchMessages } = require('../controllers/messageSearch');
const advancedResults = require('../middleware/advancedResults');
const { checkMessageLimit } = require('../middleware/checkLimitations');
const { uploadSingle } = require('../middleware/uploadToSpaces');
const { uploadSingleVideo, generateThumbnail } = require('../middleware/uploadVideoToSpaces');

// Advanced message features controller
const advancedMessages = require('../controllers/advancedMessages');

const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { searchLimiter } = require('../middleware/rateLimiter');

// ========== BASIC MESSAGE ROUTES ==========
router.route('/').get(protect, getMessages).post(
  protect, 
  checkMessageLimit, 
  uploadSingle('attachment', 'bananatalk/messages'),
  createMessage
);
router.route('/search').get(protect, searchLimiter, searchMessages);
router.route('/conversations').post(protect, createConversationRoom).get(protect, getConversationRooms);

// ========== ADVANCED FEATURES (HelloTalk/KakaoTalk Style) ==========

// Video/Voice config (public endpoint for frontend validation)
router.route('/video-config').get(advancedMessages.getVideoMessageConfig);

// Video messages (Instagram-style, max 3 minutes with thumbnail)
router.route('/video').post(
  protect,
  checkMessageLimit,
  uploadSingleVideo('video', 'bananatalk/messages/videos'),
  generateThumbnail,
  advancedMessages.sendVideoMessage
);

// Voice messages
router.route('/voice').post(
  protect,
  checkMessageLimit,
  uploadSingle('voice', 'bananatalk/voice'),
  advancedMessages.sendVoiceMessage
);

// Disappearing messages
router.route('/disappearing').post(protect, checkMessageLimit, advancedMessages.sendDisappearingMessage);

// Polls
router.route('/poll').post(protect, advancedMessages.createPoll);
router.route('/poll/:pollId').get(protect, advancedMessages.getPollResults);
router.route('/poll/:pollId/vote').post(protect, advancedMessages.votePoll);
router.route('/poll/:pollId/close').post(protect, advancedMessages.closePoll);

// Mentions
router.route('/mentions').get(protect, advancedMessages.getMentions);

// Bookmarks
router.route('/bookmarks').get(protect, advancedMessages.getBookmarks);

// ========== MESSAGE MANAGEMENT ROUTES ==========
const messageManagement = require('../controllers/messageManagement');
const messageReactions = require('../controllers/messageReactions');

router.route('/:id/reply').post(protect, messageManagement.replyToMessage);
router.route('/:id/forward').post(protect, messageManagement.forwardMessage);
router.route('/:id/pin').post(protect, messageManagement.pinMessage);
router.route('/:id/replies').get(protect, messageManagement.getMessageReplies);
router.route('/:id/reactions').get(protect, messageReactions.getMessageReactions).post(protect, messageReactions.addReaction);
router.route('/:id/reactions/:emoji').delete(protect, messageReactions.removeReaction);

// Message corrections (HelloTalk style)
router.route('/:id/correct').post(protect, advancedMessages.addCorrection);
router.route('/:id/corrections').get(protect, advancedMessages.getCorrections);
router.route('/:id/corrections/:correctionId/accept').put(protect, advancedMessages.acceptCorrection);

// Translations
router.route('/:id/translate').post(protect, advancedMessages.translateMessage);
router.route('/:id/translations').get(protect, advancedMessages.getTranslations);

// Bookmarks per message
router.route('/:id/bookmark').post(protect, advancedMessages.bookmarkMessage).delete(protect, advancedMessages.removeBookmark);

// Self-destruct trigger
router.route('/:id/trigger-destruct').post(protect, advancedMessages.triggerDestruct);

// ========== BASIC ID ROUTES (must be last) ==========
router.route('/:id').get(protect, getMessage).put(protect, messageManagement.editMessage).delete(protect, messageManagement.deleteMessage);
router.route('/user/:userId').get(protect, getUserMessages);
router.route('/senders/:userId').get(protect, getUserSenders);
router.route('/conversation/:senderId/:receiverId').get(protect, getConversation);
router.route('/from/:userId').get(protect, getMessagesFromUser);

module.exports = router;
