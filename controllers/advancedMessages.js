const asyncHandler = require('../middleware/async');
const Message = require('../models/Message');
const Poll = require('../models/Poll');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const ErrorResponse = require('../utils/errorResponse');

// ========== MESSAGE CORRECTIONS (HelloTalk Style) ==========

/**
 * @desc    Add correction to a message
 * @route   POST /api/v1/messages/:id/correct
 * @access  Private
 */
exports.addCorrection = asyncHandler(async (req, res, next) => {
  const { correctedText, explanation } = req.body;
  const messageId = req.params.id;
  const correctorId = req.user._id;

  if (!correctedText) {
    return next(new ErrorResponse('Corrected text is required', 400));
  }

  const message = await Message.findById(messageId);

  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  // Can't correct your own message
  if (message.sender.toString() === correctorId.toString()) {
    return next(new ErrorResponse('Cannot correct your own message', 400));
  }

  // Check if conversation allows corrections
  const conversation = await Conversation.findOne({
    participants: { $all: [message.sender, correctorId] }
  });

  if (conversation && conversation.languageSettings && !conversation.languageSettings.enableCorrections) {
    return next(new ErrorResponse('Corrections are disabled for this conversation', 403));
  }

  // Add correction
  await message.addCorrection(
    correctorId,
    message.message,
    correctedText,
    explanation || ''
  );

  await message.populate('corrections.corrector', 'name images');

  // Notify message sender via socket
  const io = req.app.get('io');
  if (io) {
    io.to(`user_${message.sender}`).emit('messageCorrection', {
      messageId: message._id,
      correction: message.corrections[message.corrections.length - 1]
    });
  }

  res.status(200).json({
    success: true,
    data: message.corrections
  });
});

/**
 * @desc    Get corrections for a message
 * @route   GET /api/v1/messages/:id/corrections
 * @access  Private
 */
exports.getCorrections = asyncHandler(async (req, res, next) => {
  const message = await Message.findById(req.params.id)
    .populate('corrections.corrector', 'name images native_language');

  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  res.status(200).json({
    success: true,
    count: message.corrections.length,
    data: message.corrections
  });
});

/**
 * @desc    Accept a correction
 * @route   PUT /api/v1/messages/:id/corrections/:correctionId/accept
 * @access  Private
 */
exports.acceptCorrection = asyncHandler(async (req, res, next) => {
  const { id: messageId, correctionId } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(messageId);

  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  // Only message sender can accept corrections
  if (message.sender.toString() !== userId.toString()) {
    return next(new ErrorResponse('Only message sender can accept corrections', 403));
  }

  await message.acceptCorrection(correctionId);

  res.status(200).json({
    success: true,
    message: 'Correction accepted'
  });
});

// ========== MESSAGE TRANSLATION ==========

/**
 * @desc    Translate a message
 * @route   POST /api/v1/messages/:id/translate
 * @access  Private
 */
exports.translateMessage = asyncHandler(async (req, res, next) => {
  const { targetLanguage } = req.body;
  const messageId = req.params.id;

  if (!targetLanguage) {
    return next(new ErrorResponse('Target language is required', 400));
  }

  const message = await Message.findById(messageId);

  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  if (!message.message) {
    return next(new ErrorResponse('Message has no text to translate', 400));
  }

  // Check if translation already exists
  const existingTranslation = message.getTranslation(targetLanguage);
  if (existingTranslation) {
    return res.status(200).json({
      success: true,
      data: existingTranslation,
      cached: true
    });
  }

  // TODO: Integrate with translation API (Google Translate, DeepL, Papago)
  // For now, return a placeholder
  const translatedText = `[Translation to ${targetLanguage}]: ${message.message}`;

  await message.addTranslation(targetLanguage, translatedText, null);

  res.status(200).json({
    success: true,
    data: {
      language: targetLanguage,
      translatedText,
      translatedAt: new Date()
    },
    cached: false
  });
});

/**
 * @desc    Get translations for a message
 * @route   GET /api/v1/messages/:id/translations
 * @access  Private
 */
exports.getTranslations = asyncHandler(async (req, res, next) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  res.status(200).json({
    success: true,
    count: message.translations.length,
    data: message.translations
  });
});

// ========== DISAPPEARING MESSAGES ==========

/**
 * @desc    Send a self-destructing message
 * @route   POST /api/v1/messages/disappearing
 * @access  Private
 */
