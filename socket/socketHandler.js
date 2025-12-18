// socket/socketHandler.js
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Poll = require('../models/Poll');
const { resetDailyCounters } = require('../utils/limitations');
const LIMITS = require('../config/limitations');
const notificationService = require('../services/notificationService');

// Store user socket connections (userId -> Set of socketIds)
const userConnections = new Map();

// Store typing timeouts
const typingTimeouts = new Map();

/**
 * Socket.IO Authentication Middleware
 */
const socketAuth = (socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization ||
                  socket.handshake.query.token;
    
    console.log('🔑 Socket auth attempt from:', socket.handshake.headers.origin);
    
    if (!token) {
      console.log('❌ No token provided');
      return next(new Error('Authentication error: No token provided'));
    }
    
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    
    socket.user = decoded;
    console.log(`✅ User ${decoded.id} authenticated`);
    next();
  } catch (err) {
    console.log('❌ Auth error:', err.message);
    return next(new Error('Authentication error: Invalid token'));
  }
};

/**
 * Initialize Socket.IO with all event handlers
 */
const initializeSocket = (io) => {
  
  // Apply authentication middleware
  io.use(socketAuth);
  
  // Handle new connections
  io.on('connection', async (socket) => {
    const userId = socket.user?.id;
    
    if (!userId) {
      console.log('❌ No user ID - disconnecting socket');
      socket.disconnect(true);
      return;
    }
    
    console.log(`✅ User ${userId} connected (socket: ${socket.id})`);
    
    // Check if this user has existing connections and clean them up
    if (userConnections.has(userId)) {
      const existingSockets = userConnections.get(userId);
      console.log(`⚠️ User ${userId} already has ${existingSockets.size} connection(s), cleaning up old sockets...`);
      
      // Force disconnect old sockets for this user
      for (const oldSocketId of existingSockets) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket && oldSocket.id !== socket.id) {
          console.log(`🔌 Disconnecting old socket ${oldSocketId} for user ${userId}`);
          oldSocket.disconnect(true);
        }
      }
      
      // Clear old connections
      userConnections.delete(userId);
    }
    
    // Track this new connection
    userConnections.set(userId, new Set([socket.id]));
    
    // Join user's personal room
    const userRoom = `user_${userId}`;
    await socket.join(userRoom);
    console.log(`👤 User ${userId} joined room: ${userRoom}`);
    
    // Send online users list
    await sendOnlineUsers(socket, io);
    
    // Broadcast that this user is now online
    socket.broadcast.emit('userStatusUpdate', {
      userId,
      status: 'online',
      lastSeen: null
    });
    
    // Register event handlers
    registerMessageHandlers(socket, io);
    registerTypingHandlers(socket, io);
    registerStatusHandlers(socket, io);
    registerPresenceHandlers(socket, io);
    registerLogoutHandlers(socket, io);
    
    // Register advanced feature handlers
    registerVoiceMessageHandlers(socket, io);
    registerCorrectionHandlers(socket, io);
    registerPollHandlers(socket, io);
    registerDisappearingMessageHandlers(socket, io);
    
    // Handle disconnection
    socket.on('disconnect', (reason) => handleDisconnect(socket, io, reason));
    
    // Handle errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error for user ${userId}:`, error);
    });
  });
  
  return io;
};

/**
 * Send list of currently online users
 */
const sendOnlineUsers = async (socket, io) => {
  try {
    const connectedSockets = await io.fetchSockets();
    const onlineUsers = connectedSockets
      .filter(s => s.user?.id && s.user.id !== socket.user.id)
      .map(s => ({
        userId: s.user.id,
        status: 'online',
        lastSeen: null
      }));
    
    // Remove duplicates (same user with multiple connections)
    const uniqueUsers = Array.from(
      new Map(onlineUsers.map(u => [u.userId, u])).values()
    );
    
    socket.emit('onlineUsers', uniqueUsers);
    console.log(`📋 Sent ${uniqueUsers.length} online users to ${socket.user.id}`);
  } catch (error) {
    console.error('❌ Error sending online users:', error);
  }
};

/**
 * Register message-related event handlers
 */
const registerMessageHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  // Send message
  socket.on('sendMessage', async (data, callback) => {
    try {
      const receiver = data?.receiver || data?.receiverId;
      const messageText = data?.message || data?.text || data?.content;
      
      // Validation
      if (!receiver) {
        throw new Error('Receiver ID is required');
      }
      
      if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
        throw new Error('Message text is required');
      }
      
      console.log(`📤 Message: ${userId} → ${receiver}`);
      
      // Get sender user and check limits
      const senderUser = await User.findById(userId);
      if (!senderUser) {
        throw new Error('Sender not found');
      }
      
      // Reset daily counters if new day
      await resetDailyCounters(senderUser);
      await senderUser.save();
      
      // Check block status
      if (senderUser.isBlocked(receiver) || senderUser.isBlockedBy(receiver)) {
        throw new Error('Cannot send message to blocked user');
      }
      
      // Check message limit
      const canSend = await senderUser.canSendMessage();
      if (!canSend) {
        const { current, max, resetTime } = getMessageLimitInfo(senderUser);
        throw new Error(
          `Daily message limit exceeded. Used ${current}/${max}. Resets at ${resetTime}.`
        );
      }
      
      // Create message
      const newMessage = await Message.create({
        sender: userId,
        receiver,
        message: messageText.trim()
      });
      
      // Increment sender's message count
      await senderUser.incrementMessageCount();
      
      // Populate message
      const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender', 'name imageUrls')
        .populate('receiver', 'name imageUrls');
      
      // Update conversation
      await updateConversation(userId, receiver, newMessage._id);
      
      // Get unread counts
      const unreadForReceiver = await Message.countDocuments({
        receiver,
        sender: userId,
        read: false
      });
      
      const unreadForSender = await Message.countDocuments({
        receiver: userId,
        sender: receiver,
        read: false
      });
      
      // Send to receiver
      io.to(`user_${receiver}`).emit('newMessage', {
        message: populatedMessage,
        unreadCount: unreadForReceiver,
        senderId: userId
      });
      
      // Send push notification if receiver is not online or not in this conversation
      const isRecipientOnline = userConnections.has(receiver);
      if (!isRecipientOnline) {
        notificationService.sendChatMessage(
          receiver,
          userId,
          {
            _id: newMessage._id,
            text: messageText,
            conversation: newMessage.conversation
          }
        ).catch(err => console.error('Push notification failed:', err));
      }
      
      // Send acknowledgment to sender
      const senderResponse = {
        status: 'success',
        message: populatedMessage,
        unreadCount: unreadForSender
      };
      
      if (callback) {
        callback(senderResponse);
      }
      
      // Also emit to sender's other devices
      socket.to(`user_${userId}`).emit('messageSent', {
        message: populatedMessage,
        unreadCount: unreadForSender,
        receiverId: receiver
      });
      
      console.log(`✅ Message delivered: ${userId} → ${receiver}`);
      
    } catch (error) {
      console.error('❌ Send message error:', error.message);
      
      const errorResponse = {
        status: 'error',
        error: error.message
      };
      
      if (callback) {
        callback(errorResponse);
      } else {
        socket.emit('messageError', errorResponse);
      }
    }
  });
  
  // Mark messages as read
  socket.on('markAsRead', async (data, callback) => {
    try {
      const senderId = data?.senderId || data;
      
      if (!senderId) {
        throw new Error('Sender ID is required');
      }
      
      console.log(`📖 Mark as read: ${senderId} → ${userId}`);
      
      // Update messages
      const result = await Message.updateMany(
        {
          sender: senderId,
          receiver: userId,
          read: false
        },
        {
          read: true,
          readAt: new Date()
        }
      );
      
      console.log(`✅ Marked ${result.modifiedCount} messages as read`);
      
      // Update conversation unread count
      await updateConversationUnreadCount(userId, senderId, 0);
      
      // Notify sender that messages were read
      io.to(`user_${senderId}`).emit('messagesRead', {
        readBy: userId,
        count: result.modifiedCount
      });
      
      if (callback) {
        callback({
          status: 'success',
          markedCount: result.modifiedCount
        });
      }
      
    } catch (error) {
      console.error('❌ Mark as read error:', error.message);
      
      if (callback) {
        callback({
          status: 'error',
          error: error.message
        });
      }
    }
  });
  
  // Delete message
  socket.on('deleteMessage', async (data, callback) => {
    try {
      const messageId = data?.messageId || data;
      
      if (!messageId) {
        throw new Error('Message ID is required');
      }
      
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new Error('Message not found');
      }
      
      if (message.sender.toString() !== userId) {
        throw new Error('Not authorized to delete this message');
      }
      
      await message.deleteOne();
      
      // Notify receiver
      io.to(`user_${message.receiver}`).emit('messageDeleted', {
        messageId,
        senderId: userId
      });
      
      console.log(`🗑️ Message deleted: ${messageId}`);
      
      if (callback) {
        callback({
          status: 'success',
          messageId
        });
      }
      
    } catch (error) {
      console.error('❌ Delete message error:', error.message);
      
      if (callback) {
        callback({
          status: 'error',
          error: error.message
        });
      }
    }
  });
};

