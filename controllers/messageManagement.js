const asyncHandler = require('../middleware/async');
const Message = require('../models/Message');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { deleteMediaFile } = require('./mediaUpload');

/**
 * @desc    Edit a message
 * @route   PUT /api/v1/messages/:id
 * @access  Private
 */
exports.editMessage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { message } = req.body;
  const userId = req.user._id;

  if (!message || message.trim().length === 0) {
    return next(new ErrorResponse('Message content is required', 400));
  }

  if (message.length > 2000) {
    return next(new ErrorResponse('Message cannot exceed 2000 characters', 400));
  }

  const msg = await Message.findById(id);

  if (!msg) {
    return next(new ErrorResponse('Message not found', 404));
  }

  // Only sender can edit
  if (msg.sender.toString() !== userId.toString()) {
    return next(new ErrorResponse('Not authorized to edit this message', 403));
  }

  // Can only edit within 15 minutes
  const editTimeLimit = 15 * 60 * 1000; // 15 minutes
  const timeSinceCreation = Date.now() - msg.createdAt.getTime();
  
  if (timeSinceCreation > editTimeLimit) {
    return next(new ErrorResponse('Message can only be edited within 15 minutes', 400));
  }

  // Can't edit deleted messages
  if (msg.isDeleted) {
    return next(new ErrorResponse('Cannot edit deleted message', 400));
  }

  // Update message
  msg.message = message.trim();
  msg.isEdited = true;
  msg.editedAt = new Date();
  await msg.save();

  res.status(200).json({
    success: true,
    message: 'Message edited successfully',
    data: msg
  });
});

/**
 * @desc    Delete a message
 * @route   DELETE /api/v1/messages/:id
 * @access  Private
 */
exports.deleteMessage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { deleteForEveryone } = req.body; // true for "delete for everyone", false for "delete for me"
  const userId = req.user._id;

  const msg = await Message.findById(id);

  if (!msg) {
    return next(new ErrorResponse('Message not found', 404));
  }

  // Only sender can delete
  if (msg.sender.toString() !== userId.toString()) {
    return next(new ErrorResponse('Not authorized to delete this message', 403));
  }

  if (deleteForEveryone) {
    // Delete for everyone - only within 1 hour
    const deleteTimeLimit = 60 * 60 * 1000; // 1 hour
    const timeSinceCreation = Date.now() - msg.createdAt.getTime();
    
    if (timeSinceCreation > deleteTimeLimit) {
      return next(new ErrorResponse('Message can only be deleted for everyone within 1 hour', 400));
    }

    // Soft delete - mark as deleted
    msg.isDeleted = true;
    msg.deletedAt = new Date();
    msg.deletedFor = [msg.sender, msg.receiver];
    msg.message = 'This message was deleted';
    
    // Delete media files
    if (msg.media && msg.media.url) {
      await deleteMediaFile(msg.media.url);
    }
    
    await msg.save();
  } else {
    // Delete for me - add to deletedFor array
    if (!msg.deletedFor) {
      msg.deletedFor = [];
    }
    
    if (!msg.deletedFor.includes(userId)) {
      msg.deletedFor.push(userId);
    }
    
    await msg.save();
  }

  res.status(200).json({
    success: true,
    message: deleteForEveryone ? 'Message deleted for everyone' : 'Message deleted for you',
    data: {}
  });
});

/**
 * @desc    Reply to a message
 * @route   POST /api/v1/messages/:id/reply
 * @access  Private
 */
exports.replyToMessage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { message, receiver } = req.body;
  const userId = req.user._id;

  if (!message || !receiver) {
    return next(new ErrorResponse('Message content and receiver are required', 400));
  }

  const originalMessage = await Message.findById(id);

  if (!originalMessage) {
    return next(new ErrorResponse('Original message not found', 404));
  }

  // Check if user can send message (use existing createMessage logic)
  const senderUser = await User.findById(userId);
  if (!senderUser) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check block status
  if (senderUser.isBlocked(receiver) || senderUser.isBlockedBy(receiver)) {
    return next(new ErrorResponse('Cannot send message to this user', 403));
  }

  // Check message limit
  const canSend = await senderUser.canSendMessage();
  if (!canSend) {
    const LIMITS = require('../config/limitations');
    let current = 0;
    let max = 0;
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(24, 0, 0, 0);

    if (senderUser.userMode === 'regular') {
      current = senderUser.regularUserLimitations.messagesSentToday || 0;
      max = LIMITS.regular.messagesPerDay;
    } else if (senderUser.userMode === 'visitor') {
      current = senderUser.visitorLimitations.messagesSent || 0;
      max = LIMITS.visitor.messagesPerDay;
    }

    const { formatLimitError } = require('../utils/limitations');
    return next(formatLimitError('messages', current, max, nextReset));
  }

  // Create reply message
  const replyMessage = await Message.create({
    message: message.trim(),
    sender: userId,
    receiver: receiver,
    replyTo: id
  });

  // Increment message count
  await senderUser.incrementMessageCount();

  // Populate reply information
  await replyMessage.populate('replyTo', 'message sender');
  await replyMessage.populate('sender', 'name images');
  await replyMessage.populate('receiver', 'name images');

  res.status(201).json({
    success: true,
    message: 'Reply sent successfully',
    data: replyMessage
  });
});

