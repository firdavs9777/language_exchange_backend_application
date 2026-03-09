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

  // Pagination with defaults (backward compatible)
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100); // Max 100
  const skip = (page - 1) * limit;

  let query = {
    participants: userId,
    // Exclude conversations deleted by this user - optimized query
    deletedBy: { $ne: userId }
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

  // Run count and find in parallel for better performance
  const [total, conversations] = await Promise.all([
    Conversation.countDocuments(query),
    Conversation.find(query)
      .populate('participants', 'name images userMode') // Removed email for list view
      .populate('lastMessage', 'message messageType createdAt sender') // Only needed fields
      .sort({ lastMessageAt: -1 }) // Simplified sort - pinned handled client-side
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  // Process conversations
  const processedConversations = conversations.map(conv => {
    // Get other participant (for direct messages)
    const otherParticipant = conv.participants.find(
      p => p._id.toString() !== userId.toString()
    );

    // Get unread count for current user
    const unread = conv.unreadCount?.find(
      u => u.user.toString() === userId.toString()
    );

    // Check if muted
    const mute = conv.mutedBy?.find(m => m.user.toString() === userId.toString());
    const isMuted = mute && (!mute.mutedUntil || mute.mutedUntil > new Date());

    // Check if pinned
    const isPinned = conv.pinnedBy?.some(p => p.user.toString() === userId.toString());

    // Check if archived
    const isArchived = conv.archivedBy?.some(id => id.toString() === userId.toString());

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
    total,
    page,
    pages: Math.ceil(total / limit),
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
    .populate('participants', 'name images email userMode')
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

  // Also add to user's mutedChats for notification filtering
  await User.findByIdAndUpdate(userId, {
    $addToSet: { 'notificationSettings.mutedChats': id }
  });

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

  // Also remove from user's mutedChats
  await User.findByIdAndUpdate(userId, {
    $pull: { 'notificationSettings.mutedChats': id }
  });

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
 * @desc    Delete a conversation (soft delete - removes for current user only)
 * @route   DELETE /api/v1/conversations/:id
 * @access  Private
 */
exports.deleteConversation = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
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

  // Soft delete - add user to deletedBy array
  if (!conversation.deletedBy) {
    conversation.deletedBy = [];
  }

  if (!conversation.deletedBy.some(id => id.toString() === userId.toString())) {
    conversation.deletedBy.push(userId);
  }

  await conversation.save();

  res.status(200).json({
    success: true,
    message: 'Conversation deleted successfully'
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

/**
 * @desc    Set conversation theme/wallpaper (shared between both users)
 * @route   PUT /api/v1/conversations/:id/theme
 * @access  Private
 */
exports.setConversationTheme = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { theme } = req.body;
  const userId = req.user._id;

  // First try to find conversation by ID
  let conversation = await Conversation.findById(id);

  // If not found, try to find by participants (id might be the other user's ID)
  if (!conversation) {
    conversation = await Conversation.findOne({
      participants: { $all: [userId, id] }
    });
  }

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

  // Save theme at conversation level (shared between both users)
  conversation.theme = { ...conversation.theme, ...theme };
  await conversation.save();

  // Notify the other participant via socket
  try {
    const io = req.app.get('io');
    console.log(`🎨 Theme save - io available: ${!!io}`);
    console.log(`🎨 Theme save - participants: ${JSON.stringify(conversation.participants)}`);
    console.log(`🎨 Theme save - current userId: ${userId}`);

    if (io) {
      const otherParticipantId = conversation.participants.find(
        p => p.toString() !== userId.toString()
      );

      console.log(`🎨 Theme save - otherParticipantId: ${otherParticipantId}`);

      if (otherParticipantId) {
        const roomName = `user_${otherParticipantId}`;
        console.log(`🎨 Emitting themeChanged to room: ${roomName}`);

        io.to(roomName).emit('themeChanged', {
          conversationId: conversation._id,
          theme: conversation.theme,
          changedBy: userId.toString()
        });
        console.log(`🎨 Socket: Theme changed by ${userId}, notifying ${otherParticipantId}`);
      } else {
        console.log(`🎨 No other participant found to notify`);
      }
    } else {
      console.log(`🎨 Socket.io not available`);
    }
  } catch (socketError) {
    console.error('❌ Socket error on theme change:', socketError);
  }

  res.status(200).json({
    success: true,
    message: 'Theme updated successfully',
    data: conversation.theme
  });
});

/**
 * @desc    Get conversation theme/wallpaper (shared)
 * @route   GET /api/v1/conversations/:id/theme
 * @access  Private
 */
exports.getConversationTheme = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  // First try to find conversation by ID
  let conversation = await Conversation.findById(id);

  // If not found, try to find by participants (id might be the other user's ID)
  if (!conversation) {
    conversation = await Conversation.findOne({
      participants: { $all: [userId, id] }
    });
  }

  if (!conversation) {
    // No conversation found - return default theme
    return res.status(200).json({
      success: true,
      data: { preset: 'default' }
    });
  }

  // Check if user is participant
  const isParticipant = conversation.participants.some(
    p => p.toString() === userId.toString()
  );

  if (!isParticipant) {
    return next(new ErrorResponse('Not authorized', 403));
  }

  // Return the shared conversation theme
  const theme = conversation.theme || { preset: 'default' };

  res.status(200).json({
    success: true,
    data: theme
  });
});

