// socket/socketHandler.js
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { resetDailyCounters } = require('../utils/limitations');
const LIMITS = require('../config/limitations');

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
    
    // Track this connection
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId).add(socket.id);
    
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
 * Handle user disconnection
 */
const handleDisconnect = (socket, io, reason) => {
  const userId = socket.user?.id;
  
  if (!userId) return;
  
  console.log(`❌ User ${userId} disconnected (socket: ${socket.id}): ${reason}`);
  
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

module.exports = {
  initializeSocket,
  getOnlineUsersCount,
  getOnlineUserIds
};