/**
 * @desc    Forward a message
 * @route   POST /api/v1/messages/:id/forward
 * @access  Private
 */
exports.forwardMessage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { receivers } = req.body; // Array of user IDs
  const userId = req.user._id;

  if (!receivers || !Array.isArray(receivers) || receivers.length === 0) {
    return next(new ErrorResponse('Receivers array is required', 400));
  }

  const originalMessage = await Message.findById(id)
    .populate('sender', 'name');

  if (!originalMessage) {
    return next(new ErrorResponse('Original message not found', 404));
  }

  const senderUser = await User.findById(userId);
  if (!senderUser) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check message limit for each receiver
  const canSend = await senderUser.canSendMessage();
  if (!canSend) {
    const LIMITS = require('../config/limitations');
    let current = 0;
    let max = 0;
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(24, 0, 0, 0);

    if (senderUser.userMode === 'regular') {
      current = senderUser.regularUserLimitations.messagesSentToday || 0;
      max = LIMITS.regular.messagesPerDay;
    } else if (senderUser.userMode === 'visitor') {
      current = senderUser.visitorLimitations.messagesSent || 0;
      max = LIMITS.visitor.messagesPerDay;
    }

    const { formatLimitError } = require('../utils/limitations');
    return next(formatLimitError('messages', current, max, nextReset));
  }

  // Forward to each receiver
  const forwardedMessages = [];
  const errors = [];

  for (const receiverId of receivers) {
    // Check block status
    if (senderUser.isBlocked(receiverId) || senderUser.isBlockedBy(receiverId)) {
      errors.push({ receiverId, error: 'User is blocked' });
      continue;
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      errors.push({ receiverId, error: 'Receiver not found' });
      continue;
    }

    // Create forwarded message
    const forwardedMessage = await Message.create({
      message: originalMessage.message,
      sender: userId,
      receiver: receiverId,
      isForwarded: true,
      forwardedFrom: {
        sender: originalMessage.sender._id,
        messageId: id,
        originalMessage: originalMessage.message
      },
      media: originalMessage.media || null
    });

    forwardedMessages.push(forwardedMessage);
  }

  // Increment message count (once per forward action, not per receiver)
  await senderUser.incrementMessageCount();

  res.status(200).json({
    success: true,
    message: `Message forwarded to ${forwardedMessages.length} recipient(s)`,
    data: {
      forwarded: forwardedMessages.length,
      errors: errors.length > 0 ? errors : undefined
    }
  });
});

/**
 * @desc    Pin/unpin a message
 * @route   POST /api/v1/messages/:id/pin
 * @access  Private
 */
exports.pinMessage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const msg = await Message.findById(id);

  if (!msg) {
    return next(new ErrorResponse('Message not found', 404));
  }

  // Only participants can pin
  const isParticipant = msg.sender.toString() === userId.toString() || 
                        msg.receiver.toString() === userId.toString();

  if (!isParticipant) {
    return next(new ErrorResponse('Not authorized to pin this message', 403));
  }

  // Toggle pin status
  msg.pinned = !msg.pinned;
  if (msg.pinned) {
    msg.pinnedAt = new Date();
    msg.pinnedBy = userId;
  } else {
    msg.pinnedAt = null;
    msg.pinnedBy = null;
  }

  await msg.save();

  res.status(200).json({
    success: true,
    message: msg.pinned ? 'Message pinned' : 'Message unpinned',
    data: msg
  });
});

/**
 * @desc    Get replies to a message
 * @route   GET /api/v1/messages/:id/replies
 * @access  Private
 */
exports.getMessageReplies = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const message = await Message.findById(id);

  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  const replies = await Message.find({ replyTo: id })
    .populate('sender', 'name images')
    .populate('receiver', 'name images')
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const totalReplies = await Message.countDocuments({ replyTo: id });

  res.status(200).json({
    success: true,
    count: replies.length,
    total: totalReplies,
    data: replies
  });
});

