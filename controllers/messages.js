const path = require('path');
const asyncHandler = require('../middleware/async');
const Message = require('../models/Message');
const ErrorResponse = require('../utils/errorResponse');
const { timeStamp } = require('console');
const User = require("../models/User")
//@desc Get all message
//@route Get /api/v1/messages
//@access Private

exports.getMessages = asyncHandler(async (req, res, next) => {
  const messages = await Message.find()
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

  console.log('Unieques',uniqueSenders);

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
  console.log(messagesWithImageUrls);

  res.status(200).json({
    success: true,
    data: messagesWithImageUrls,
  });
});
//@desc POST create Message
//@route POST /api/v1/messages
//@access Private

exports.createMessage = asyncHandler(async (req, res, next) => {
  const { message, receiver } = req.body; // Remove sender from destructuring
  
  // Check authentication
  if (!req.user) {
    return next(new ErrorResponse('Not authenticated', 401));
  }

  const sender = req.user._id; // Get sender from authenticated user

  // Validate request body
  if (!message || !receiver) {
    return next(new ErrorResponse('Message content and receiver are required', 400));
  }

  // Check if receiver exists
  const receiverExists = await User.findById(receiver);
  if (!receiverExists) {
    return next(new ErrorResponse('Receiver not found', 404));
  }

  // Create the message
  const newMessage = await Message.create({
    message,
    sender, // Use the authenticated user's ID
    receiver,
  });

  // Populate sender info
  await newMessage.populate('sender', 'name image');

  // Emit Socket.io event
  if (req.app.get('socketio')) {
    req.app.get('socketio').to(receiver).emit('newMessage', newMessage);
  }

  res.status(201).json({
    success: true,
    data: newMessage,
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
    .sort({ timeStamp: 1 }); // Sort messages by creation date in ascending order

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
});
