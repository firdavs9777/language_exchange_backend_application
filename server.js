// COMPLETELY FIXED SERVER CODE - NO CORS ISSUES - FINAL VERSION
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
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

const server = http.createServer(app);

// CORS DOMAINS
const allowedOrigins = [
  "http://localhost:3000",
  "http://10.0.2.2:3000",
  "http://banatalk.com",
  "https://banatalk.com",
  "http://www.banatalk.com", 
  "https://www.banatalk.com",
  "http://api.banatalk.com",
  "https://api.banatalk.com"
];

// Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for Socket.IO
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling']
});

// Middleware setup in correct order
app.use(cookieParser());

// ULTRA-PERMISSIVE CORS - MANUAL HEADERS (REPLACES THE CORS MIDDLEWARE)
app.use((req, res, next) => {
  const origin = req.get('Origin');
  console.log(`🌐 ${req.method} request from: ${origin || 'no-origin'} to ${req.path}`);
  
  // Set CORS headers manually - allow everything
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Access-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Preflight request handled for:', origin);
    return res.status(200).end();
  }
  
  next();
});

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  abortOnLimit: true,
  createParentPath: true,
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(mongoSanitize());
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false 
}));
app.use(xss());

// FIXED: Rate limiting configuration
app.use(rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  },
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
}));

app.use(hpp());
app.use(passport.initialize());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    origin: req.get('Origin')
  });
});

// Test route with CORS info
app.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Test route working!',
    origin: req.get('Origin'),
    headers: {
      origin: req.get('Origin'),
      host: req.get('Host'),
      referer: req.get('Referer')
    }
  });
});

// API Routes
app.use('/api/v1/moments', moments);
app.use('/api/v1/auth', auth);
app.use('/api/v1/messages', messages);
app.use('/api/v1/auth/users', users);
app.use('/api/v1/languages', languages);
app.use('/api/v1/comments', comments);

app.use(errorHandler);

// Socket.IO Authentication
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization ||
                  socket.handshake.query.token;
    
    console.log('🔑 Socket auth from:', socket.handshake.headers.origin);
    
    if (!token) {
      console.log('❌ No token provided');
      return next(new Error("Authentication error: No token provided"));
    }
    
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    
    socket.user = decoded;
    console.log(`✅ User authenticated: ${decoded.id}`);
    next();
  } catch (err) {
    console.log('❌ Auth error:', err.message);
    return next(new Error("Authentication error: Invalid token"));
  }
});

