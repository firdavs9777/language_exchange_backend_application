const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Poll = require('../models/Poll');
const { resetDailyCounters } = require('../utils/limitations');
const LIMITS = require('../config/limitations');
const notificationService = require('../services/notificationService');
const { registerCallHandlers } = require('./callHandler');
const { registerAIConversationHandlers, registerGrammarFeedbackHandlers } = require('./aiConversationHandler');
const { registerVoiceRoomHandlers } = require('./voiceRoomHandler');
const learningTrackingService = require('../services/learningTrackingService');
const { detectLanguage } = require('../services/translationService');



// Allow multiple connections per user (different devices/tabs)
const userConnections = new Map();

// Store socket metadata (socketId -> { userId, deviceId, connectedAt })
const socketMetadata = new Map();

// Store typing timeouts with auto-cleanup
const typingTimeouts = new Map();

// Cache online users (userId -> { status, lastSeen, deviceCount })
const onlineUsersCache = new Map();

// Message queue for offline users (userId -> [messages])
const offlineMessageQueue = new Map();

// Connection state tracking
const connectionStates = new Map(); // socketId -> 'connecting' | 'connected' | 'disconnecting'

// ========== CONFIGURATION ==========

const SOCKET_CONFIG = {
  MAX_CONNECTIONS_PER_USER: 5,
  TYPING_TIMEOUT: 5000,
  MESSAGE_RETRY_ATTEMPTS: 3,
  MESSAGE_RETRY_DELAY: 1000,
  HEARTBEAT_INTERVAL: 25000,
  HEARTBEAT_TIMEOUT: 30000,
  OFFLINE_MESSAGE_QUEUE_MAX: 50,
  CLEANUP_INTERVAL: 60000, // Clean up stale data every minute
};

/**
 * Socket.IO Authentication Middleware
 */
const socketAuth = (socket, next) => {
  try {
    const token = socket.handshake.auth.token ||
                  socket.handshake.headers.authorization ||
                  socket.handshake.query.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);

    // Extract device ID for multi-device support
    const deviceId = socket.handshake.query.deviceId || socket.handshake.auth.deviceId || 'default';

    socket.user = decoded;
    socket.deviceId = deviceId;
    socket.tokenExp = decoded.exp; // Store token expiry

    console.log(`🔐 Socket auth success - userId: ${decoded.id}, deviceId: ${deviceId}`);
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
};

/**
 * Setup token expiry monitoring
 * Notifies client before token expires so they can refresh
 */
const setupTokenExpiryMonitor = (socket) => {
  const tokenExp = socket.tokenExp;
  if (!tokenExp) return;

  const expiresAt = tokenExp * 1000; // Convert to milliseconds
  const warningTime = 5 * 60 * 1000; // Warn 5 minutes before expiry
  const checkInterval = 60 * 1000; // Check every minute

  const tokenCheckInterval = setInterval(() => {
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    if (timeUntilExpiry <= 0) {
      // Token expired - disconnect with reason
      socket.emit('tokenExpired', {
        reason: 'token_expired',
        timestamp: new Date().toISOString()
      });
      clearInterval(tokenCheckInterval);
      socket.disconnect(true);
    } else if (timeUntilExpiry <= warningTime) {
      // Token expiring soon - notify client
      socket.emit('tokenExpiring', {
        expiresIn: Math.floor(timeUntilExpiry / 1000), // Seconds until expiry
        expiresAt: new Date(expiresAt).toISOString()
      });
    }
  }, checkInterval);

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    clearInterval(tokenCheckInterval);
  });

  // Store interval reference for potential cleanup
  socket.tokenCheckInterval = tokenCheckInterval;
};

/**
 * Initialize Socket.IO with all event handlers
 */
