// OPTIMIZED SERVER CODE WITH PERFORMANCE IMPROVEMENTS
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const colors = require('colors');
const fileUpload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const NodeCache = require('node-cache');
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
const server = http.createServer(app);

// Initialize cache with 5 minute default TTL
const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 320, // Check for expired keys every 320 seconds
  useClones: false // Better performance
});

// PERFORMANCE: Add compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 0
}));

// Initialize Socket.IO with optimized settings
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://10.0.2.2:3000",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// PERFORMANCE: Caching middleware
const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();
    
    const key = `${req.method}:${req.originalUrl}`;
    const cachedResponse = cache.get(key);
    
    if (cachedResponse) {
      console.log(`📦 Cache HIT: ${key}`);
      return res.json(cachedResponse);
    }
    
    // Override res.json to cache the response
    const originalSend = res.json;
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, data, duration);
        console.log(`💾 Cache SET: ${key}`);
      }
      originalSend.call(this, data);
    };
    
    next();
  };
};

// PERFORMANCE: File upload middleware - only apply where needed
const uploadMiddleware = fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // Reduced to 5MB
  abortOnLimit: true,
  createParentPath: true,
  useTempFiles: true,
  tempFileDir: '/tmp/',
  debug: false
});

// Basic middleware setup
app.use(cookieParser());

// PERFORMANCE: Reduced body parser limits
app.use(bodyParser.json({ 
  limit: '5mb',
  parameterLimit: 50000
}));
app.use(bodyParser.urlencoded({ 
  limit: '5mb', 
  extended: true,
  parameterLimit: 50000
}));

// Environment-specific logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Static files with caching headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d', // Cache static files for 1 day
  etag: true
}));

// Security middleware
app.use(mongoSanitize());
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(xss());

// PERFORMANCE: Optimized rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // More reasonable limit
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for static files and health checks
    return req.path.startsWith('/uploads') || req.path === '/test';
  }
});

app.use(limiter);
app.use(hpp());

// CORS with optimized settings
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:3000', 'http://10.0.2.2:3000'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());

// Health check endpoint
app.get('/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cache_keys: cache.keys().length
  });
});

// Cache clear endpoint (for development)
if (process.env.NODE_ENV === 'development') {
  app.post('/api/cache/clear', (req, res) => {
    cache.flushAll();
    res.json({ message: 'Cache cleared successfully' });
  });
}

// Routes with optimized caching
app.use('/api/v1/auth', auth); // No caching for auth routes

// Apply caching to read-heavy routes
app.use('/api/v1/moments', cacheMiddleware(180), uploadMiddleware, moments); // 3 minutes cache
app.use('/api/v1/languages', cacheMiddleware(600), languages); // 10 minutes cache  
app.use('/api/v1/comments', cacheMiddleware(120), comments); // 2 minutes cache

// No caching for real-time routes
app.use('/api/v1/messages', messages);
app.use('/api/v1/auth/users', users);

// Error handling middleware
app.use(errorHandler);

// OPTIMIZED Socket.IO Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
  
  if (!token) {
    console.log('❌ No token provided');
    return next(new Error("Authentication required"));
  }
  
  try {
    const cleanToken = token.replace('Bearer ', '');
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    socket.user = decoded;
    console.log(`✅ User ${decoded.id} authenticated`);
    next();
  } catch (err) {
    console.log('❌ Invalid token:', err.message);
    return next(new Error("Invalid token"));
  }
});

