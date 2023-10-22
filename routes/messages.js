const express = require('express');
const Message = require('../models/Message');
const {
  getMessages,
  createMessage,
  updateMessage,
  deleteMessage,
  getMessage
} = require('../controllers/messages');
const advancedResults = require('../middleware/advancedResults');

const router = express.Router();
// const { protect, authorize } = require('../middleware/auth');

router.route('/').get(getMessages).post(createMessage);
router.route('/:id').get(getMessage).put(updateMessage).delete(deleteMessage);
module.exports = router;
