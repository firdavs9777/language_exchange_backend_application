const asyncHandler = require('../middleware/async');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Get all conversations for a user
 * @route   GET /api/v1/conversations
 * @access  Private
 */
exports.getConversations = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { archived, muted, pinned } = req.query;

  let query = {
    participants: userId
  };

  // Filter by archived
  if (archived === 'true') {
    query.archivedBy = userId;
  } else if (archived === 'false') {
    query.archivedBy = { $ne: userId };
  }

  // Filter by muted
  if (muted === 'true') {
    query['mutedBy.user'] = userId;
  } else if (muted === 'false') {
    query['mutedBy.user'] = { $ne: userId };
  }

  // Filter by pinned
  if (pinned === 'true') {
    query['pinnedBy.user'] = userId;
  } else if (pinned === 'false') {
    query['pinnedBy.user'] = { $ne: userId };
  }

  const conversations = await Conversation.find(query)
    .populate('participants', 'name images email')
    .populate('lastMessage')
    .sort({ 
      'pinnedBy.user': -1, // Pinned first
      lastMessageAt: -1 
    })
    .lean();

  // Process conversations
  const processedConversations = conversations.map(conv => {
    // Get other participant (for direct messages)
    const otherParticipant = conv.participants.find(
      p => p._id.toString() !== userId.toString()
    );

    // Get unread count for current user
    const unread = conv.unreadCount.find(
      u => u.user.toString() === userId.toString()
    );

    // Check if muted
    const mute = conv.mutedBy.find(m => m.user.toString() === userId.toString());
    const isMuted = mute && (!mute.mutedUntil || mute.mutedUntil > new Date());

    // Check if pinned
    const isPinned = conv.pinnedBy.some(p => p.user.toString() === userId.toString());

    // Check if archived
    const isArchived = conv.archivedBy.some(id => id.toString() === userId.toString());

    return {
      ...conv,
      otherParticipant,
      unreadCount: unread ? unread.count : 0,
      isMuted,
      isPinned,
      isArchived
    };
  });

  res.status(200).json({
    success: true,
    count: processedConversations.length,
    data: processedConversations
  });
});

/**
 * @desc    Get single conversation
 * @route   GET /api/v1/conversations/:id
 * @access  Private
 */
exports.getConversation = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id)
    .populate('participants', 'name images email')
    .populate({
      path: 'lastMessage',
      select: 'message createdAt sender receiver',
      populate: [
        { path: 'sender', select: 'name images' },
        { path: 'receiver', select: 'name images' }
      ]
    })
    .lean();

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  // Check if user is participant
  const isParticipant = conversation.participants.some(
    p => p._id.toString() === userId.toString()
  );

  if (!isParticipant) {
    return next(new ErrorResponse('Not authorized to view this conversation', 403));
  }

  // Get other participant (for direct messages)
  const otherParticipant = conversation.participants.find(
    p => p._id.toString() !== userId.toString()
  );

  // Get unread count
  const unread = conversation.unreadCount?.find(
    u => u.user.toString() === userId.toString()
  );

  res.status(200).json({
    success: true,
    data: {
      ...conversation,
      otherParticipant,
      unreadCount: unread ? unread.count : 0
    }
  });
});

/**
 * @desc    Mute a conversation
 * @route   POST /api/v1/conversations/:id/mute
 * @access  Private
 */
exports.muteConversation = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { duration } = req.body; // Duration in milliseconds (optional)
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  // Check if user is participant
  const isParticipant = conversation.participants.some(
    p => p.toString() === userId.toString()
  );

  if (!isParticipant) {
    return next(new ErrorResponse('Not authorized', 403));
  }

  await conversation.mute(userId, duration);

  res.status(200).json({
    success: true,
    message: 'Conversation muted successfully',
    data: conversation
  });
});

/**
 * @desc    Unmute a conversation
 * @route   POST /api/v1/conversations/:id/unmute
 * @access  Private
 */
exports.unmuteConversation = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  await conversation.unmute(userId);

  res.status(200).json({
    success: true,
    message: 'Conversation unmuted successfully',
    data: conversation
  });
});

/**
 * @desc    Archive a conversation
 * @route   POST /api/v1/conversations/:id/archive
 * @access  Private
 */
exports.archiveConversation = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  await conversation.archive(userId);

  res.status(200).json({
    success: true,
    message: 'Conversation archived successfully',
    data: conversation
  });
});

/**
 * @desc    Unarchive a conversation
 * @route   POST /api/v1/conversations/:id/unarchive
 * @access  Private
 */
exports.unarchiveConversation = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  await conversation.unarchive(userId);

  res.status(200).json({
    success: true,
    message: 'Conversation unarchived successfully',
    data: conversation
  });
});

/**
 * @desc    Pin a conversation
 * @route   POST /api/v1/conversations/:id/pin
 * @access  Private
 */
exports.pinConversation = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  await conversation.pin(userId);

  res.status(200).json({
    success: true,
    message: 'Conversation pinned successfully',
    data: conversation
  });
});

/**
 * @desc    Unpin a conversation
 * @route   POST /api/v1/conversations/:id/unpin
 * @access  Private
 */
exports.unpinConversation = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  await conversation.unpin(userId);

  res.status(200).json({
    success: true,
    message: 'Conversation unpinned successfully',
    data: conversation
  });
});

/**
 * @desc    Mark conversation as read
 * @route   PUT /api/v1/conversations/:id/read
 * @access  Private
 */
exports.markConversationAsRead = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);

  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  // Mark conversation as read
  await conversation.markAsRead(userId);

  // Also mark all messages in conversation as read
  const otherParticipant = conversation.participants.find(
    p => p.toString() !== userId.toString()
  );

  if (otherParticipant) {
    await Message.updateMany(
      {
        $or: [
          { sender: otherParticipant, receiver: userId },
          { sender: userId, receiver: otherParticipant }
        ],
        read: false
      },
      {
        $set: {
          read: true,
          readAt: new Date()
        },
        $push: {
          readBy: {
            user: userId,
            readAt: new Date()
          }
        }
      }
    );
  }

  res.status(200).json({
    success: true,
    message: 'Conversation marked as read',
    data: conversation
  });
});

