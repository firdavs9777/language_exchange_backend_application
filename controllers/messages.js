const path = require('path');
const asyncHandler = require('../middleware/async');
const Message = require('../models/Message');
const ErrorResponse = require('../utils/errorResponse');
const User = require("../models/User")
const deleteFromSpaces = require('../utils/deleteFromSpaces');
const mongoose = require('mongoose');

/**
 * @desc    Create a new conversation room between users
 * @route   POST /api/v1/conversations
 * @access  Private
 */
exports.createConversationRoom = asyncHandler(async (req, res, next) => {
  const { userId } = req.body;
  
  // Check if userId is provided
  if (!userId) {
    return next(new ErrorResponse('User ID is required', 400));
  }
  
  // Check if authenticated
  if (!req.user) {
    return next(new ErrorResponse('Not authenticated', 401));
  }
  
  const currentUserId = req.user._id;
  
  // Check if trying to create conversation with self
  if (currentUserId.toString() === userId) {
    return next(new ErrorResponse('Cannot create conversation with yourself', 400));
  }
  
  // Check if target user exists
  const userExists = await User.findById(userId);
  if (!userExists) {
    return next(new ErrorResponse('User not found', 404));
  }
  
  try {
    // Check for existing conversation between these users
    const existingMessages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ],
      isGroupMessage: false
    })
    .sort({ createdAt: -1 })
    .limit(1)
    .lean();

    if (existingMessages.length > 0) {
      // Populate the existing message with user details
      const populatedMessage = await Message.populate(existingMessages[0], [
        { path: 'sender', select: 'name avatar' },
        { path: 'receiver', select: 'name avatar' },
        { path: 'participants', select: 'name avatar' }
      ]);

      return res.status(200).json({
        success: true,
        data: {
          isNew: false,
          participants: populatedMessage.participants,
          lastMessage: populatedMessage,
          isGroupMessage: false
        }
      });
    }

    // Create a new message to initiate the conversation
    const newMessage = await Message.create({
      sender: currentUserId,
      receiver: userId,
      participants: [currentUserId, userId],
      message: "Conversation started", // Default initial message
      isGroupMessage: false
    });

    // Populate the new message with user details
    const populatedMessage = await Message.populate(newMessage, [
      { path: 'sender', select: 'name avatar' },
      { path: 'receiver', select: 'name avatar' },
      { path: 'participants', select: 'name avatar' }
    ]);

    res.status(201).json({
      success: true,
      data: {
        isNew: true,
        participants: populatedMessage.participants,
        lastMessage: populatedMessage,
        isGroupMessage: false
      }
    });

  } catch (error) {
    console.error('Error creating conversation:', error);
    return next(new ErrorResponse('Failed to create conversation', 500));
  }
});


  //@desc Get all message
  //@route Get /api/v1/messages
  //@access Private

  exports.getMessages = asyncHandler(async (req, res, next) => {
    const userId = req.user?._id;
    let query = { isDeleted: { $ne: true } };
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const actualLimit = Math.min(limit, 100); // Max 100 per page
    
    // If user is authenticated, filter out blocked users
    if (userId) {
      const user = await User.findById(userId).select('blockedUsers blockedBy');
      if (user) {
        const blockedUserIds = [
          ...user.blockedUsers.map(b => b.userId.toString()),
          ...user.blockedBy.map(b => b.userId.toString())
        ];
        query.$and = [
          { sender: { $nin: blockedUserIds } },
          { receiver: { $nin: blockedUserIds } }
        ];
      }
    }
    
    const [total, messages] = await Promise.all([
      Message.countDocuments(query),
      Message.find(query)
        .populate('sender', 'name images userMode')
        .populate('receiver', 'name images userMode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(actualLimit)
        .lean()
    ]);

    const totalPages = Math.ceil(total / actualLimit);

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      pagination: {
        currentPage: page,
        totalPages,
        limit: actualLimit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      data: messages
    });
  });
  //@desc Get Single Message
  //@route GET /api/v1/messages/:id
  //@access Private
  exports.getMessage = asyncHandler(async (req, res, next) => {
    const message = await Message.findById(req.params.id)
      .populate('sender', 'name images userMode')
      .populate('receiver', 'name images userMode')
      .lean();

    if (!message) {
      return next(
        new ErrorResponse(`Message not found with id of ${req.params.id}`, 404)
      );
    }

    // Authorization check - user must be sender or receiver
    const userId = req.user._id.toString();
    const senderId = message.sender?._id?.toString() || message.sender?.toString();
    const receiverId = message.receiver?._id?.toString() || message.receiver?.toString();

    if (userId !== senderId && userId !== receiverId) {
      return next(new ErrorResponse('Not authorized to view this message', 403));
    }

    res.status(200).json({ success: true, data: message });
  });


  // @desc Get messages for a single user
  // @route GET /api/v1/messages/user/:userId
  // @access Private


  exports.getUserMessages = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;

    // Authorization check - users can only view their own messages
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to view these messages', 403));
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const actualLimit = Math.min(limit, 100); // Max 100 per page

    const query = {
      $or: [{ sender: userId }, { receiver: userId }],
      isDeleted: { $ne: true }
    };

    const [total, messages] = await Promise.all([
      Message.countDocuments(query),
      Message.find(query)
        .populate('sender', 'name images userMode')
        .populate('receiver', 'name images userMode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(actualLimit)
        .lean()
    ]);
  
    // Transform the messages to include image URLs
    const messagesWithImageUrls = messages.map(message => {
      // Ensure sender and receiver are not null
      const sender = message.sender ? {
        ...message.sender,
        imageUrls: message.sender.images || []
      } : { imageUrls: [] };
    
      const receiver = message.receiver ? {
        ...message.receiver,
        imageUrls: message.receiver.images || []
      } : { imageUrls: [] };
    
      return {
        ...message,
        sender,
        receiver
      };
    });

    const totalPages = Math.ceil(total / actualLimit);

    res.status(200).json({
      success: true,
      count: messagesWithImageUrls.length,
      total,
      pagination: {
        currentPage: page,
        totalPages,
        limit: actualLimit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      data: messagesWithImageUrls,
    });
  });

  // @desc Get list of unique senders for a single user
  // @route GET /api/v1/messages/senders/:userId
  // @access Private
  exports.getUserSenders = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const actualLimit = Math.min(limit, 100); // Max 100 per page

    // Use aggregation pipeline for efficient querying
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const uniqueSenders = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: userIdObj },
            { receiver: userIdObj }
          ],
          isDeleted: { $ne: true }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', userIdObj] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', userIdObj] },
                    { $ne: ['$read', true] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: '$user._id',
          name: '$user.name',
          images: '$user.images',
          imageUrls: '$user.images',
          lastMessage: {
            message: '$lastMessage.message',
            createdAt: '$lastMessage.createdAt',
            _id: '$lastMessage._id'
          },
          unreadCount: 1
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
      { $skip: skip },
      { $limit: actualLimit }
    ]);

    // Get total count for pagination
    const totalResult = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: userIdObj },
            { receiver: userIdObj }
          ],
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', userIdObj] },
              '$receiver',
              '$sender'
            ]
          }
        }
      },
      { $count: 'total' }
    ]);

    const total = totalResult.length > 0 ? totalResult[0].total : 0;
    const totalPages = Math.ceil(total / actualLimit);

    res.status(200).json({
      success: true,
      count: uniqueSenders.length,
      total,
      pagination: {
        currentPage: page,
        totalPages,
        limit: actualLimit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      data: uniqueSenders,
    });
  });

  // @desc Get list of messages from a single user
  // @route GET /api/v1/messages/from/:userId
  // @access Private
  exports.getMessagesFromUser = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const actualLimit = Math.min(limit, 100); // Max 100 per page

    const query = {
      sender: userId,
      isDeleted: { $ne: true }
    };

    const [total, messages] = await Promise.all([
      Message.countDocuments(query),
      Message.find(query)
        .populate('sender', 'name images userMode')
        .populate('receiver', 'name images userMode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(actualLimit)
        .lean()
    ]);

    // Format messages to include image URLs
    const messagesWithImageUrls = messages.map(message => ({
      ...message,
      sender: {
        ...message.sender,
        imageUrls: message.sender?.images || []
      },
      receiver: {
        ...message.receiver,
        imageUrls: message.receiver?.images || []
      }
    }));

    const totalPages = Math.ceil(total / actualLimit);

    res.status(200).json({
      success: true,
      count: messagesWithImageUrls.length,
      total,
      pagination: {
        currentPage: page,
        totalPages,
        limit: actualLimit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      data: messagesWithImageUrls,
    });
  });
  //@desc POST create Message
  //@route POST /api/v1/messages
  //@access Private