/**
 * Register typing indicator handlers
 */
const registerTypingHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  // User started typing
  socket.on('typing', (data) => {
    try {
      const receiver = data?.receiver || data?.receiverId;
      
      if (!receiver) return;
      
      console.log(`⌨️ ${userId} typing to ${receiver}`);
      
      // Clear existing timeout
      const timeoutKey = `${userId}-${receiver}`;
      if (typingTimeouts.has(timeoutKey)) {
        clearTimeout(typingTimeouts.get(timeoutKey));
      }
      
      // Emit typing event
      io.to(`user_${receiver}`).emit('userTyping', {
        userId,
        isTyping: true
      });
      
      // Auto-stop typing after 5 seconds
      const timeout = setTimeout(() => {
        io.to(`user_${receiver}`).emit('userStoppedTyping', {
          userId,
          isTyping: false
        });
        typingTimeouts.delete(timeoutKey);
      }, 5000);
      
      typingTimeouts.set(timeoutKey, timeout);
      
    } catch (error) {
      console.error('❌ Typing error:', error);
    }
  });
  
  // User stopped typing
  socket.on('stopTyping', (data) => {
    try {
      const receiver = data?.receiver || data?.receiverId;
      
      if (!receiver) return;
      
      console.log(`⌨️ ${userId} stopped typing to ${receiver}`);
      
      // Clear timeout
      const timeoutKey = `${userId}-${receiver}`;
      if (typingTimeouts.has(timeoutKey)) {
        clearTimeout(typingTimeouts.get(timeoutKey));
        typingTimeouts.delete(timeoutKey);
      }
      
      // Emit stopped typing event
      io.to(`user_${receiver}`).emit('userStoppedTyping', {
        userId,
        isTyping: false
      });
      
    } catch (error) {
      console.error('❌ Stop typing error:', error);
    }
  });
};

/**
 * Register status update handlers
 */
const registerStatusHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  // Update user status
  socket.on('updateStatus', (data) => {
    try {
      const status = data?.status;
      const validStatuses = ['online', 'away', 'busy', 'offline'];
      
      if (!status || !validStatuses.includes(status)) {
        return;
      }
      
      console.log(`📡 User ${userId} status: ${status}`);
      
      socket.broadcast.emit('userStatusUpdate', {
        userId,
        status,
        lastSeen: status === 'offline' ? new Date().toISOString() : null
      });
      
    } catch (error) {
      console.error('❌ Status update error:', error);
    }
  });
  
  // Quick status shortcuts
  socket.on('setOnline', () => {
    socket.broadcast.emit('userStatusUpdate', {
      userId,
      status: 'online',
      lastSeen: null
    });
  });
  
  socket.on('setAway', () => {
    socket.broadcast.emit('userStatusUpdate', {
      userId,
      status: 'away',
      lastSeen: null
    });
  });
  
  socket.on('setBusy', () => {
    socket.broadcast.emit('userStatusUpdate', {
      userId,
      status: 'busy',
      lastSeen: null
    });
  });
};

/**
 * Register presence-related handlers
 */
const registerPresenceHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  // Get specific user's status
  socket.on('getUserStatus', async (data, callback) => {
    try {
      const targetUserId = data?.userId;
      
      if (!targetUserId) {
        throw new Error('User ID is required');
      }
      
      const isOnline = userConnections.has(targetUserId);
      
      callback({
        status: 'success',
        data: {
          userId: targetUserId,
          status: isOnline ? 'online' : 'offline',
          lastSeen: isOnline ? null : new Date().toISOString()
        }
      });
      
    } catch (error) {
      callback({
        status: 'error',
        error: error.message
      });
    }
  });
  
  // Request status updates for multiple users
  socket.on('requestStatusUpdates', async (data) => {
    try {
      const userIds = data?.userIds || [];
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return;
      }
      
      const statusUpdates = {};
      
      for (const targetId of userIds) {
        const isOnline = userConnections.has(targetId);
        statusUpdates[targetId] = {
          status: isOnline ? 'online' : 'offline',
          lastSeen: isOnline ? null : new Date().toISOString()
        };
      }
      
      socket.emit('bulkStatusUpdate', statusUpdates);
      
    } catch (error) {
      console.error('❌ Request status updates error:', error);
    }
  });
};

/**
 * Register logout-related handlers
 */
const registerLogoutHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  // Explicit logout - clean up everything
  socket.on('logout', async (data, callback) => {
    try {
      console.log(`👋 User ${userId} logging out (explicit)`);
      
      // Clear all typing indicators
      for (const [key, timeout] of typingTimeouts.entries()) {
        if (key.startsWith(userId)) {
          clearTimeout(timeout);
          typingTimeouts.delete(key);
        }
      }
      
      // Leave all rooms
      const rooms = Array.from(socket.rooms);
      for (const room of rooms) {
        if (room !== socket.id) {
          await socket.leave(room);
          console.log(`📤 User ${userId} left room: ${room}`);
        }
      }
      
      // Remove from user connections
      if (userConnections.has(userId)) {
        userConnections.get(userId).delete(socket.id);
        
        if (userConnections.get(userId).size === 0) {
          userConnections.delete(userId);
        }
      }
      
      // Broadcast offline status
      socket.broadcast.emit('userStatusUpdate', {
        userId,
        status: 'offline',
        lastSeen: new Date().toISOString()
      });
      
      console.log(`✅ User ${userId} logged out successfully`);
      
      if (callback) {
        callback({
          status: 'success',
          message: 'Logged out successfully'
        });
      }
      
      // Disconnect the socket
      socket.disconnect(true);
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      
      if (callback) {
        callback({
          status: 'error',
          error: error.message
        });
      }
    }
  });
};

/**
 * Handle user disconnection
 */
const handleDisconnect = async (socket, io, reason) => {
  const userId = socket.user?.id;
  
  if (!userId) return;
  
  console.log(`❌ User ${userId} disconnected (socket: ${socket.id}): ${reason}`);
  
  // Leave all rooms explicitly
  const rooms = Array.from(socket.rooms);
  for (const room of rooms) {
    if (room !== socket.id) {
      await socket.leave(room);
    }
  }
  
  // Remove this socket from user's connections
  if (userConnections.has(userId)) {
    userConnections.get(userId).delete(socket.id);
    
    // If user has no more connections, they're offline
    if (userConnections.get(userId).size === 0) {
      userConnections.delete(userId);
      
      console.log(`📴 User ${userId} is now offline`);
      
      // Broadcast offline status
      socket.broadcast.emit('userStatusUpdate', {
        userId,
        status: 'offline',
        lastSeen: new Date().toISOString()
      });
    } else {
      console.log(`📱 User ${userId} still has ${userConnections.get(userId).size} active connection(s)`);
    }
  }
  
  // Clear any typing timeouts for this user
  for (const [key, timeout] of typingTimeouts.entries()) {
    if (key.startsWith(userId)) {
      clearTimeout(timeout);
      typingTimeouts.delete(key);
    }
  }
  
  // Clear socket user data
  socket.user = null;
};

/**
 * Update or create conversation
 */
const updateConversation = async (senderId, receiverId, messageId) => {
  try {
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId], $size: 2 },
      isGroup: false
    });
    
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
        isGroup: false
      });
    }
    
    conversation.lastMessage = messageId;
    conversation.lastMessageAt = new Date();
    
    // Increment unread count for receiver
    await conversation.updateUnreadCount(receiverId, 1);
    
    await conversation.save();
    
  } catch (error) {
    console.error('❌ Update conversation error:', error);
  }
};

/**
 * Update conversation unread count
 */
const updateConversationUnreadCount = async (userId, otherUserId, count) => {
  try {
    const conversation = await Conversation.findOne({
      participants: { $all: [userId, otherUserId], $size: 2 },
      isGroup: false
    });
    
    if (conversation) {
      await conversation.updateUnreadCount(userId, count);
      await conversation.save();
    }
    
  } catch (error) {
    console.error('❌ Update conversation unread count error:', error);
  }
};