exports.sendDisappearingMessage = asyncHandler(async (req, res, next) => {
  const { message, receiver, destructTimer, expiresIn } = req.body;
  const senderId = req.user._id;

  if (!message || !receiver) {
    return next(new ErrorResponse('Message and receiver are required', 400));
  }

  const messageData = {
    sender: senderId,
    receiver,
    message,
    selfDestruct: {
      enabled: true,
      destructAfterRead: destructTimer > 0,
      destructTimer: destructTimer || 0
    }
  };

  // Set time-based expiration
  if (expiresIn) {
    messageData.selfDestruct.expiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  const newMessage = await Message.create(messageData);

  await newMessage.populate('sender', 'name images');
  await newMessage.populate('receiver', 'name images');

  // Notify receiver
  const io = req.app.get('io');
  if (io) {
    io.to(`user_${receiver}`).emit('newDisappearingMessage', {
      message: newMessage,
      destructTimer: destructTimer || 0
    });
  }

  res.status(201).json({
    success: true,
    data: newMessage
  });
});

/**
 * @desc    Trigger self-destruct after reading
 * @route   POST /api/v1/messages/:id/trigger-destruct
 * @access  Private
 */
exports.triggerDestruct = asyncHandler(async (req, res, next) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  // Only receiver can trigger
  if (message.receiver.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }

  await message.triggerSelfDestruct();

  res.status(200).json({
    success: true,
    destructAt: message.selfDestruct.destructAt
  });
});

// ========== POLLS ==========

/**
 * @desc    Create a poll in conversation
 * @route   POST /api/v1/messages/poll
 * @access  Private
 */
exports.createPoll = asyncHandler(async (req, res, next) => {
  const {
    conversationId,
    question,
    options,
    settings,
    expiresIn
  } = req.body;
  const creatorId = req.user._id;

  if (!conversationId || !question || !options || options.length < 2) {
    return next(new ErrorResponse('Conversation ID, question, and at least 2 options are required', 400));
  }

  if (options.length > 10) {
    return next(new ErrorResponse('Maximum 10 options allowed', 400));
  }

  // Check if user is part of conversation
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  if (!conversation.participants.some(p => p.toString() === creatorId.toString())) {
    return next(new ErrorResponse('Not a participant of this conversation', 403));
  }

  // Get receiver (for direct message)
  const receiver = conversation.participants.find(p => p.toString() !== creatorId.toString());

  const pollData = {
    conversation: conversationId,
    creator: creatorId,
    question,
    options: options.map(text => ({
      text,
      votes: [],
      voteCount: 0
    })),
    settings: settings || {}
  };

  if (expiresIn) {
    pollData.expiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  const messageData = {
    sender: creatorId,
    receiver,
    message: `📊 Poll: ${question}`,
    messageType: 'poll'
  };

  const { poll, message } = await Poll.createWithMessage(pollData, messageData);

  await poll.populate('creator', 'name images');

  // Notify conversation participants
  const io = req.app.get('io');
  if (io) {
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== creatorId.toString()) {
        io.to(`user_${participantId}`).emit('newPoll', {
          poll,
          message,
          conversationId
        });
      }
    });
  }

  res.status(201).json({
    success: true,
    data: { poll, message }
  });
});

/**
 * @desc    Vote on a poll
 * @route   POST /api/v1/messages/poll/:pollId/vote
 * @access  Private
 */
exports.votePoll = asyncHandler(async (req, res, next) => {
  const { optionIndex } = req.body;
  const pollId = req.params.pollId;
  const userId = req.user._id;

  if (optionIndex === undefined) {
    return next(new ErrorResponse('Option index is required', 400));
  }

  const poll = await Poll.findById(pollId);

  if (!poll) {
    return next(new ErrorResponse('Poll not found', 404));
  }

  // Check if user is part of conversation
  const conversation = await Conversation.findById(poll.conversation);
  if (!conversation.participants.some(p => p.toString() === userId.toString())) {
    return next(new ErrorResponse('Not authorized to vote on this poll', 403));
  }

  try {
    await poll.vote(userId, optionIndex);
  } catch (error) {
    return next(new ErrorResponse(error.message, 400));
  }

  const results = poll.getResults(userId);

  // Notify other participants
  const io = req.app.get('io');
  if (io) {
    conversation.participants.forEach(participantId => {
      io.to(`user_${participantId}`).emit('pollVoteUpdate', {
        pollId,
        results,
        voterId: poll.settings.isAnonymous ? null : userId
      });
    });
  }

  res.status(200).json({
    success: true,
    data: results
  });
});