exports.createMessage = asyncHandler(async (req, res, next) => {
  const { message, receiver, replyTo, forwardedFrom, location } = req.body;
  
  if (!req.user) return next(new ErrorResponse('Not authenticated', 401));
  
  const sender = req.user._id;
  
  if (!message && !req.file && !location) {
    return next(new ErrorResponse('Message content, attachment, or location is required', 400));
  }
  
  if (!receiver) return next(new ErrorResponse('Receiver is required', 400));
  
  const receiverExists = await User.findById(receiver);
  if (!receiverExists) return next(new ErrorResponse('Receiver not found', 404));
  
  const senderUser = req.limitationUser || await User.findById(sender);
  if (!senderUser) return next(new ErrorResponse('Sender user not found', 404));
  
  if (senderUser.isBlocked(receiver) || senderUser.isBlockedBy(receiver)) {
    return next(new ErrorResponse('Cannot send message to this user', 403));
  }

  // Check first-time conversation limit (max 5 messages until they reply)
  const FIRST_CHAT_MESSAGE_LIMIT = 5;

  // Check if receiver has ever sent a message to sender (i.e., they've replied)
  const receiverHasReplied = await Message.exists({
    sender: receiver,
    receiver: sender
  });

  if (!receiverHasReplied) {
    // This is a one-way conversation - check how many messages sender has sent
    const messagesSentToReceiver = await Message.countDocuments({
      sender: sender,
      receiver: receiver
    });

    if (messagesSentToReceiver >= FIRST_CHAT_MESSAGE_LIMIT) {
      return next(new ErrorResponse(
        `You can only send ${FIRST_CHAT_MESSAGE_LIMIT} messages until they reply. Please wait for a response.`,
        429
      ));
    }
  }

  const canSend = await senderUser.canSendMessage();
  if (!canSend) {
    const LIMITS = require('../config/limitations');
    let current = 0, max = 0;
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
  
  const messageData = { 
    message: message || null, 
    sender, 
    receiver 
  };
  
  // DigitalOcean Spaces attachment logic
  if (req.file) {
    messageData.media = {
      url: req.file.location,
      type: req.file.mimetype.startsWith('video/') ? 'video' : 
            req.file.mimetype.startsWith('image/') ? 'image' : 
            req.file.mimetype.startsWith('audio/') ? 'audio' : 'document',
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    };
  }
  
  if (location && location.latitude && location.longitude) {
    messageData.media = {
      type: 'location',
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || null,
        placeName: location.placeName || null
      }
    };
  }
  
  if (replyTo) {
    const replyToMessage = await Message.findById(replyTo);
    if (replyToMessage) messageData.replyTo = replyTo;
  }
  
  if (forwardedFrom && forwardedFrom.messageId) {
    const originalMessage = await Message.findById(forwardedFrom.messageId)
      .populate('sender', 'name');
    if (originalMessage) {
      messageData.isForwarded = true;
      messageData.forwardedFrom = {
        sender: originalMessage.sender._id,
        messageId: forwardedFrom.messageId,
        originalMessage: originalMessage.message
      };
    }
  }
  
  const newMessage = await Message.create(messageData);
  await senderUser.incrementMessageCount();
  
  const Conversation = require('../models/Conversation');
  let conversation = await Conversation.findOne({
    participants: { $all: [sender, receiver], $size: 2 },
    isGroup: false
  });
  
  if (!conversation) {
    conversation = await Conversation.create({
      participants: [sender, receiver],
      isGroup: false
    });
  }
  
  conversation.lastMessage = newMessage._id;
  conversation.lastMessageAt = new Date();
  await conversation.updateUnreadCount(receiver, 1);
  await conversation.save();
  
  await newMessage.populate('sender', 'name images userMode');
  await newMessage.populate('receiver', 'name images userMode');
  if (newMessage.replyTo) {
    await newMessage.populate('replyTo', 'message sender');
  }
  
  // ✨ NEW: Real-time Socket.IO notification
  try {
    const io = req.app.get('io');
    if (io) {
      // Get unread counts for both users
      const unreadForReceiver = await Message.countDocuments({
        receiver,
        sender,
        read: false
      });
      
      const unreadForSender = await Message.countDocuments({
        receiver: sender,
        sender: receiver,
        read: false
      });
      
      const hasMedia = !!newMessage.media;
      const mediaType = newMessage.media?.type || null;
      
      // Notify receiver (real-time notification)
      io.to(`user_${receiver}`).emit('newMessage', {
        message: newMessage,
        unreadCount: unreadForReceiver,
        senderId: sender.toString(),
        hasMedia,
        mediaType
      });
      
      // Notify sender's other devices (sync across devices)
      io.to(`user_${sender}`).emit('messageSent', {
        message: newMessage,
        unreadCount: unreadForSender,
        receiverId: receiver.toString(),
        hasMedia,
        mediaType
      });
      
      console.log(`📡 Socket notification sent: ${sender} → ${receiver}${hasMedia ? ` (${mediaType})` : ''}`);
    }
  } catch (socketError) {
    console.error('❌ Socket notification error:', socketError);
    // Don't fail the request if socket notification fails
  }
  
  res.status(201).json({ success: true, data: newMessage });
});
// GET /api/conversations
exports.getConversationRooms = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Get latest messages between user and others
  const messages = await Message.aggregate([
    { 
      $match: {
        participants: userId,
        isGroupMessage: false
      }
    },
    { 
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: {
          $setIntersection: ["$participants", [userId]]
        },
        lastMessage: { $first: "$$ROOT" }
      }
    }
  ]);

  const populated = await Message.populate(messages.map(m => m.lastMessage), [
    { path: 'sender', select: 'name avatar' },
    { path: 'receiver', select: 'name avatar' },
    { path: 'participants', select: 'name avatar' }
  ]);

  res.status(200).json({
    success: true,
    data: populated
  });
});

  //@desc Get messages between sender and receiver
  //@route GET /api/v1/messages/conversation/:senderId/:receiverId
  //@access Private
  exports.getConversation = asyncHandler(async (req, res, next) => {
    const { senderId, receiverId } = req.params;

    // Validate the senderId and receiverId
    if (!senderId || !receiverId) {
      return next(new ErrorResponse('Sender ID and Receiver ID are required', 400));
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const actualLimit = Math.min(limit, 100); // Max 100 per page

    const query = {
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ],
      isDeleted: { $ne: true }
    };

    const [total, messages] = await Promise.all([
      Message.countDocuments(query),
      Message.find(query)
        .populate('sender', 'name images userMode')
        .populate('receiver', 'name images userMode')
        .sort({ createdAt: 1 }) // Sort messages by creation date in ascending order
        .skip(skip)
        .limit(actualLimit)
        .lean()
    ]);

    // Check if messages exist
    if (total === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        pagination: {
          currentPage: page,
          totalPages: 0,
          limit: actualLimit,
          hasNextPage: false,
          hasPrevPage: false
        },
        data: [],
      });
    }

    // Transform the messages to include image URLs
    const messagesWithImageUrls = messages.map(message => ({
      ...message,
      sender: {
        ...message.sender,
        imageUrls: message.sender?.images || []
      },
      receiver: {
        ...message.receiver,
        imageUrls: message.receiver?.images || []
      }
    }));

    const totalPages = Math.ceil(total / actualLimit);

    res.status(200).json({
      success: true,
      count: messagesWithImageUrls.length,
      total,
      pagination: {
        currentPage: page,
        totalPages,
        limit: actualLimit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      data: messagesWithImageUrls,
    });
  });



  //@desc Update Moment
  //@route PUT /api/v1/messages/:id
  //@access Private

  exports.updateMessage = asyncHandler(async (req, res, next) => {
    let message = await Message.findById(req.params.id);
    if (!message) {
      return next(
        new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404)
      );
    }
    message = await Message.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    res.status(200).json({ success: true, data: message });
  });

  //@desc Delete Message
  //@route DELETE /api/v1/messages/:id
  //@access Private

  exports.deleteMessage = asyncHandler(async (req, res, next) => {
    const message = await Message.findByIdAndDelete(req.params.id);
    if (!message) return next(new ErrorResponse(`Message not found with id of ${req.params.id}`, 404));
    if (message.media && message.media.url && /^https?:\/\/.*digitaloceanspaces\.com\//.test(message.media.url)) {
      await deleteFromSpaces(message.media.url);
    }
    res.status(200).json({ success: true, data: {}, message: 'Message Deleted' });
  })