const initializeSocket = (io) => {
  
  // Apply authentication middleware
  io.use(socketAuth);
  
  // Start periodic cleanup
  startPeriodicCleanup();
  
  // Handle new connections
  io.on('connection', async (socket) => {
    const userId = socket.user?.id;
    const deviceId = socket.deviceId;
    
    if (!userId) {
      console.log('❌ No user ID - disconnecting socket');
      socket.disconnect(true);
      return;
    }

    // Verify user exists in database
    const userExists = await User.findById(userId).select('_id name email');
    if (!userExists) {
      console.error(`❌ User ${userId} not found in database - disconnecting socket`);
      socket.emit('error', { message: 'User not found. Please log in again.' });
      socket.disconnect(true);
      return;
    }
    console.log(`✅ User verified: ${userExists.name || userExists.email} (${userId})`);

    // Set connection state
    connectionStates.set(socket.id, 'connecting');

    console.log(`✅ User ${userId} connecting (socket: ${socket.id}, device: ${deviceId})`);
    
    // Handle multiple connections intelligently
    await handleMultipleConnections(socket, io, userId, deviceId);
    
    // Store socket metadata
    socketMetadata.set(socket.id, {
      userId,
      deviceId,
      connectedAt: new Date(),
    });
    
    // Track this connection
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId).add(socket.id);
    
    // Update connection state
    connectionStates.set(socket.id, 'connected');
    
    // Update online users cache
    updateOnlineCache(userId);
    
    // Join user's personal room
    const userRoom = `user_${userId}`;
    await socket.join(userRoom);
    console.log(`👤 User ${userId} joined room: ${userRoom}`);
    
    // Setup heartbeat
    setupHeartbeat(socket, io);
    
    // Send queued offline messages
    await sendQueuedMessages(socket, userId);
    
    // Send online users list
    sendOnlineUsers(socket);
    
    // Broadcast online status
    broadcastUserStatus(socket, io, userId, 'online');

    // Send connection verified event to client
    socket.emit('connectionVerified', {
      userId,
      socketId: socket.id,
      connectedAt: new Date().toISOString(),
      deviceId
    });

    // Setup token expiry monitoring
    setupTokenExpiryMonitor(socket);

    // Register event handlers
    registerMessageHandlers(socket, io);
    registerTypingHandlers(socket, io);
    registerStatusHandlers(socket, io);
    registerPresenceHandlers(socket, io);
    registerLogoutHandlers(socket, io);
    
    // Advanced features
    registerVoiceMessageHandlers(socket, io);
    registerCorrectionHandlers(socket, io);
    registerPollHandlers(socket, io);
    registerDisappearingMessageHandlers(socket, io);
    registerCallHandlers(socket, io);
    registerVoiceRoomHandlers(socket, io);
    registerAIConversationHandlers(socket, io);
    registerGrammarFeedbackHandlers(socket, io);

    // Handle disconnection
    socket.on('disconnect', (reason) => handleDisconnect(socket, io, reason));
    
    // Handle errors
    socket.on('error', (error) => handleSocketError(socket, error));
    
    console.log(`🎉 User ${userId} fully connected (total connections: ${userConnections.get(userId).size})`);
  });
  
  return io;
};



/**
 * Handle multiple connections from same user
 */
const handleMultipleConnections = async (socket, io, userId, deviceId) => {
  if (!userConnections.has(userId)) {
    return; // First connection
  }
  
  const existingConnections = userConnections.get(userId);
  
  console.log(`📱 User ${userId} has ${existingConnections.size} existing connection(s)`);
  
  // Check max connections limit
  if (existingConnections.size >= SOCKET_CONFIG.MAX_CONNECTIONS_PER_USER) {
    console.log(`⚠️ Max connections reached for user ${userId}, removing oldest`);
    
    // Find oldest connection and disconnect it
    let oldestSocket = null;
    let oldestTime = Date.now();
    
    for (const socketId of existingConnections) {
      const metadata = socketMetadata.get(socketId);
      if (metadata && metadata.connectedAt < oldestTime) {
        oldestTime = metadata.connectedAt;
        oldestSocket = io.sockets.sockets.get(socketId);
      }
    }
    
    if (oldestSocket) {
      oldestSocket.emit('forceDisconnect', {
        reason: 'max_connections',
        message: 'New connection established from another device'
      });
      oldestSocket.disconnect(true);
    }
  }
  
  // Clean up any stale connections
  const staleConnections = [];
  for (const socketId of existingConnections) {
    const existingSocket = io.sockets.sockets.get(socketId);
    if (!existingSocket || !existingSocket.connected) {
      staleConnections.push(socketId);
    }
  }
  
  // Remove stale connections
  staleConnections.forEach(socketId => {
    existingConnections.delete(socketId);
    socketMetadata.delete(socketId);
    connectionStates.delete(socketId);
  });
  
  if (staleConnections.length > 0) {
    console.log(`🧹 Cleaned up ${staleConnections.length} stale connection(s) for user ${userId}`);
  }
};