/**
 * @desc    Get poll results
 * @route   GET /api/v1/messages/poll/:pollId
 * @access  Private
 */
exports.getPollResults = asyncHandler(async (req, res, next) => {
  const poll = await Poll.findById(req.params.pollId)
    .populate('creator', 'name images')
    .populate('options.votes.user', 'name images');

  if (!poll) {
    return next(new ErrorResponse('Poll not found', 404));
  }

  const results = poll.getResults(req.user._id);
  results.hasVoted = poll.hasVoted(req.user._id);
  results.userVotes = poll.getUserVotes(req.user._id);
  results.creator = poll.creator;

  res.status(200).json({
    success: true,
    data: results
  });
});

/**
 * @desc    Close a poll
 * @route   POST /api/v1/messages/poll/:pollId/close
 * @access  Private
 */
exports.closePoll = asyncHandler(async (req, res, next) => {
  const poll = await Poll.findById(req.params.pollId);

  if (!poll) {
    return next(new ErrorResponse('Poll not found', 404));
  }

  // Only creator can close
  if (poll.creator.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Only poll creator can close the poll', 403));
  }

  try {
    await poll.close(req.user._id);
  } catch (error) {
    return next(new ErrorResponse(error.message, 400));
  }

  // Notify participants
  const io = req.app.get('io');
  if (io) {
    const conversation = await Conversation.findById(poll.conversation);
    conversation.participants.forEach(participantId => {
      io.to(`user_${participantId}`).emit('pollClosed', {
        pollId: poll._id,
        results: poll.getResults(req.user._id)
      });
    });
  }

  res.status(200).json({
    success: true,
    message: 'Poll closed',
    data: poll.getResults(req.user._id)
  });
});

// ========== VOICE MESSAGES ==========

/**
 * @desc    Send voice message with waveform data
 * @route   POST /api/v1/messages/voice
 * @access  Private
 */
exports.sendVoiceMessage = asyncHandler(async (req, res, next) => {
  const { receiver, duration, waveform } = req.body;
  const senderId = req.user._id;

  if (!receiver || !req.file) {
    return next(new ErrorResponse('Receiver and voice file are required', 400));
  }

  const messageData = {
    sender: senderId,
    receiver,
    messageType: 'voice',
    media: {
      url: req.file.location,
      type: 'voice',
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      duration: duration || 0,
      waveform: waveform || []
    }
  };

  const message = await Message.create(messageData);

  await message.populate('sender', 'name images');
  await message.populate('receiver', 'name images');

  // Notify receiver
  const io = req.app.get('io');
  if (io) {
    io.to(`user_${receiver}`).emit('newVoiceMessage', {
      message
    });
  }

  res.status(201).json({
    success: true,
    data: message
  });
});

// ========== MENTIONS ==========

/**
 * @desc    Get messages where user is mentioned
 * @route   GET /api/v1/messages/mentions
 * @access  Private
 */
exports.getMentions = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const messages = await Message.find({
    'mentions.user': userId
  })
    .populate('sender', 'name images')
    .populate('receiver', 'name images')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Message.countDocuments({ 'mentions.user': userId });

  res.status(200).json({
    success: true,
    count: messages.length,
    total,
    pages: Math.ceil(total / limit),
    data: messages
  });
});

// ========== BOOKMARKS ==========

/**
 * @desc    Bookmark a message
 * @route   POST /api/v1/messages/:id/bookmark
 * @access  Private
 */
exports.bookmarkMessage = asyncHandler(async (req, res, next) => {
  const messageId = req.params.id;
  const userId = req.user._id;

  const message = await Message.findById(messageId);

  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  // Add to user's bookmarks
  const user = await User.findById(userId);
  
  if (!user.bookmarkedMessages) {
    user.bookmarkedMessages = [];
  }

  const alreadyBookmarked = user.bookmarkedMessages.some(
    b => b.message.toString() === messageId
  );

  if (alreadyBookmarked) {
    return next(new ErrorResponse('Message already bookmarked', 400));
  }

  user.bookmarkedMessages.push({
    message: messageId,
    bookmarkedAt: new Date()
  });

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Message bookmarked'
  });
});

/**
 * @desc    Remove bookmark
 * @route   DELETE /api/v1/messages/:id/bookmark
 * @access  Private
 */
