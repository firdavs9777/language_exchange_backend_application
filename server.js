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
const jwt = require('jsonwebtoken'); // Added missing import
const passport = require('passport');
const bodyParser = require('body-parser');
const { Server } = require('socket.io'); // Modern import

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

// Initialize Socket.IO with proper CORS and options
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware setup
app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(
  fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 },
    abortOnLimit: true,
    createParentPath: true
  })
);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(mongoSanitize());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(xss());
app.use(rateLimit({ windowMs: 10 * 60 * 1000, max: 10000 }));
app.use(hpp());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());

// Routes
app.get('/test', (req, res) => res.send('Test route is working!'));
app.use('/api/v1/moments', moments);
app.use('/api/v1/auth', auth);
app.use('/api/v1/messages', messages);
app.use('/api/v1/auth/users', users);
app.use('/api/v1/languages', languages);
app.use('/api/v1/comments', comments);
app.use(errorHandler);

// Socket.IO Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error: No token provided"));
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    return next(new Error("Authentication error: Invalid token"));
  }
});

// Socket.IO Connection Handler
// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log(`User ${socket.user.id} connected`);

  // Join user to their own room
  socket.join(`user_${socket.user.id}`);

  socket.on('sendMessage', async ({ sender, receiver, message }) => {
    try {
      // Create and save the message to the database
      const newMessage = await Message.create({ sender, receiver, message });
      
      // Load the complete message with populated sender information
      const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender', 'name imageUrls')
        .populate('receiver', 'name imageUrls');
      
      // Send to the receiver
      socket.to(`user_${receiver}`).emit('message', populatedMessage);
      
      console.log(populatedMessage)
      // Option 1: Either send acknowledgment to sender
      socket.emit('messageSent', populatedMessage);
      
      // Option 2: Or send to the same 'message' event (uncomment if you prefer this approach)
      // socket.emit('message', populatedMessage);
    } catch (err) {
      console.error('Message save error:', err);
      // Notify sender of error
      socket.emit('messageError', { message: 'Failed to save message', originalMessage: message });
    }
  });

  socket.on('typing', ({ sender, receiver }) => {
    socket.to(`user_${receiver}`).emit('userTyping', { user: sender });
  });

  socket.on('stopTyping', ({ sender, receiver }) => {
    socket.to(`user_${receiver}`).emit('userStopTyping', { user: sender });
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.user.id} disconnected`);
  });
});
// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
});

// Error handling
process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`.red.bgBlack);
  server.close(() => process.exit(1));
});