/**
 * Setup heartbeat to detect dead connections
 */
const setupHeartbeat = (socket, io) => {
  let heartbeatTimeout;
  
  // Send ping every 25 seconds
  const pingInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('ping');
      
      // Expect pong within 5 seconds
      heartbeatTimeout = setTimeout(() => {
        console.log(`💔 Heartbeat timeout for socket ${socket.id}`);
        socket.disconnect(true);
      }, SOCKET_CONFIG.HEARTBEAT_TIMEOUT - SOCKET_CONFIG.HEARTBEAT_INTERVAL);
    } else {
      clearInterval(pingInterval);
      clearTimeout(heartbeatTimeout);
    }
  }, SOCKET_CONFIG.HEARTBEAT_INTERVAL);
  
  // Handle pong response
  socket.on('pong', () => {
    clearTimeout(heartbeatTimeout);
  });
  
  // Cleanup on disconnect
  socket.on('disconnect', () => {
    clearInterval(pingInterval);
    clearTimeout(heartbeatTimeout);
  });
};

/**
 * Update online users cache
 */
const updateOnlineCache = (userId) => {
  const connections = userConnections.get(userId);
  const deviceCount = connections ? connections.size : 0;
  
  onlineUsersCache.set(userId, {
    userId,
    status: 'online',
    lastSeen: null,
    deviceCount,
    updatedAt: new Date()
  });
};

/**
 * Send queued offline messages
 */
const sendQueuedMessages = async (socket, userId) => {
  try {
    if (!offlineMessageQueue.has(userId)) {
      return;
    }
    
    const queuedMessages = offlineMessageQueue.get(userId) || [];
    
    if (queuedMessages.length === 0) {
      return;
    }
    
    console.log(`📬 Sending ${queuedMessages.length} queued message(s) to user ${userId}`);
    
    for (const msgData of queuedMessages) {
      socket.emit('newMessage', msgData);
      await new Promise(resolve => setTimeout(resolve, 100)); // Throttle
    }
    
    // Clear queue
    offlineMessageQueue.delete(userId);
    
  } catch (error) {
    console.error('❌ Error sending queued messages:', error);
  }
};

/**
 * Send list of currently online users
 */
const sendOnlineUsers = (socket) => {
  try {
    const onlineUsers = Array.from(onlineUsersCache.values())
      .filter(u => u.userId !== socket.user.id)
      .map(u => ({
        userId: u.userId,
        status: u.status,
        lastSeen: u.lastSeen,
        deviceCount: u.deviceCount
      }));
    
    socket.emit('onlineUsers', onlineUsers);
    console.log(`📋 Sent ${onlineUsers.length} online users to ${socket.user.id}`);
  } catch (error) {
    console.error('❌ Error sending online users:', error);
  }
};

/**
 * Broadcast user status change
 */
const broadcastUserStatus = (socket, io, userId, status) => {
  const statusData = {
    userId,
    status,
    lastSeen: status === 'offline' ? new Date().toISOString() : null,
    deviceCount: userConnections.get(userId)?.size || 0
  };

  // Update cache
  if (status === 'online') {
    updateOnlineCache(userId);

    // Persist online status to database (don't await to avoid blocking)
    User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastSeen: null // Clear lastSeen when online
    }).catch(err => console.error(`❌ Failed to update online status for ${userId}:`, err));
  } else {
    onlineUsersCache.set(userId, {
      userId,
      status,
      lastSeen: new Date(),
      deviceCount: 0,
      updatedAt: new Date()
    });
  }

  socket.broadcast.emit('userStatusUpdate', statusData);
};

/**
 * Register message-related event handlers
 */
