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
  getConversation
} = require('../controllers/messages');
const advancedResults = require('../middleware/advancedResults');

const router = express.Router();
// const { protect, authorize } = require('../middleware/auth');

router.route('/').get(getMessages).post(createMessage);
router.route('/:id').get(getMessage).put(updateMessage).delete(deleteMessage);
router.route('/user/:userId').get(getUserMessages);
router.route('/senders/:userId').get(getUserSenders);
router.route('/conversation/:senderId/:receiverId').get(getConversation);
router.route('/from/:userId').get(getMessagesFromUser);

module.exports = router;
