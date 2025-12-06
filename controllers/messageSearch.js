const asyncHandler = require('../middleware/async');
const Message = require('../models/Message');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Search messages
 * @route   GET /api/v1/messages/search
 * @access  Private
 */
exports.searchMessages = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const {
    q, // Search query
    conversationId,
    senderId,
    receiverId,
    mediaType,
    dateFrom,
    dateTo,
    hasMedia,
    isPinned,
    page = 1,
    limit = 20
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const actualLimit = Math.min(parseInt(limit), 100); // Max 100 per page

  // Build query
  let query = {
    $or: [
      { sender: userId },
      { receiver: userId }
    ],
    isDeleted: { $ne: true } // Exclude deleted messages
  };

  // Text search
  if (q && q.trim().length > 0) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { message: { $regex: q.trim(), $options: 'i' } },
        { 'media.fileName': { $regex: q.trim(), $options: 'i' } }
      ]
    });
  }

  // Filter by conversation (if conversationId provided, filter by sender/receiver)
  if (conversationId) {
    const conversationUser = await require('../models/User').findById(conversationId);
    if (conversationUser) {
      query.$or = [
        { sender: userId, receiver: conversationId },
        { sender: conversationId, receiver: userId }
      ];
    }
  }

  // Filter by sender
  if (senderId) {
    query.sender = senderId;
  }

  // Filter by receiver
  if (receiverId) {
    query.receiver = receiverId;
  }

  // Filter by media type
  if (mediaType) {
    query['media.type'] = mediaType;
  }

  // Filter by has media
  if (hasMedia === 'true') {
    query['media.type'] = { $exists: true, $ne: null };
  } else if (hasMedia === 'false') {
    query.$or = [
      { 'media.type': { $exists: false } },
      { 'media.type': null }
    ];
  }

  // Filter by pinned
  if (isPinned === 'true') {
    query.pinned = true;
  } else if (isPinned === 'false') {
    query.pinned = { $ne: true };
  }

  // Date range filter
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) {
      query.createdAt.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      query.createdAt.$lte = new Date(dateTo);
    }
  }

  // Execute search
  const [total, messages] = await Promise.all([
    Message.countDocuments(query),
    Message.find(query)
      .populate('sender', 'name images')
      .populate('receiver', 'name images')
      .populate('replyTo', 'message sender')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(actualLimit)
      .lean()
  ]);

  // Process messages to add media URLs
  const processedMessages = messages.map(msg => {
    const processed = { ...msg };
    
    // Add media URL if exists
    if (msg.media && msg.media.url) {
      processed.media = {
        ...msg.media,
        url: `${req.protocol}://${req.get('host')}/uploads/${msg.media.url}`,
        thumbnail: msg.media.thumbnail 
          ? `${req.protocol}://${req.get('host')}/uploads/${msg.media.thumbnail}`
          : null
      };
    }
    
    return processed;
  });

  const totalPages = Math.ceil(total / actualLimit);

  res.status(200).json({
    success: true,
    count: processedMessages.length,
    total,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      limit: actualLimit,
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1
    },
    data: processedMessages
  });
});