exports.removeBookmark = asyncHandler(async (req, res, next) => {
  const messageId = req.params.id;
  const userId = req.user._id;

  const user = await User.findById(userId);
  
  if (!user.bookmarkedMessages) {
    return next(new ErrorResponse('No bookmarks found', 404));
  }

  user.bookmarkedMessages = user.bookmarkedMessages.filter(
    b => b.message.toString() !== messageId
  );

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Bookmark removed'
  });
});

/**
 * @desc    Get bookmarked messages
 * @route   GET /api/v1/messages/bookmarks
 * @access  Private
 */
exports.getBookmarks = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const user = await User.findById(userId)
    .populate({
      path: 'bookmarkedMessages.message',
      populate: [
        { path: 'sender', select: 'name images' },
        { path: 'receiver', select: 'name images' }
      ]
    });

  const bookmarks = user.bookmarkedMessages || [];
  const start = (page - 1) * limit;
  const paginatedBookmarks = bookmarks.slice(start, start + limit);

  res.status(200).json({
    success: true,
    count: paginatedBookmarks.length,
    total: bookmarks.length,
    pages: Math.ceil(bookmarks.length / limit),
    data: paginatedBookmarks
  });
});

// ========== CONVERSATION FEATURES ==========

/**
 * @desc    Set conversation theme
 * @route   PUT /api/v1/conversations/:id/theme
 * @access  Private
 */
exports.setConversationTheme = asyncHandler(async (req, res, next) => {
  const { theme } = req.body;
  const conversationId = req.params.id;
  const userId = req.user._id;

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  if (!conversation.participants.some(p => p.toString() === userId.toString())) {
    return next(new ErrorResponse('Not a participant', 403));
  }

  await conversation.setUserTheme(userId, theme);

  res.status(200).json({
    success: true,
    data: conversation.getUserTheme(userId)
  });
});

/**
 * @desc    Set nickname for user in conversation
 * @route   PUT /api/v1/conversations/:id/nickname
 * @access  Private
 */
exports.setNickname = asyncHandler(async (req, res, next) => {
  const { targetUserId, nickname } = req.body;
  const conversationId = req.params.id;
  const userId = req.user._id;

  if (!targetUserId || !nickname) {
    return next(new ErrorResponse('Target user and nickname are required', 400));
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  if (!conversation.participants.some(p => p.toString() === userId.toString())) {
    return next(new ErrorResponse('Not a participant', 403));
  }

  await conversation.setNickname(targetUserId, nickname, userId);

  res.status(200).json({
    success: true,
    message: 'Nickname set',
    data: { userId: targetUserId, nickname }
  });
});

/**
 * @desc    Enable secret chat mode
 * @route   POST /api/v1/conversations/:id/secret
 * @access  Private
 */
exports.enableSecretChat = asyncHandler(async (req, res, next) => {
  const { destructTimer, preventScreenshots } = req.body;
  const conversationId = req.params.id;
  const userId = req.user._id;

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  if (!conversation.participants.some(p => p.toString() === userId.toString())) {
    return next(new ErrorResponse('Not a participant', 403));
  }

  await conversation.enableSecretChat({
    destructTimer: destructTimer || 0,
    preventScreenshots: preventScreenshots !== false
  });

  // Notify other participants
  const io = req.app.get('io');
  if (io) {
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== userId.toString()) {
        io.to(`user_${participantId}`).emit('secretChatEnabled', {
          conversationId,
          settings: conversation.secretChatSettings
        });
      }
    });
  }

  res.status(200).json({
    success: true,
    message: 'Secret chat enabled',
    data: conversation.secretChatSettings
  });
});

/**
 * @desc    Add quick reply template
 * @route   POST /api/v1/conversations/:id/quick-replies
 * @access  Private
 */
exports.addQuickReply = asyncHandler(async (req, res, next) => {
  const { text } = req.body;
  const conversationId = req.params.id;
  const userId = req.user._id;

  if (!text) {
    return next(new ErrorResponse('Quick reply text is required', 400));
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  await conversation.addQuickReply(text, userId);

  res.status(201).json({
    success: true,
    data: conversation.quickReplies
  });
});

/**
 * @desc    Get quick replies for conversation
 * @route   GET /api/v1/conversations/:id/quick-replies
 * @access  Private
 */
exports.getQuickReplies = asyncHandler(async (req, res, next) => {
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  res.status(200).json({
    success: true,
    data: conversation.quickReplies || []
  });
});

