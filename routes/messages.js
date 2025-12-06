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
const { processMediaUpload } = require('../controllers/mediaUpload');
const { validateMediaUpload } = require('../middleware/mediaUpload');
const advancedResults = require('../middleware/advancedResults');
const { checkMessageLimit } = require('../middleware/checkLimitations');

const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

router.route('/').get(getMessages).post(
  protect, 
  checkMessageLimit, 
  validateMediaUpload(['image', 'audio', 'video', 'document']),
  processMediaUpload,
  createMessage
);
router.route('/search').get(protect, searchMessages);
router.route('/conversations').post(protect, createConversationRoom).get(protect, getConversationRooms);

// Message management routes (must be before /:id route)
const {
  editMessage,
  deleteMessage as deleteMessageManagement,
  replyToMessage,
  forwardMessage,
  pinMessage,
  getMessageReplies
} = require('../controllers/messageManagement');
const {
  addReaction,
  removeReaction,
  getMessageReactions
} = require('../controllers/messageReactions');

router.route('/:id/reply').post(protect, replyToMessage);
router.route('/:id/forward').post(protect, forwardMessage);
router.route('/:id/pin').post(protect, pinMessage);
router.route('/:id/replies').get(protect, getMessageReplies);
router.route('/:id/reactions').get(protect, getMessageReactions).post(protect, addReaction);
router.route('/:id/reactions/:emoji').delete(protect, removeReaction);

router.route('/:id').get(getMessage).put(protect, editMessage).delete(protect, deleteMessageManagement);
router.route('/user/:userId').get(getUserMessages);
router.route('/senders/:userId').get(getUserSenders);
router.route('/conversation/:senderId/:receiverId').get(getConversation);
router.route('/from/:userId').get(getMessagesFromUser);

module.exports = router;
