// COMPLETE FIXED SERVER CODE
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const colors = require('colors');
const fileUpload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middleware/error');
const connectDb = require('./config/db');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');

// Load env vars first
dotenv.config({ path: './config/config.env' });

// Connect to database
connectDb();

// Route files
const moments = require('./routes/moments');
const auth = require('./routes/auth');
const messages = require('./routes/messages');
const users = require('./routes/users');
const languages = require('./routes/languages');
const comments = require('./routes/comment');
const Message = require('./models/Message');

const app = express();

// FIXED: Proper trust proxy configuration
app.set('trust proxy', 1); // Trust only the first proxy

const server = http.createServer(app);

// Initialize Socket.IO with proper CORS and options
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://10.0.2.2:3000", // For Android emulator
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// FIXED: Proper rate limiting configuration
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10000, // limit each IP to 10000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true, // Enable trust proxy for rate limiter
  keyGenerator: (req) => {
    // Use the real IP from proxy headers or fallback to connection IP
    return req.ip || req.connection.remoteAddress;
  },
  // Skip rate limiting for localhost during development
  skip: (req) => {
    if (process.env.NODE_ENV === 'development') {
      const ip = req.ip || req.connection.remoteAddress;
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    }
    return false;
  },
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

// Middleware setup - FIXED ORDER
app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));

// CORS should be before other middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://10.0.2.2:3000",
    "http://localhost:3000"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(
  fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    abortOnLimit: true,
    createParentPath: true,
    useTempFiles: true,
    tempFileDir: '/tmp/'
  })
);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Security middleware
app.use(mongoSanitize());
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(xss());
app.use(limiter); // Apply the fixed rate limiter
app.use(hpp());
app.use(passport.initialize());

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Test route
app.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Test route is working!',
    ip: req.ip,
    headers: req.headers
  });
});

// API Routes
app.use('/api/v1/moments', moments);
app.use('/api/v1/auth', auth);
app.use('/api/v1/messages', messages);
app.use('/api/v1/auth/users', users);
app.use('/api/v1/languages', languages);
app.use('/api/v1/comments', comments);

// Error handling middleware (should be last)
app.use(errorHandler);

// FIXED: Socket.IO Authentication Middleware with better error handling
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization ||
                  socket.handshake.query.token;
    
    console.log('🔑 Socket auth attempt from:', socket.handshake.address);
    
    if (!token) {
      console.log('❌ Authentication error: No token provided');
      return next(new Error("Authentication error: No token provided"));
    }
    
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    
    socket.user = decoded;
    console.log(`✅ User authenticated: ${decoded.id}`);
    next();
  } catch (err) {
    console.log('❌ Authentication error:', err.message);
    return next(new Error("Authentication error: Invalid token"));
  }
});

