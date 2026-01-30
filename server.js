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
const notifications = require('./routes/notifications');
const learning = require('./routes/learning');
const community = require('./routes/community');
const aiConversation = require('./routes/aiConversation');
const grammarFeedback = require('./routes/grammarFeedback');
const speech = require('./routes/speech');
const aiTranslation = require('./routes/aiTranslation');
const lessonBuilder = require('./routes/lessonBuilder');

// Initialize Express app
const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

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

// Initialize Socket.IO with proper CORS
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (process.env.NODE_ENV === 'development') {
        // Allow all origins in development
        callback(null, true);
      } else {
        console.warn(`Socket.IO blocked origin: ${origin}`);
        callback(null, true); // Still allow but log (for mobile apps)
      }
    },
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

// Middleware - Compression (reduce response sizes)
const compression = require('compression');
app.use(compression());

// Middleware - Rate Limiting
// Note: generalLimiter skips authenticated users automatically
// Authenticated users have higher limits via keyGenerator
const rateLimiter = require('./middleware/rateLimiter');
app.use('/api/v1/', rateLimiter.generalLimiter);

// Middleware - Request Logging
const { requestLogger, errorRequestLogger } = require('./middleware/requestLogger');
if (process.env.NODE_ENV === 'development') {
  // Detailed morgan logging in development
  app.use(morgan('dev'));
} else {
  // Custom request logger in production (logs errors and slow requests)
  app.use(requestLogger({ logLevel: 'info' }));
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

// Health check endpoint (enhanced)
app.get('/health', async (req, res) => {
  const startTime = Date.now();

  // Check MongoDB connection
  let dbStatus = 'unknown';
  let dbLatency = null;
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const dbStart = Date.now();
      await mongoose.connection.db.admin().ping();
      dbLatency = Date.now() - dbStart;
      dbStatus = 'connected';
    } else {
      dbStatus = 'disconnected';
    }
  } catch (error) {
    dbStatus = 'error';
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  const formatBytes = (bytes) => Math.round(bytes / 1024 / 1024 * 100) / 100;

  // Build health response
  const health = {
    success: true,
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatency
      },
      socketIO: {
        status: 'active',
        connections: io.sockets?.sockets?.size || 0
      },
      memory: {
        heapUsedMB: formatBytes(memUsage.heapUsed),
        heapTotalMB: formatBytes(memUsage.heapTotal),
        rssMB: formatBytes(memUsage.rss)
      }
    },
    responseTimeMs: Date.now() - startTime
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
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

// API info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    name: 'BanaTalk API',
    version: 'v1',
    currentVersion: '/api/v1',
    documentation: '/api/v1/docs',
    health: '/health',
    timestamp: new Date().toISOString()
  });
});

// Add API version header to all v1 responses
app.use('/api/v1', (req, res, next) => {
  res.setHeader('X-API-Version', 'v1');
  next();
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
app.use('/api/v1/notifications', notifications);
app.use('/api/v1/contact', require('./routes/contact'));
app.use('/api/v1/learning', learning);
app.use('/api/v1/community', community);
app.use('/api/v1/lessons', lessonBuilder);
app.use('/api/v1/ai-conversation', aiConversation);
app.use('/api/v1/grammar-feedback', grammarFeedback);
app.use('/api/v1/speech', speech);
app.use('/api/v1/translate', aiTranslation);

// Error request logger (logs failed requests)
app.use(errorRequestLogger);

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

// ============================================================
// GRACEFUL SHUTDOWN HANDLING
// ============================================================

let isShuttingDown = false;

/**
 * Graceful shutdown function
 * Closes all connections properly before exiting
 */
const gracefulShutdown = async (signal, exitCode = 0) => {
  if (isShuttingDown) {
    console.log('Shutdown already in progress...'.yellow);
    return;
  }
  isShuttingDown = true;

  console.log('');
  console.log(`👋 ${signal} received. Starting graceful shutdown...`.yellow);

  // Set a timeout to force exit if graceful shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    console.log('⚠️  Forced exit after timeout'.red);
    process.exit(exitCode);
  }, 30000); // 30 second timeout

  try {
    // 1. Stop accepting new connections
    console.log('📡 Stopping new connections...'.cyan);
    server.close();

    // 2. Close Socket.IO connections gracefully
    console.log('🔌 Closing Socket.IO connections...'.cyan);
    io.close((err) => {
      if (err) console.error('Socket.IO close error:', err);
    });

    // 3. Close MongoDB connection
    console.log('🗄️  Closing database connection...'.cyan);
    const mongoose = require('mongoose');
    await mongoose.connection.close();

    // 4. Clear the force exit timeout
    clearTimeout(forceExitTimeout);

    console.log('✅ Graceful shutdown completed'.green);
    process.exit(exitCode);

  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('');
  console.log(`❌ Unhandled Rejection: ${err.message}`.red.bold);
  if (process.env.NODE_ENV === 'development') {
    console.log(err.stack);
  }
  // Don't crash on unhandled rejections in production, just log
  if (process.env.NODE_ENV !== 'production') {
    gracefulShutdown('UNHANDLED_REJECTION', 1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('');
  console.log(`❌ Uncaught Exception: ${err.message}`.red.bold);
  console.log(err.stack);
  // Always exit on uncaught exceptions - the app state may be corrupted
  gracefulShutdown('UNCAUGHT_EXCEPTION', 1);
});

// Handle SIGTERM (Docker, Kubernetes, etc.)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, io };