const path = require('path');
const asyncHandler = require('../middleware/async');
const Message = require('../models/Message');
const ErrorResponse = require('../utils/errorResponse');
const { timeStamp } = require('console');
const User = require("../models/User")

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
    
    const messages = await Message.find(query)
      .populate('sender', 'name email bio image birth_day birth_month gender birth_year native_language images imageUrls image language_to_learn createdAt __v')
      .populate('receiver', 'name email bio image birth_day birth_month gender birth_year native_language images imageUrls language_to_learn createdAt __v');
    res.status(200).json({
      success: true,
      data: messages
    });
  });
  //@desc Get Single Message
  //@route GET /api/v1/messages/:id
  //@access Private
  exports.getMessage = asyncHandler(async (req, res, next) => {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return next(
        new ErrorResponse(`Message not found with id of ${req.params.id}`, 404)
      );
    }
    res.status(200).json({ success: true, data: message });
  });


  // @desc Get messages for a single user
  // @route GET /api/v1/messages/user/:userId
  // @access Private


  exports.getUserMessages = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;
  
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    })
      .populate('sender', 'name email bio image birth_day birth_month gender birth_year native_language images imageUrls language_to_learn createdAt __v')
      .populate('receiver', 'name email bio image birth_day birth_month gender birth_year native_language images imageUrls language_to_learn createdAt');
  
    // Transform the messages to include image URLs
    const messagesWithImageUrls = messages.map(message => {
      // Ensure sender and receiver are not null
      const sender = message.sender ? {
        ...message.sender._doc,
        imageUrls: message.sender.images ?
          message.sender.images.map(image =>
            `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
          ) : []
      } : { imageUrls: [] };
    
      const receiver = message.receiver ? {
        ...message.receiver._doc,
        imageUrls: message.receiver.images ?
          message.receiver.images.map(image =>
            `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
          ) : []
      } : { imageUrls: [] };
    
      return {
        ...message._doc,
        sender,
        receiver
      };
    });

    res.status(200).json({
      success: true,
      data: messagesWithImageUrls,
    });
  });

  // @desc Get list of unique senders for a single user
  // @route GET /api/v1/messages/senders/:userId
  // @access Private
  exports.getUserSenders = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;

    // Find messages where the user is either the sender or receiver
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    }).populate('sender', 'name email bio image birth_day birth_month gender birth_year native_language images imageUrls language_to_learn createdAt __v') // Populate sender details
      .populate('receiver', 'name email bio image birth_day birth_month gender birth_year native_language images imageUrls language_to_learn createdAt __v'); // Populate sender details

    // Create a Set to hold unique sender IDs
    const senderSet = new Set();
  
    // Extract unique sender details and other data
    const uniqueSenders = messages.reduce((senders, message) => {
      if (message.sender && !senderSet.has(message.sender._id.toString())) {
        senderSet.add(message.sender._id.toString());
      
        // Include message content and timestamps if needed
        const senderData = {
          ...message.sender._doc,
          imageUrls: message.sender.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`),
          recentMessage: {
            content: message.message,  // Assuming `content` is a field in Message
            sentAt: message.createdAt   // Assuming `createdAt` is a field in Message
          }
        };
      
        senders.push(senderData);
      }
      return senders;
    }, []);



    res.status(200).json({
      success: true,
      data: uniqueSenders,
    });
  });

  // @desc Get list of messages from a single user
  // @route GET /api/v1/messages/from/:userId
  // @access Private
  exports.getMessagesFromUser = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;

    // Find messages where the sender is the specified user
    const messages = await Message.find({ sender: userId })
      .populate('sender', 'name email bio image birth_day birth_month gender birth_year native_language images imageUrls language_to_learn createdAt __v')
      .populate('receiver', 'name email bio image birth_day birth_month gender birth_year native_language images imageUrls language_to_learn createdAt __v')
      .sort({ createdAt: -1 }); // Sort messages by creation date in descending order

    // Format messages to include image URLs
    const messagesWithImageUrls = messages.map(message => ({
      ...message._doc,
      sender: {
        ...message.sender._doc,
        imageUrls: message.sender.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`)
      },
      receiver: {
        ...message.receiver._doc,
        imageUrls: message.receiver.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`)
      }
    }));


    res.status(200).json({
      success: true,
      data: messagesWithImageUrls,
    });
  });
  //@desc POST create Message
  //@route POST /api/v1/messages
  //@access Private

  exports.createMessage = asyncHandler(async (req, res, next) => {
    const { message, receiver, replyTo, forwardedFrom, location } = req.body; // Remove sender from destructuring
  
    // Check authentication
    if (!req.user) {
      return next(new ErrorResponse('Not authenticated', 401));
    }

    const sender = req.user._id; // Get sender from authenticated user

    // Validate request body - either message or media must be present
    if (!message && !req.processedMedia && !location) {
      return next(new ErrorResponse('Message content, media, or location is required', 400));
    }

    if (!receiver) {
      return next(new ErrorResponse('Receiver is required', 400));
    }

    // Check if receiver exists
    const receiverExists = await User.findById(receiver);
    if (!receiverExists) {
      return next(new ErrorResponse('Receiver not found', 404));
    }

    // Check message limit (user should be loaded by middleware if used, otherwise load it)
    const senderUser = req.limitationUser || await User.findById(sender);
    if (!senderUser) {
      return next(new ErrorResponse('Sender user not found', 404));
    }

    // Check if sender has blocked receiver or vice versa
    if (senderUser.isBlocked(receiver) || senderUser.isBlockedBy(receiver)) {
      return next(new ErrorResponse('Cannot send message to this user', 403));
    }

    // Check if user can send message
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

    // Build message data
    const messageData = {
      message: message || null,
      sender,
      receiver,
    };

    // Add media if present
    if (req.processedMedia) {
      messageData.media = req.processedMedia;
    }

    // Add location if present
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

    // Add reply information
    if (replyTo) {
      const replyToMessage = await Message.findById(replyTo);
      if (replyToMessage) {
        messageData.replyTo = replyTo;
      }
    }

    // Add forward information
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

    // Create the message
    const newMessage = await Message.create(messageData);

    // Increment message count
    await senderUser.incrementMessageCount();

    // Update or create conversation
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

    // Update conversation
    conversation.lastMessage = newMessage._id;
    conversation.lastMessageAt = new Date();
    await conversation.updateUnreadCount(receiver, 1);
    await conversation.save();

    // Populate sender info
    await newMessage.populate('sender', 'name images');
    await newMessage.populate('receiver', 'name images');
    if (newMessage.replyTo) {
      await newMessage.populate('replyTo', 'message sender');
    }

    // Add media URL to response if exists
    const responseData = newMessage.toObject();
    if (responseData.media && responseData.media.url && !responseData.media.url.startsWith('http')) {
      responseData.media.url = `${req.protocol}://${req.get('host')}/uploads/${responseData.media.url}`;
      if (responseData.media.thumbnail) {
        responseData.media.thumbnail = `${req.protocol}://${req.get('host')}/uploads/${responseData.media.thumbnail}`;
      }
    }

    // Emit Socket.io event
    if (req.app.get('socketio')) {
      const io = req.app.get('socketio');
      const receiverRoom = `user_${receiver}`;
      
      io.to(receiverRoom).emit('newMessage', {
        message: responseData,
        conversationId: conversation._id,
        unreadCount: conversation.unreadCount.find(u => u.user.toString() === receiver.toString())?.count || 0
      });
    }

    res.status(201).json({
      success: true,
      data: responseData,
    });
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

    // Find messages where sender and receiver match the provided IDs
    const messages = await Message.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ]
    })
      .populate('sender', 'name email bio birth_day birth_month gender birth_year native_language images language_to_learn createdAt')
      .populate('receiver', 'name email bio birth_day birth_month gender birth_year native_language images language_to_learn createdAt')
      .sort({ createdAt: 1 })// Sort messages by creation date in ascending order

    // Check if messages exist
    if (messages.length === 0) {
      return next(new ErrorResponse('No messages found for the given conversation', 404));
    }

    // Transform the messages to include image URLs
    const messagesWithImageUrls = messages.map(message => ({
      ...message._doc,
      sender: {
        ...message.sender._doc,
        imageUrls: message.sender.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`)
      },
      receiver: {
        ...message.receiver._doc,
        imageUrls: message.receiver.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`)
      }
    }));

    res.status(200).json({
      success: true,
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
    if (!message) {
      return next(
        new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404)
      );
    }
    message.remove();
    res.status(200).json({ success: true, data: {}, message: 'Message Deleted' });
  })