// Socket.IO connection handler
io.on('connection', async (socket) => {   
  console.log(`✅ User ${socket.user?.id} connected`);    
  
  if (!socket.user?.id) {     
    console.log('❌ No user ID - disconnecting');     
    socket.disconnect(true);     
    return;   
  }    
  
  const userRoom = `user_${socket.user.id}`;   
  await socket.join(userRoom);   
  console.log(`👤 User ${socket.user.id} joined room: ${userRoom}`);
  
  try {
    const connectedSockets = await io.fetchSockets();
    const onlineUsers = connectedSockets
      .filter(s => s.user?.id && s.user.id !== socket.user.id)
      .map(s => ({
        userId: s.user.id,
        status: 'online',
        lastSeen: null
      }));
    
    socket.emit('onlineUsers', onlineUsers);
    console.log(`📋 Sent ${onlineUsers.length} online users to ${socket.user.id}`);
    
    socket.broadcast.emit('userStatusUpdate', {
      userId: socket.user.id,
      status: 'online',
      lastSeen: null
    });
  } catch (error) {
    console.error('❌ Error handling online users:', error);
  }
  
  // Handle sending messages
  socket.on('sendMessage', async ({ receiver, message }, callback) => {     
    try {       
      if (!receiver || !message || typeof message !== 'string') {         
        throw new Error('Missing or invalid required fields');       
      }
      
      if (message.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }
      
      console.log(`📤 Message from ${socket.user.id} to ${receiver}`);        
      
      const newMessage = await Message.create({          
        sender: socket.user.id,          
        receiver,          
        message: message.trim()
      });        
      
      const populatedMessage = await Message.findById(newMessage._id)         
        .populate('sender', 'name imageUrls')
        .populate('receiver', 'name imageUrls');        
      
      const unreadCountForReceiver = await Message.countDocuments({         
        receiver: receiver,
        sender: socket.user.id,
        read: false       
      });
      
      const unreadCountForSender = await Message.countDocuments({         
        receiver: socket.user.id,
        sender: receiver,
        read: false       
      });        
      
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
      
      const receiverRoom = `user_${receiver}`;       
      io.to(receiverRoom).emit('newMessage', notificationDataForReceiver);              
      
      if (callback) {
        callback({           
          status: 'success',           
          message: populatedMessage,           
          unreadCount: unreadCountForSender
        });
      }
      
      io.to(userRoom).emit('messageSent', notificationDataForSender);
      console.log(`📨 Message delivered`);     
    } catch (err) {       
      console.error('❌ Message error:', err);              
      
      const errorResponse = {           
        status: 'error',           
        error: err.message
      };
      
      if (callback) {         
        callback(errorResponse);       
      } else {         
        socket.emit('messageError', errorResponse);       
      }     
    }   
  });
  
  // Handle marking messages as read
  socket.on('markAsRead', async ({ senderId }, callback) => {
    try {
      if (!senderId) {
        throw new Error('Sender ID is required');
      }
      
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
      
      console.log(`📖 Marked ${result.modifiedCount} messages as read`);
      
      const senderRoom = `user_${senderId}`;
      io.to(senderRoom).emit('messagesRead', {
        readBy: socket.user.id,
        count: result.modifiedCount
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
  
  // Typing events
  let typingTimeout;
  const handleTypingEvent = (type) => {     
    return ({ receiver }) => {       
      if (!receiver) return;        
      
      if (type === 'start') {         
        if (typingTimeout) clearTimeout(typingTimeout);
        
        socket.to(`user_${receiver}`).emit('userTyping', {            
          userId: socket.user.id,           
          isTyping: true          
        });
        
        typingTimeout = setTimeout(() => {
          socket.to(`user_${receiver}`).emit('userTyping', {            
            userId: socket.user.id,           
            isTyping: false          
          });
        }, 5000);
      } else {         
        if (typingTimeout) clearTimeout(typingTimeout);
        
        socket.to(`user_${receiver}`).emit('userTyping', {            
          userId: socket.user.id,           
          isTyping: false          
        });       
      }     
    };   
  };    
  
  socket.on('typing', handleTypingEvent('start'));   
  socket.on('stopTyping', handleTypingEvent('stop'));    
  
  // Status updates
  socket.on('updateStatus', async ({ status }) => {
    try {
      const validStatuses = ['online', 'away', 'busy', 'offline'];
      if (!validStatuses.includes(status)) return;
      
      console.log(`📡 User ${socket.user.id} status: ${status}`);
      
      socket.broadcast.emit('userStatusUpdate', {
        userId: socket.user.id,
        status,
        lastSeen: status === 'offline' ? new Date().toISOString() : null
      });
    } catch (err) {
      console.error('❌ Status update error:', err);
    }
  });
  
  // Quick status handlers
  ['setAway', 'setBusy', 'setOnline'].forEach(eventName => {
    socket.on(eventName, () => {
      const status = eventName.replace('set', '').toLowerCase();
      socket.broadcast.emit('userStatusUpdate', {
        userId: socket.user.id,
        status,
        lastSeen: null
      });
    });
  });
  
  // Get user status
  socket.on('getUserStatus', async ({ userId }, callback) => {
    try {
      if (!userId) throw new Error('User ID required');
      
      const connectedSockets = await io.fetchSockets();
      const userSocket = connectedSockets.find(s => s.user?.id === userId);
      
      callback({
        status: 'success',
        data: {
          userId,
          status: userSocket ? 'online' : 'offline',
          lastSeen: userSocket ? null : new Date().toISOString()
        }
      });
    } catch (err) {
      callback({
        status: 'error',
        error: err.message
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {     
    console.log(`❌ User ${socket.user?.id} disconnected: ${reason}`);
    
    if (typingTimeout) clearTimeout(typingTimeout);
    
    socket.broadcast.emit('userStatusUpdate', {
      userId: socket.user.id,
      status: 'offline',
      lastSeen: new Date().toISOString()
    });
  });    
  
  socket.on('error', (error) => {     
    console.log(`❌ Socket error:`, error);   
  }); 
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`.yellow.bold);
  console.log(`🌐 CORS: ULTRA-PERMISSIVE MODE ENABLED`.cyan);
  console.log(`📡 Socket.IO ready`.green.bold);
});

// Error handling
process.on('unhandledRejection', (err) => {
  console.log(`❌ Unhandled Rejection: ${err.message}`.red);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.log(`❌ Uncaught Exception: ${err.message}`.red);
  process.exit(1);
});