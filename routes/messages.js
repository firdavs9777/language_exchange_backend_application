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
const { uploadSingle } = require('../middleware/uploadToSpaces');

const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

router.route('/').get(getMessages).post(
  protect, 
  checkMessageLimit, 
  uploadSingle('attachment', 'bananatalk/messages'),
  createMessage
);
router.route('/search').get(protect, searchMessages);
router.route('/conversations').post(protect, createConversationRoom).get(protect, getConversationRooms);

// Message management routes (must be before /:id route)
const messageManagement = require('../controllers/messageManagement');
const messageReactions = require('../controllers/messageReactions');

router.route('/:id/reply').post(protect, messageManagement.replyToMessage);
router.route('/:id/forward').post(protect, messageManagement.forwardMessage);
router.route('/:id/pin').post(protect, messageManagement.pinMessage);
router.route('/:id/replies').get(protect, messageManagement.getMessageReplies);
router.route('/:id/reactions').get(protect, messageReactions.getMessageReactions).post(protect, messageReactions.addReaction);
router.route('/:id/reactions/:emoji').delete(protect, messageReactions.removeReaction);

router.route('/:id').get(getMessage).put(protect, messageManagement.editMessage).delete(protect, messageManagement.deleteMessage);
router.route('/user/:userId').get(getUserMessages);
router.route('/senders/:userId').get(getUserSenders);
router.route('/conversation/:senderId/:receiverId').get(getConversation);
router.route('/from/:userId').get(getMessagesFromUser);

module.exports = router;