// OPTIMIZED Socket.IO Connection Handler
io.on('connection', (socket) => {   
  console.log(`🔌 User ${socket.user?.id} connected`);    
  
  if (!socket.user?.id) {     
    socket.disconnect();     
    return;   
  }    
  
  const userRoom = `user_${socket.user.id}`;   
  socket.join(userRoom);    
  
  // OPTIMIZED Message Handler
  socket.on('sendMessage', async ({ receiver, message }, callback) => {     
    try {       
      if (!receiver || !message?.trim()) {         
        throw new Error('Missing required fields');       
      }        
      
      console.log(`📤 ${socket.user.id} → ${receiver}`);
      
      // Create message with minimal data
      const newMessage = await Message.create({          
        sender: socket.user.id,          
        receiver,          
        message: message.trim()
      });        
      
      // PERFORMANCE: Minimal population
      const populatedMessage = await Message.findById(newMessage._id)         
        .populate('sender', 'name')
        .populate('receiver', 'name')
        .lean(); // Use lean() for better performance
      
      // PERFORMANCE: Optimized unread count queries
      const [unreadCountForReceiver, unreadCountForSender] = await Promise.all([
        Message.countDocuments({         
          receiver: receiver,
          sender: socket.user.id,
          read: false       
        }),
        Message.countDocuments({         
          receiver: socket.user.id,
          sender: receiver,
          read: false       
        })
      ]);
      
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
      
      // Send notifications
      io.to(`user_${receiver}`).emit('newMessage', notificationDataForReceiver);              
      io.to(userRoom).emit('messageSent', notificationDataForSender);
      
      if (callback) {
        callback({           
          status: 'success',           
          message: populatedMessage,           
          unreadCount: unreadCountForSender
        });
      }
      
      console.log(`✅ Message delivered`);     
    } catch (err) {       
      console.error('❌ Message error:', err.message);              
      
      if (callback) {         
        callback({           
          status: 'error',           
          error: err.message         
        });       
      }     
    }   
  });
  
  // OPTIMIZED Mark as Read Handler
  socket.on('markAsRead', async ({ senderId }, callback) => {
    try {
      if (!senderId) {
        throw new Error('Sender ID required');
      }
      
      const result = await Message.updateMany(
        {
          sender: senderId,
          receiver: socket.user.id,
          read: false
        },
        { read: true }
      );
      
      console.log(`📖 Marked ${result.modifiedCount} messages as read`);
      
      io.to(`user_${senderId}`).emit('messagesRead', {
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
      console.error('❌ Mark as read error:', err.message);
      if (callback) {
        callback({ status: 'error', error: err.message });
      }
    }
  });    
  
  // Typing handlers
  socket.on('typing', ({ receiver }) => {       
    if (receiver) {         
      socket.to(`user_${receiver}`).emit('userTyping', {            
        userId: socket.user.id,           
        isTyping: true          
      });       
    }     
  });   
  
  socket.on('stopTyping', ({ receiver }) => {         
    if (receiver) {
      socket.to(`user_${receiver}`).emit('userTyping', {            
        userId: socket.user.id,           
        isTyping: false          
      });       
    }
  });    
  
  // Status updates
  socket.on('updateStatus', ({ status }) => {
    socket.broadcast.emit('userStatusUpdate', {
      userId: socket.user.id,
      status,
      lastSeen: new Date()
    });
  });
  
  // Disconnect handler
  socket.on('disconnect', (reason) => {     
    console.log(`❌ User ${socket.user?.id} disconnected: ${reason}`);
    
    socket.broadcast.emit('userStatusUpdate', {
      userId: socket.user.id,
      status: 'offline',
      lastSeen: new Date()
    });
  });    
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed.');
    
    // Close database connection
    require('mongoose').connection.close(() => {
      console.log('✅ Database connection closed.');
      process.exit(0);
    });
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.log('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start server
const PORT = process.env.PORT || 5003;
server.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
  console.log(`📊 Cache system initialized`.green);
  console.log(`🔒 Security middleware enabled`.green);
  console.log(`⚡ Performance optimizations active`.green);
});

// Error handling
process.on('unhandledRejection', (err) => {
  console.log(`❌ Unhandled Rejection: ${err.message}`.red);
  gracefulShutdown('UNHANDLED_REJECTION');
});

process.on('uncaughtException', (err) => {
  console.log(`❌ Uncaught Exception: ${err.message}`.red);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));