/**
 * Get message limit info for user
 */
const getMessageLimitInfo = (user) => {
  let current = 0;
  let max = 0;
  
  if (user.userMode === 'regular') {
    current = user.regularUserLimitations.messagesSentToday || 0;
    max = LIMITS.regular.messagesPerDay;
  } else if (user.userMode === 'visitor') {
    current = user.visitorLimitations.messagesSent || 0;
    max = LIMITS.visitor.messagesPerDay;
  }
  
  const now = new Date();
  const resetTime = new Date(now);
  resetTime.setHours(24, 0, 0, 0);
  
  return {
    current,
    max,
    resetTime: resetTime.toLocaleString()
  };
};

/**
 * Get online users count (for debugging)
 */
const getOnlineUsersCount = () => {
  return userConnections.size;
};

/**
 * Get all online user IDs (for debugging)
 */
const getOnlineUserIds = () => {
  return Array.from(userConnections.keys());
};

// ========== ADVANCED FEATURE HANDLERS ==========

/**
 * Register voice message handlers
 */
const registerVoiceMessageHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  // Send voice message via socket (for real-time notification)
  socket.on('sendVoiceMessage', async (data, callback) => {
    try {
      const { receiver, mediaUrl, duration, waveform } = data;
      
      if (!receiver || !mediaUrl) {
        throw new Error('Receiver and media URL are required');
      }
      
      console.log(`🎤 Voice message: ${userId} → ${receiver}`);
      
      // Create voice message
      const voiceMessage = await Message.create({
        sender: userId,
        receiver,
        messageType: 'voice',
        media: {
          url: mediaUrl,
          type: 'voice',
          duration: duration || 0,
          waveform: waveform || []
        }
      });
      
      const populatedMessage = await Message.findById(voiceMessage._id)
        .populate('sender', 'name images')
        .populate('receiver', 'name images');
      
      // Update conversation
      await updateConversation(userId, receiver, voiceMessage._id);
      
      // Notify receiver
      io.to(`user_${receiver}`).emit('newVoiceMessage', {
        message: populatedMessage,
        senderId: userId
      });
      
      if (callback) {
        callback({
          status: 'success',
          message: populatedMessage
        });
      }
      
      console.log(`✅ Voice message delivered: ${userId} → ${receiver}`);
      
    } catch (error) {
      console.error('❌ Voice message error:', error.message);
      if (callback) {
        callback({ status: 'error', error: error.message });
      }
    }
  });
  
  // Voice message played (for read receipts)
  socket.on('voiceMessagePlayed', async (data) => {
    try {
      const { messageId, senderId } = data;
      
      if (!messageId || !senderId) return;
      
      // Mark as read
      await Message.findByIdAndUpdate(messageId, {
        read: true,
        readAt: new Date()
      });
      
      // Notify sender
      io.to(`user_${senderId}`).emit('voiceMessageListened', {
        messageId,
        listenedBy: userId
      });
      
    } catch (error) {
      console.error('❌ Voice message played error:', error);
    }
  });
};

/**
 * Register correction handlers (HelloTalk style)
 */
const registerCorrectionHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  // Send correction suggestion
  socket.on('sendCorrection', async (data, callback) => {
    try {
      const { messageId, correctedText, explanation } = data;
      
      if (!messageId || !correctedText) {
        throw new Error('Message ID and corrected text are required');
      }
      
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new Error('Message not found');
      }
      
      // Can't correct your own message
      if (message.sender.toString() === userId) {
        throw new Error('Cannot correct your own message');
      }
      
      console.log(`📝 Correction: ${userId} → message ${messageId}`);
      
      // Add correction
      await message.addCorrection(userId, message.message, correctedText, explanation || '');
      
      await message.populate('corrections.corrector', 'name images');
      
      const newCorrection = message.corrections[message.corrections.length - 1];
      
      // Notify message sender
      io.to(`user_${message.sender}`).emit('newCorrection', {
        messageId,
        correction: newCorrection,
        correctorId: userId
      });
      
      if (callback) {
        callback({
          status: 'success',
          correction: newCorrection
        });
      }
      
      console.log(`✅ Correction sent for message ${messageId}`);
      
    } catch (error) {
      console.error('❌ Send correction error:', error.message);
      if (callback) {
        callback({ status: 'error', error: error.message });
      }
    }
  });
  
  // Accept correction
  socket.on('acceptCorrection', async (data, callback) => {
    try {
      const { messageId, correctionId } = data;
      
      if (!messageId || !correctionId) {
        throw new Error('Message ID and correction ID are required');
      }
      
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new Error('Message not found');
      }
      
      // Only message sender can accept
      if (message.sender.toString() !== userId) {
        throw new Error('Only message sender can accept corrections');
      }
      
      await message.acceptCorrection(correctionId);
      
      const correction = message.corrections.id(correctionId);
      
      // Notify corrector
      if (correction && correction.corrector) {
        io.to(`user_${correction.corrector}`).emit('correctionAccepted', {
          messageId,
          correctionId,
          acceptedBy: userId
        });
      }
      
      if (callback) {
        callback({ status: 'success' });
      }
      
    } catch (error) {
      console.error('❌ Accept correction error:', error.message);
      if (callback) {
        callback({ status: 'error', error: error.message });
      }
    }
  });
};

/**
 * Register poll handlers
 */
const registerPollHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  // Create poll
  socket.on('createPoll', async (data, callback) => {
    try {
      const { conversationId, question, options, settings, expiresIn } = data;
      
      if (!conversationId || !question || !options || options.length < 2) {
        throw new Error('Conversation ID, question, and at least 2 options are required');
      }
      
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      if (!conversation.participants.some(p => p.toString() === userId)) {
        throw new Error('Not a participant');
      }
      
      console.log(`📊 Creating poll in conversation ${conversationId}`);
      
      const receiver = conversation.participants.find(p => p.toString() !== userId);
      
      const pollData = {
        conversation: conversationId,
        creator: userId,
        question,
        options: options.map(text => ({ text, votes: [], voteCount: 0 })),
        settings: settings || {}
      };
      
      if (expiresIn) {
        pollData.expiresAt = new Date(Date.now() + expiresIn * 1000);
      }
      
      const messageData = {
        sender: userId,
        receiver,
        message: `📊 Poll: ${question}`,
        messageType: 'poll'
      };
      
      const { poll, message } = await Poll.createWithMessage(pollData, messageData);
      
      await poll.populate('creator', 'name images');
      
      // Notify participants
      conversation.participants.forEach(participantId => {
        if (participantId.toString() !== userId) {
          io.to(`user_${participantId}`).emit('newPoll', {
            poll,
            message,
            conversationId
          });
        }
      });
      
      if (callback) {
        callback({
          status: 'success',
          poll,
          message
        });
      }
      
      console.log(`✅ Poll created: ${poll._id}`);
      
    } catch (error) {
      console.error('❌ Create poll error:', error.message);
      if (callback) {
        callback({ status: 'error', error: error.message });
      }
    }
  });
  
  // Vote on poll
  socket.on('votePoll', async (data, callback) => {
    try {
      const { pollId, optionIndex } = data;
      
      if (!pollId || optionIndex === undefined) {
        throw new Error('Poll ID and option index are required');
      }
      
      const poll = await Poll.findById(pollId);
      
      if (!poll) {
        throw new Error('Poll not found');
      }
      
      console.log(`🗳️ Vote: ${userId} → poll ${pollId}, option ${optionIndex}`);
      
      await poll.vote(userId, optionIndex);
      
      const results = poll.getResults(userId);
      
      // Notify all participants
      const conversation = await Conversation.findById(poll.conversation);
      conversation.participants.forEach(participantId => {
        io.to(`user_${participantId}`).emit('pollVoteUpdate', {
          pollId,
          results,
          voterId: poll.settings.isAnonymous ? null : userId
        });
      });
      
      if (callback) {
        callback({
          status: 'success',
          results
        });
      }
      
    } catch (error) {
      console.error('❌ Vote poll error:', error.message);
      if (callback) {
        callback({ status: 'error', error: error.message });
      }
    }
  });
  
  // Close poll
  socket.on('closePoll', async (data, callback) => {
    try {
      const { pollId } = data;
      
      if (!pollId) {
        throw new Error('Poll ID is required');
      }
      
      const poll = await Poll.findById(pollId);
      
      if (!poll) {
        throw new Error('Poll not found');
      }
      
      if (poll.creator.toString() !== userId) {
        throw new Error('Only creator can close poll');
      }
      
      await poll.close(userId);
      
      // Notify all participants
      const conversation = await Conversation.findById(poll.conversation);
      conversation.participants.forEach(participantId => {
        io.to(`user_${participantId}`).emit('pollClosed', {
          pollId,
          results: poll.getResults(userId)
        });
      });
      
      if (callback) {
        callback({ status: 'success' });
      }
      
    } catch (error) {
      console.error('❌ Close poll error:', error.message);
      if (callback) {
        callback({ status: 'error', error: error.message });
      }
    }
  });
};