const registerMessageHandlers = (socket, io) => {
  // Get userId at registration time, but also verify at send time
  const registeredUserId = socket.user.id;
  console.log(`📝 Registering message handlers for user: ${registeredUserId}`);

  // Send message with retry logic
  socket.on('sendMessage', async (data, callback) => {
    // Always use fresh userId from socket in case it changed
    const userId = socket.user?.id || registeredUserId;
    try {
      const receiver = data?.receiver || data?.receiverId;
      let messageText = data?.message || data?.text || data?.content;

      // Validation
      if (!receiver) {
        throw new Error('Receiver ID is required');
      }

      if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
        throw new Error('Message text is required');
      }

      // Max message length validation (10KB to prevent abuse)
      const MAX_MESSAGE_LENGTH = 10000;
      if (messageText.length > MAX_MESSAGE_LENGTH) {
        throw new Error(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
      }

      // Basic sanitization - trim whitespace
      messageText = messageText.trim();

      // Validate receiver ID format (MongoDB ObjectId)
      if (!/^[0-9a-fA-F]{24}$/.test(receiver)) {
        throw new Error('Invalid receiver ID format');
      }

      // Prevent self-messaging
      if (receiver === userId) {
        throw new Error('Cannot send message to yourself');
      }

      console.log(`📤 Message: ${userId} → ${receiver}`);
      console.log(`🔍 Looking up sender with userId: "${userId}" (type: ${typeof userId})`);

      // Get sender user and check limits
      const senderUser = await User.findById(userId);
      if (!senderUser) {
        console.error(`❌ Sender not found in database: "${userId}"`);
        console.error(`   socket.user:`, JSON.stringify(socket.user));
        throw new Error('Sender not found');
      }
      console.log(`✅ Found sender: ${senderUser.name || senderUser.email}`);
      
      // Reset daily counters if new day
      await resetDailyCounters(senderUser);
      await senderUser.save();
      
      // Check block status
      if (senderUser.isBlocked(receiver) || senderUser.isBlockedBy(receiver)) {
        throw new Error('Cannot send message to blocked user');
      }

      // Check first-time conversation limit (max 5 messages until they reply)
      const FIRST_CHAT_MESSAGE_LIMIT = 5;

      // Check if receiver has ever sent a message to sender (i.e., they've replied)
      const receiverHasReplied = await Message.exists({
        sender: receiver,
        receiver: userId
      });

      if (!receiverHasReplied) {
        // This is a one-way conversation - check how many messages sender has sent
        const messagesSentToReceiver = await Message.countDocuments({
          sender: userId,
          receiver: receiver
        });

        if (messagesSentToReceiver >= FIRST_CHAT_MESSAGE_LIMIT) {
          throw new Error(
            `You can only send ${FIRST_CHAT_MESSAGE_LIMIT} messages until ${senderUser.name ? 'they' : 'this user'} replies. Please wait for a response.`
          );
        }

        console.log(`📊 First chat limit: ${messagesSentToReceiver + 1}/${FIRST_CHAT_MESSAGE_LIMIT} messages to new user`);
      }

      // Check daily message limit
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
        .populate('sender', 'name images userMode')
        .populate('receiver', 'name images userMode');
      
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
      
      const messagePayload = {
        message: populatedMessage,
        unreadCount: unreadForReceiver,
        senderId: userId
      };
      
      // Try to send to receiver with retry
      const sent = await sendMessageWithRetry(io, receiver, 'newMessage', messagePayload);

      // If receiver is offline, queue the message
      if (!sent) {
        queueOfflineMessage(receiver, messagePayload);
      }

      // IMPORTANT: Always send push notification regardless of socket status
      // User might be "online" on web but have mobile app in background
      // Push notifications are handled by user preferences on the recipient side
      notificationService.sendChatMessage(
        receiver,
        userId,
        {
          _id: newMessage._id,
          text: messageText,
          conversation: newMessage.conversation
        }
      ).catch(err => console.error('Push notification failed:', err));
      
      // Send acknowledgment to sender
      const senderResponse = {
        status: 'success',
        message: populatedMessage,
        unreadCount: unreadForSender,
        delivered: sent,
        queued: !sent // Add queued flag for better client handling
      };

      // Safe callback check
      if (callback && typeof callback === 'function') {
        callback(senderResponse);
      }
      
      // Emit to sender's other devices
      socket.to(`user_${userId}`).emit('messageSent', {
        message: populatedMessage,
        unreadCount: unreadForSender,
        receiverId: receiver
      });
      
      console.log(`✅ Message ${sent ? 'delivered' : 'queued'}: ${userId} → ${receiver}`);

      // Track message for learning progress (async, don't block)
      if (messageText && messageText.length > 0) {
        detectLanguage(messageText).then(detectedLang => {
          learningTrackingService.trackMessage({
            userId,
            conversationId: newMessage.conversation,
            messageId: newMessage._id,
            partnerId: receiver,
            messageText,
            detectedLanguage: detectedLang
          }).catch(err => console.error('Learning tracking error:', err.message));
        }).catch(err => console.error('Language detection error:', err.message));
      }

    } catch (error) {
      console.error('❌ Send message error:', error.message);

      const errorResponse = {
        status: 'error',
        error: error.message
      };

      // Safe callback check
      if (callback && typeof callback === 'function') {
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

      // Decrement badge count for the messages that were marked as read
      if (result.modifiedCount > 0) {
        try {
          await User.findByIdAndUpdate(
            userId,
            {
              $inc: { 'badges.unreadMessages': -result.modifiedCount }
            },
            { new: true }
          );
          // Ensure badge doesn't go negative
          await User.updateOne(
            { _id: userId, 'badges.unreadMessages': { $lt: 0 } },
            { $set: { 'badges.unreadMessages': 0 } }
          );
          console.log(`📊 Decremented badge count by ${result.modifiedCount} for user ${userId}`);
        } catch (badgeError) {
          console.error('❌ Error updating badge count:', badgeError.message);
        }
      }

      // Notify sender reliably
      await sendMessageWithRetry(io, senderId, 'messagesRead', {
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
      
      const receiverId = message.receiver.toString();
      
      await message.deleteOne();
      
      // Notify receiver reliably
      await sendMessageWithRetry(io, receiverId, 'messageDeleted', {
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
 * Send message with retry logic
 */
const sendMessageWithRetry = async (io, userId, event, data, attempts = SOCKET_CONFIG.MESSAGE_RETRY_ATTEMPTS) => {
  const userRoom = `user_${userId}`;
  
  for (let i = 0; i < attempts; i++) {
    try {
      // Check if user is online
      if (!userConnections.has(userId)) {
        console.log(`📴 User ${userId} offline - cannot send ${event}`);
        return false;
      }
      
      // Get all sockets for this user
      const sockets = await io.in(userRoom).fetchSockets();
      
      if (sockets.length === 0) {
        console.log(`📴 No sockets found for user ${userId}`);
        return false;
      }
      
      // Send to all user's devices
      io.to(userRoom).emit(event, data);
      
      console.log(`📨 Sent ${event} to ${sockets.length} device(s) of user ${userId}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Retry ${i + 1}/${attempts} failed for ${event}:`, error.message);
      
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, SOCKET_CONFIG.MESSAGE_RETRY_DELAY * (i + 1)));
      }
    }
  }
  
  return false;
};

/**
 * Queue message for offline user
 */
const queueOfflineMessage = (userId, messageData) => {
  if (!offlineMessageQueue.has(userId)) {
    offlineMessageQueue.set(userId, []);
  }
  
  const queue = offlineMessageQueue.get(userId);
  
  // Add to queue
  queue.push(messageData);
  
  // Limit queue size
  if (queue.length > SOCKET_CONFIG.OFFLINE_MESSAGE_QUEUE_MAX) {
    queue.shift(); // Remove oldest
  }
  
  console.log(`📬 Queued message for offline user ${userId} (queue: ${queue.length})`);
};

/**
 * Register typing indicator handlers with auto-cleanup
 */
// Around line 600 in socketHandler.js
const registerTypingHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  socket.on('typing', (data) => {
    try {
      const receiver = data?.receiver || data?.receiverId;
      
      if (!receiver) {
        console.log('⚠️ Typing event missing receiver');
        return;
      }
      
      console.log(`⌨️ ${userId} typing to ${receiver}`);
      
      const timeoutKey = `${userId}-${receiver}`;
      
      // Clear existing timeout
      if (typingTimeouts.has(timeoutKey)) {
        clearTimeout(typingTimeouts.get(timeoutKey));
      }
      
      // Send typing event with userId field
      io.to(`user_${receiver}`).emit('userTyping', {
        userId,
        user: userId, // Add fallback field
        isTyping: true
      });
      
      // Auto-stop after 5 seconds
      const timeout = setTimeout(() => {
        io.to(`user_${receiver}`).emit('userStoppedTyping', {
          userId,
          user: userId, // Add fallback field
          isTyping: false
        });
        typingTimeouts.delete(timeoutKey);
      }, SOCKET_CONFIG.TYPING_TIMEOUT);
      
      typingTimeouts.set(timeoutKey, timeout);
      
    } catch (error) {
      console.error('❌ Typing error:', error);
    }
  });
  
  socket.on('stopTyping', (data) => {
    try {
      const receiver = data?.receiver || data?.receiverId;
      
      if (!receiver) {
        console.log('⚠️ Stop typing event missing receiver');
        return;
      }
      
      const timeoutKey = `${userId}-${receiver}`;
      
      // Clear timeout
      if (typingTimeouts.has(timeoutKey)) {
        clearTimeout(typingTimeouts.get(timeoutKey));
        typingTimeouts.delete(timeoutKey);
      }
      
      io.to(`user_${receiver}`).emit('userStoppedTyping', {
        userId,
        user: userId, // Add fallback field
        isTyping: false
      });
      
      console.log(`⌨️ ${userId} stopped typing to ${receiver}`);
      
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
  
  socket.on('updateStatus', (data) => {
    try {
      const status = data?.status;
      const validStatuses = ['online', 'away', 'busy', 'offline'];
      
      if (!status || !validStatuses.includes(status)) {
        return;
      }
      
      console.log(`📡 User ${userId} status: ${status}`);
      
      broadcastUserStatus(socket, io, userId, status);
      
    } catch (error) {
      console.error('❌ Status update error:', error);
    }
  });
};

/**
 * Register presence-related handlers
 */
// Register presence-related handlers
const registerPresenceHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  socket.on('getUserStatus', async (data, callback) => {
    try {
      const targetUserId = data?.userId;
      
      if (!targetUserId) {
        throw new Error('User ID is required');
      }
      
      const cachedStatus = onlineUsersCache.get(targetUserId);
      
      const response = cachedStatus ? {
        status: 'success',
        data: {
          userId: targetUserId,
          status: cachedStatus.status,
          lastSeen: cachedStatus.lastSeen,
          deviceCount: cachedStatus.deviceCount
        }
      } : {
        status: 'success',
        data: {
          userId: targetUserId,
          status: 'offline',
          lastSeen: new Date().toISOString(),
          deviceCount: 0
        }
      };
      
      // FIX: Check if callback exists before calling
      if (callback && typeof callback === 'function') {
        callback(response);
      } else {
        // If no callback, emit response directly
        socket.emit('userStatusUpdate', response.data);
      }
      
    } catch (error) {
      console.error('❌ Get user status error:', error.message);
      
      if (callback && typeof callback === 'function') {
        callback({
          status: 'error',
          error: error.message
        });
      }
    }
  });
  
  socket.on('requestStatusUpdates', async (data) => {
    try {
      const userIds = data?.userIds || [];
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return;
      }
      
      console.log(`📊 Requesting status for ${userIds.length} users`);
      
      const statusUpdates = {};
      
      for (const targetId of userIds) {
        const cachedStatus = onlineUsersCache.get(targetId);
        
        if (cachedStatus) {
          statusUpdates[targetId] = {
            status: cachedStatus.status,
            lastSeen: cachedStatus.lastSeen,
            deviceCount: cachedStatus.deviceCount
          };
        } else {
          statusUpdates[targetId] = {
            status: 'offline',
            lastSeen: new Date().toISOString(),
            deviceCount: 0
          };
        }
      }
      
      socket.emit('bulkStatusUpdate', statusUpdates);
      
    } catch (error) {
      console.error('❌ Request status updates error:', error);
    }
  });
};

/**
 * Register logout handlers
 */
const registerLogoutHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  socket.on('logout', async (data, callback) => {
    try {
      console.log(`👋 User ${userId} logging out (socket: ${socket.id})`);
      
      // Clean up typing indicators
      cleanupTypingIndicators(userId);
      
      // Mark as disconnecting
      connectionStates.set(socket.id, 'disconnecting');
      
      // Remove from connections
      if (userConnections.has(userId)) {
        userConnections.get(userId).delete(socket.id);
        
        if (userConnections.get(userId).size === 0) {
          userConnections.delete(userId);
          onlineUsersCache.delete(userId);
          
          // Broadcast offline status
          socket.broadcast.emit('userStatusUpdate', {
            userId,
            status: 'offline',
            lastSeen: new Date().toISOString(),
            deviceCount: 0
          });
        } else {
          // Update device count
          updateOnlineCache(userId);
          
          socket.broadcast.emit('userStatusUpdate', {
            userId,
            status: 'online',
            lastSeen: null,
            deviceCount: userConnections.get(userId).size
          });
        }
      }
      
      // Remove metadata
      socketMetadata.delete(socket.id);
      connectionStates.delete(socket.id);
      
      console.log(`✅ User ${userId} logged out successfully`);
      
      if (callback) {
        callback({
          status: 'success',
          message: 'Logged out successfully'
        });
      }
      
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
 * Handle socket errors
 */
const handleSocketError = (socket, error) => {
  const userId = socket.user?.id;
  
  console.error(`❌ Socket error for user ${userId} (socket: ${socket.id}):`, error);
  
  // Try to recover or disconnect cleanly
  if (error.message.includes('Authentication')) {
    socket.emit('authError', { message: 'Please login again' });
    socket.disconnect(true);
  }
};

/**
 * Map Socket.IO disconnect reasons to user-friendly reasons
 */
const mapDisconnectReason = (reason) => {
  const reasonMap = {
    'io server disconnect': 'server_disconnect',
    'io client disconnect': 'client_disconnect',
    'ping timeout': 'connection_timeout',
    'transport close': 'connection_lost',
    'transport error': 'connection_error',
    'server shutting down': 'maintenance',
    'forced close': 'forced_disconnect'
  };
  return reasonMap[reason] || reason;
};

/**
 * Gracefully disconnect a user with a reason
 * @param {Socket} socket - The socket to disconnect
 * @param {string} reason - The disconnect reason
 */
const gracefulDisconnect = (socket, reason) => {
  try {
    // Emit disconnect reason before disconnecting
    socket.emit('disconnectReason', {
      reason,
      timestamp: new Date().toISOString()
    });

    // Small delay to ensure message is sent
    setTimeout(() => {
      socket.disconnect(true);
    }, 100);
  } catch (error) {
    socket.disconnect(true);
  }
};

/**
 * Handle user disconnection
 */
const handleDisconnect = async (socket, io, reason) => {
  const userId = socket.user?.id;

  if (!userId) return;

  const friendlyReason = mapDisconnectReason(reason);
  console.log(`❌ User ${userId} disconnected (socket: ${socket.id}): ${friendlyReason}`);
  
  // Mark as disconnecting
  connectionStates.set(socket.id, 'disconnecting');
  
  // Clean up typing indicators
  cleanupTypingIndicators(userId);
  
  // Remove from connections
  if (userConnections.has(userId)) {
    userConnections.get(userId).delete(socket.id);

    if (userConnections.get(userId).size === 0) {
      // Last connection - user is now offline
      userConnections.delete(userId);
      onlineUsersCache.delete(userId);

      const lastSeenTime = new Date();

      console.log(`📴 User ${userId} is now offline`);

      // Persist lastSeen to database (don't await to avoid blocking)
      User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: lastSeenTime
      }).catch(err => console.error(`❌ Failed to update lastSeen for ${userId}:`, err));

      socket.broadcast.emit('userStatusUpdate', {
        userId,
        status: 'offline',
        lastSeen: lastSeenTime.toISOString(),
        deviceCount: 0
      });
    } else {
      // Still has other connections
      updateOnlineCache(userId);

      console.log(`📱 User ${userId} still has ${userConnections.get(userId).size} connection(s)`);

      socket.broadcast.emit('userStatusUpdate', {
        userId,
        status: 'online',
        lastSeen: null,
        deviceCount: userConnections.get(userId).size
      });
    }
  }
  
  // Remove metadata
  socketMetadata.delete(socket.id);
  connectionStates.delete(socket.id);
  
  // Clear socket user data
  socket.user = null;
};

/**
 * Clean up typing indicators for user
 */
const cleanupTypingIndicators = (userId) => {
  const keysToDelete = [];
  
  for (const [key, timeout] of typingTimeouts.entries()) {
    if (key.startsWith(userId)) {
      clearTimeout(timeout);
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => typingTimeouts.delete(key));
  
  if (keysToDelete.length > 0) {
    console.log(`🧹 Cleaned up ${keysToDelete.length} typing indicator(s) for user ${userId}`);
  }
};

/**
 * Periodic cleanup of stale data
 */
const startPeriodicCleanup = () => {
  setInterval(() => {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      // Clean up stale online cache entries (older than 5 minutes)
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

      for (const [userId, data] of onlineUsersCache.entries()) {
        if (data.status === 'offline' && data.updatedAt < fiveMinutesAgo) {
          onlineUsersCache.delete(userId);
          cleanedCount++;
        }
      }

      // Clean up stale connection states
      for (const [socketId, state] of connectionStates.entries()) {
        if (state === 'disconnecting' && !socketMetadata.has(socketId)) {
          connectionStates.delete(socketId);
          cleanedCount++;
        }
      }

      // Clean up orphaned socket metadata (sockets that no longer exist)
      const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);
      for (const [socketId, metadata] of socketMetadata.entries()) {
        if (metadata.connectedAt < thirtyMinutesAgo) {
          // Check if this socket is still tracked in userConnections
          const userId = metadata.userId;
          if (userConnections.has(userId) && !userConnections.get(userId).has(socketId)) {
            socketMetadata.delete(socketId);
            connectionStates.delete(socketId);
            cleanedCount++;
          }
        }
      }

      // Clean up empty userConnections entries
      for (const [userId, sockets] of userConnections.entries()) {
        if (sockets.size === 0) {
          userConnections.delete(userId);
          cleanedCount++;
        }
      }

      // Clean up stale typing timeouts (shouldn't happen, but safety check)
      for (const [key, timeout] of typingTimeouts.entries()) {
        // Typing keys are formatted as "userId-toUserId" (hyphen, not underscore)
        const parts = key.split('-');
        const userId = parts[0];
        if (!userConnections.has(userId)) {
          clearTimeout(timeout);
          typingTimeouts.delete(key);
          cleanedCount++;
        }
      }

      // Clean up old queued messages (older than 24 hours)
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      for (const [userId, messages] of offlineMessageQueue.entries()) {
        const filtered = messages.filter(msg => {
          const msgTime = new Date(msg.message?.createdAt).getTime();
          return msgTime > oneDayAgo;
        });

        if (filtered.length === 0) {
          offlineMessageQueue.delete(userId);
          cleanedCount++;
        } else if (filtered.length < messages.length) {
          offlineMessageQueue.set(userId, filtered);
          cleanedCount += messages.length - filtered.length;
        }
      }

      // Log memory stats periodically (only if something was cleaned)
      if (cleanedCount > 0 || process.env.NODE_ENV === 'development') {
        const stats = {
          userConnections: userConnections.size,
          socketMetadata: socketMetadata.size,
          onlineUsersCache: onlineUsersCache.size,
          typingTimeouts: typingTimeouts.size,
          offlineQueues: offlineMessageQueue.size,
          connectionStates: connectionStates.size,
          cleaned: cleanedCount
        };
        console.log('🧹 Socket cleanup:', JSON.stringify(stats));
      }

    } catch (error) {
      console.error('❌ Periodic cleanup error:', error);
    }
  }, SOCKET_CONFIG.CLEANUP_INTERVAL);
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
 * Get online users count
 */
const getOnlineUsersCount = () => {
  return userConnections.size;
};

/**
 * Get all online user IDs
 */
const getOnlineUserIds = () => {
  return Array.from(userConnections.keys());
};

/**
 * Get connection info for debugging
 */
const getConnectionInfo = () => {
  return {
    totalUsers: userConnections.size,
    totalSockets: Array.from(userConnections.values()).reduce((sum, set) => sum + set.size, 0),
    onlineCacheSize: onlineUsersCache.size,
    queuedMessagesCount: offlineMessageQueue.size,
    typingIndicators: typingTimeouts.size
  };
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
        .populate('sender', 'name images userMode')
        .populate('receiver', 'name images userMode');
      
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

      // Track correction for learning progress (async)
      learningTrackingService.trackCorrectionGiven({
        userId,
        conversationId: message.conversation,
        messageId,
        partnerId: message.sender,
        originalText: message.message,
        correctedText,
        explanation
      }).catch(err => console.error('Correction tracking error:', err.message));

      // Also track that the message sender received a correction
      learningTrackingService.trackCorrectionReceived({
        userId: message.sender,
        conversationId: message.conversation,
        messageId,
        partnerId: userId,
        originalText: message.message,
        correctedText,
        explanation
      }).catch(err => console.error('Correction received tracking error:', err.message));

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

      // Track correction acceptance for learning progress (async)
      if (correction && correction.corrector) {
        learningTrackingService.trackCorrectionAccepted({
          userId,
          conversationId: message.conversation,
          messageId,
          partnerId: correction.corrector
        }).catch(err => console.error('Correction accepted tracking error:', err.message));
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
        .populate('sender', 'name images userMode')
        .populate('receiver', 'name images userMode');
      
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
  getOnlineUserIds,
    getConnectionInfo
};

