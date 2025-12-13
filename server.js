// server.js - CLEAN VERSION WITH SEPARATED SOCKET LOGIC
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const colors = require('colors');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middleware/error');
const connectDb = require('./config/db');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const http = require('http');
const passport = require('passport');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');
const { initializeSocket } = require('./socket/socketHandler');

// Load environment variables
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
const stories = require('./routes/story');
const purchases = require('./routes/purchases');
const userBlocks = require('./routes/userBlocks');
const conversations = require('./routes/conversations');
const reports = require('./routes/report');

// Initialize Express app
const app = express();

// Disable trust proxy (prevents rate limiter conflicts)
app.set('trust proxy', false);

// Create HTTP server
const server = http.createServer(app);

// CORS configuration
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

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for Socket.IO
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize socket event handlers
initializeSocket(io);

// Make io accessible to routes
app.set('io', io);

// Middleware - Cookie Parser
app.use(cookieParser());

// Middleware - CORS (Manual Headers)
app.use((req, res, next) => {
  const origin = req.get('Origin');
  
  // Log request
  if (process.env.NODE_ENV === 'development') {
    console.log(`🌐 ${req.method} ${req.path} from ${origin || 'no-origin'}`);
  }
  
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Access-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware - Body Parser
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));

// Middleware - Morgan (Development logging)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Middleware - Static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware - Security
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false 
}));
app.use(xss()); // Prevent XSS attacks
app.use(hpp()); // Prevent HTTP Parameter Pollution

// Middleware - Passport
app.use(passport.initialize());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    socketIO: 'connected'
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is working!',
    origin: req.get('Origin'),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/moments', moments);
app.use('/api/v1/auth', auth);
app.use('/api/v1/messages', messages);
app.use('/api/v1/auth/users', users);
app.use('/api/v1/languages', languages);
app.use('/api/v1/comments', comments);
app.use('/api/v1/stories', stories);
app.use('/api/v1/purchases', purchases);
app.use('/api/v1/users', userBlocks);
app.use('/api/v1/conversations', conversations);
app.use('/api/v1/reports', reports);

// Error handler middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('='.repeat(50).cyan);
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode`.yellow.bold);
  console.log(`📡 Socket.IO initialized and ready`.green.bold);
  console.log(`🌐 Listening on ${HOST}:${PORT}`.blue.bold);
  console.log(`🔒 CORS enabled for all origins`.magenta);
  console.log('='.repeat(50).cyan);
  console.log('');
  
  // Start scheduled jobs (email notifications, story archival, etc.)
  if (process.env.ENABLE_SCHEDULER !== 'false') {
    const { startScheduler } = require('./jobs/scheduler');
    startScheduler();
  }
});

// Graceful shutdown handlers
process.on('unhandledRejection', (err, promise) => {
  console.log('');
  console.log(`❌ Unhandled Rejection: ${err.message}`.red.bold);
  console.log(err.stack);
  
  // Close server and exit
  server.close(() => {
    console.log('💀 Server closed due to unhandled rejection'.red);
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.log('');
  console.log(`❌ Uncaught Exception: ${err.message}`.red.bold);
  console.log(err.stack);
  
  // Exit immediately for uncaught exceptions
  console.log('💀 Server shutting down due to uncaught exception'.red);
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('');
  console.log('👋 SIGTERM received. Performing graceful shutdown...'.yellow);
  
  server.close(() => {
    console.log('💤 Server closed successfully'.green);
    process.exit(0);
    });
  });
  
// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('');
  console.log('👋 SIGINT received. Performing graceful shutdown...'.yellow);
  
  server.close(() => {
    console.log('💤 Server closed successfully'.green);
    process.exit(0);
  }); 
});

module.exports = { app, server, io };