/**
 * Register disappearing message handlers
 */
const registerDisappearingMessageHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  // Send disappearing message
  socket.on('sendDisappearingMessage', async (data, callback) => {
    try {
      const { receiver, message, destructTimer, expiresIn } = data;
      
      if (!receiver || !message) {
        throw new Error('Receiver and message are required');
      }
      
      console.log(`💨 Disappearing message: ${userId} → ${receiver}`);
      
      const messageData = {
        sender: userId,
        receiver,
        message: message.trim(),
        selfDestruct: {
          enabled: true,
          destructAfterRead: destructTimer > 0,
          destructTimer: destructTimer || 0
        }
      };
      
      if (expiresIn) {
        messageData.selfDestruct.expiresAt = new Date(Date.now() + expiresIn * 1000);
      }
      
      const newMessage = await Message.create(messageData);
      
      const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender', 'name images')
        .populate('receiver', 'name images');
      
      // Update conversation
      await updateConversation(userId, receiver, newMessage._id);
      
      // Notify receiver
      io.to(`user_${receiver}`).emit('newDisappearingMessage', {
        message: populatedMessage,
        destructTimer: destructTimer || 0,
        expiresAt: messageData.selfDestruct.expiresAt
      });
      
      if (callback) {
        callback({
          status: 'success',
          message: populatedMessage
        });
      }
      
      console.log(`✅ Disappearing message delivered: ${userId} → ${receiver}`);
      
    } catch (error) {
      console.error('❌ Disappearing message error:', error.message);
      if (callback) {
        callback({ status: 'error', error: error.message });
      }
    }
  });
  
  // Trigger self-destruct after reading
  socket.on('triggerSelfDestruct', async (data) => {
    try {
      const { messageId } = data;
      
      if (!messageId) return;
      
      const message = await Message.findById(messageId);
      
      if (!message || message.receiver.toString() !== userId) return;
      
      if (message.selfDestruct && message.selfDestruct.enabled) {
        await message.triggerSelfDestruct();
        
        // Notify sender
        io.to(`user_${message.sender}`).emit('messageDestructTriggered', {
          messageId,
          destructAt: message.selfDestruct.destructAt
        });
        
        // Schedule deletion
        if (message.selfDestruct.destructTimer > 0) {
          setTimeout(async () => {
            await Message.findByIdAndDelete(messageId);
            
            // Notify both parties
            io.to(`user_${message.sender}`).emit('messageAutoDeleted', { messageId });
            io.to(`user_${message.receiver}`).emit('messageAutoDeleted', { messageId });
            
            console.log(`💥 Message ${messageId} self-destructed`);
          }, message.selfDestruct.destructTimer * 1000);
        }
      }
      
    } catch (error) {
      console.error('❌ Trigger self-destruct error:', error);
    }
  });
  
  // Manual acknowledge that message was viewed (for immediate destruction)
  socket.on('acknowledgeDisappearingMessage', async (data) => {
    try {
      const { messageId, senderId } = data;
      
      if (!messageId || !senderId) return;
      
      const message = await Message.findById(messageId);
      
      if (!message || message.receiver.toString() !== userId) return;
      
      // Mark as read
      message.read = true;
      message.readAt = new Date();
      await message.save();
      
      // Notify sender
      io.to(`user_${senderId}`).emit('disappearingMessageRead', {
        messageId,
        readAt: message.readAt,
        readBy: userId
      });
      
    } catch (error) {
      console.error('❌ Acknowledge disappearing message error:', error);
    }
  });
};

module.exports = {
  initializeSocket,
  getOnlineUsersCount,
  getOnlineUserIds
};