// ENHANCED: Socket.IO connection handler with improved error handling
io.on('connection', async (socket) => {   
  console.log(`✅ User ${socket.user?.id} connected from ${socket.handshake.address}`);    
  
  // Validate user exists on socket   
  if (!socket.user?.id) {     
    console.log('❌ No user ID found - disconnecting');     
    socket.disconnect(true);     
    return;   
  }    
  
  // Join user to their own room   
  const userRoom = `user_${socket.user.id}`;   
  await socket.join(userRoom);   
  console.log(`👤 User ${socket.user.id} joined room: ${userRoom}`);
  
  // ENHANCED: Get online users and broadcast user coming online
  try {
    const connectedSockets = await io.fetchSockets();
    const onlineUsers = connectedSockets
      .filter(s => s.user?.id && s.user.id !== socket.user.id)
      .map(s => ({
        userId: s.user.id,
        status: 'online',
        lastSeen: null,
        socketId: s.id
      }));
    
    // Send current online users to newly connected user
    socket.emit('onlineUsers', onlineUsers);
    console.log(`📋 Sent ${onlineUsers.length} online users to ${socket.user.id}`);
    
    // Broadcast that this user came online
    socket.broadcast.emit('userStatusUpdate', {
      userId: socket.user.id,
      status: 'online',
      lastSeen: null
    });
    console.log(`📡 Broadcast: User ${socket.user.id} is now online`);
  } catch (error) {
    console.error('❌ Error handling online users:', error);
  }
  
  // ENHANCED: Handle sending messages with better validation
  socket.on('sendMessage', async ({ receiver, message }, callback) => {     
    try {       
      // Enhanced input validation       
      if (!receiver || !message || typeof message !== 'string') {         
        throw new Error('Missing or invalid required fields');       
      }
      
      if (message.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }
      
      if (message.length > 1000) {
        throw new Error('Message too long (max 1000 characters)');
      }
      
      console.log(`📤 Message from ${socket.user.id} to ${receiver}: ${message.substring(0, 50)}...`);        
      
      // Create and save the message to the database       
      const newMessage = await Message.create({          
        sender: socket.user.id,          
        receiver,          
        message: message.trim()
      });        
      
      // Populate sender and receiver info       
      const populatedMessage = await Message.findById(newMessage._id)         
        .populate('sender', 'name imageUrls')
        .populate('receiver', 'name imageUrls');        
      
      // Calculate unread count for the RECEIVER
      const unreadCountForReceiver = await Message.countDocuments({         
        receiver: receiver,
        sender: socket.user.id,
        read: false       
      });
      
      // Calculate unread count for the SENDER
      const unreadCountForSender = await Message.countDocuments({         
        receiver: socket.user.id,
        sender: receiver,
        read: false       
      });        
      
      // Prepare notification data
      const notificationDataForReceiver = {         
        message: populatedMessage,         
        unreadCount: unreadCountForReceiver,
        senderId: socket.user.id,
        type: 'newMessage'
      };        
      
      const notificationDataForSender = {         
        message: populatedMessage,         
        unreadCount: unreadCountForSender,
        receiverId: receiver,
        type: 'messageSent'
      };
      
      // Send to receiver's room       
      const receiverRoom = `user_${receiver}`;       
      io.to(receiverRoom).emit('newMessage', notificationDataForReceiver);              
      
      // Send acknowledgment to sender       
      if (callback) {
        callback({           
          status: 'success',           
          message: populatedMessage,           
          unreadCount: unreadCountForSender
        });
      }
      
      // Also emit to sender's room for real-time updates
      io.to(userRoom).emit('messageSent', notificationDataForSender);
      
      console.log(`📨 Message delivered to ${receiverRoom}, unread: ${unreadCountForReceiver}`);     
    } catch (err) {       
      console.error('❌ Message save error:', err);              
      
      const errorResponse = {           
        status: 'error',           
        error: err.message || 'Failed to send message'
      };
      
      if (callback) {         
        callback(errorResponse);       
      } else {         
        socket.emit('messageError', errorResponse);       
      }     
    }   
  });
  
  // ENHANCED: Handle marking messages as read with better error handling
  socket.on('markAsRead', async ({ senderId }, callback) => {
    try {
      if (!senderId) {
        throw new Error('Sender ID is required');
      }
      
      // Mark all messages from senderId to current user as read
      const result = await Message.updateMany(
        {
          sender: senderId,
          receiver: socket.user.id,
          read: false
        },
        { 
          read: true,
          readAt: new Date()
        }
      );
      
      console.log(`📖 Marked ${result.modifiedCount} messages as read for user ${socket.user.id} from ${senderId}`);
      
      // Notify the sender that their messages were read
      const senderRoom = `user_${senderId}`;
      io.to(senderRoom).emit('messagesRead', {
        readBy: socket.user.id,
        count: result.modifiedCount,
        timestamp: new Date().toISOString()
      });
      
      if (callback) {
        callback({
          status: 'success',
          markedCount: result.modifiedCount
        });
      }
      
    } catch (err) {
      console.error('❌ Mark as read error:', err);
      if (callback) {
        callback({
          status: 'error',
          error: err.message
        });
      }
    }
  });    
  
  // ENHANCED: Handle typing events with rate limiting
  let typingTimeout;
  const handleTypingEvent = (type) => {     
    return ({ receiver }) => {       
      if (!receiver) {         
        console.log('❌ Missing receiver in typing event');         
        return;       
      }        
      
      if (type === 'start') {         
        console.log(`⌨️ User ${socket.user.id} is typing to ${receiver}`);
        
        // Clear existing timeout
        if (typingTimeout) {
          clearTimeout(typingTimeout);
        }
        
        socket.to(`user_${receiver}`).emit('userTyping', {            
          userId: socket.user.id,           
          isTyping: true          
        });
        
        // Auto-stop typing after 5 seconds of inactivity
        typingTimeout = setTimeout(() => {
          socket.to(`user_${receiver}`).emit('userTyping', {            
            userId: socket.user.id,           
            isTyping: false          
          });
        }, 5000);
      } else {         
        console.log(`⌨️ User ${socket.user.id} stopped typing to ${receiver}`);
        
        if (typingTimeout) {
          clearTimeout(typingTimeout);
        }
        
        socket.to(`user_${receiver}`).emit('userTyping', {            
          userId: socket.user.id,           
          isTyping: false          
        });       
      }     
    };   
  };    
  
  socket.on('typing', handleTypingEvent('start'));   
  socket.on('stopTyping', handleTypingEvent('stop'));    
  
  // ENHANCED: Status handling with validation
  socket.on('updateStatus', async ({ status }) => {
    try {
      const validStatuses = ['online', 'away', 'busy', 'offline'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }
      
      console.log(`📡 User ${socket.user.id} status changed to: ${status}`);
      
      // Broadcast status to all users
      socket.broadcast.emit('userStatusUpdate', {
        userId: socket.user.id,
        status,
        lastSeen: status === 'offline' ? new Date().toISOString() : null,
        timestamp: new Date().toISOString()
      });
      
      console.log(`📡 Status broadcast: User ${socket.user.id} is now ${status}`);
    } catch (err) {
      console.error('❌ Status update error:', err);
      socket.emit('error', { message: err.message });
    }
  });
  
  // Quick status update handlers
  ['setAway', 'setBusy', 'setOnline'].forEach(eventName => {
    socket.on(eventName, () => {
      const status = eventName.replace('set', '').toLowerCase();
      console.log(`${status === 'online' ? '🟢' : status === 'away' ? '😴' : '🔴'} User ${socket.user.id} is now ${status}`);
      
      socket.broadcast.emit('userStatusUpdate', {
        userId: socket.user.id,
        status,
        lastSeen: null,
        timestamp: new Date().toISOString()
      });
    });
  });
  
  // ENHANCED: Get user status with better error handling
  socket.on('getUserStatus', async ({ userId }, callback) => {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Check if user is currently connected
      const connectedSockets = await io.fetchSockets();
      const userSocket = connectedSockets.find(s => s.user?.id === userId);
      
      if (userSocket) {
        callback({
          status: 'success',
          data: {
            userId,
            status: 'online',
            lastSeen: null,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        callback({
          status: 'success',
          data: {
            userId,
            status: 'offline',
            lastSeen: new Date().toISOString(),
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (err) {
      console.error('❌ Get user status error:', err);
      callback({
        status: 'error',
        error: err.message
      });
    }
  });
  
  // ENHANCED: Handle disconnection with cleanup
  socket.on('disconnect', (reason) => {     
    console.log(`❌ User ${socket.user?.id} disconnected: ${reason}`);
    
    // Clear typing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Broadcast offline status with timestamp
    socket.broadcast.emit('userStatusUpdate', {
      userId: socket.user.id,
      status: 'offline',
      lastSeen: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });
    
    console.log(`📡 Broadcast: User ${socket.user.id} is now offline`);
  });    
  
  // Handle connection errors   
  socket.on('error', (error) => {     
    console.log(`❌ Socket error for user ${socket.user?.id}:`, error);   
  }); 
});

// ENHANCED: Graceful shutdown handling
const gracefulShutdown = () => {
  console.log('\n⚠️ SIGINT received. Starting graceful shutdown...');
  
  // Close Socket.IO server
  io.close(() => {
    console.log('✅ Socket.IO server closed.');
    
    // Close HTTP server
    server.close(() => {
      console.log('✅ HTTP server closed.');
      process.exit(0);
    });
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.log('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
  console.log(`📡 Socket.IO server ready for connections`.green.bold);
});

// ENHANCED: Error handling with better logging
process.on('unhandledRejection', (err, promise) => {
  console.log(`❌ Unhandled Promise Rejection: ${err.message}`.red.bgBlack);
  console.log('Promise:', promise);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.log(`❌ Uncaught Exception: ${err.message}`.red.bgBlack);
  console.log(err.stack);
  process.exit(1);
});