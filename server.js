// FIXED SERVER CODE
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const colors = require('colors');
const fileUpload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middleware/error');
const connectDb = require('./config/db');
const removeIndex = require("./config/rm_unique")
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
// removeIndex();
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

// FIXED: Socket.IO Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
  console.log(token);
  if (!token) {
    console.log('Authentication error: No token provided');
    return next(new Error("Authentication error: No token provided"));
  }
  
  try {
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace('Bearer ', '');
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    socket.user = decoded;
    console.log(`User authenticated: ${decoded.id}`);
    next();
  } catch (err) {
    console.log('Authentication error: Invalid token', err.message);
    return next(new Error("Authentication error: Invalid token"));
  }
});

io.on('connection', (socket) => {   
  console.log(`✅ User ${socket.user?.id} connected successfully`);    
  
  // Validate user exists on socket   
  if (!socket.user?.id) {     
    console.log('❌ No user ID found - disconnecting');     
    socket.disconnect();     
    return;   
  }    
  
  // Join user to their own room   
  const userRoom = `user_${socket.user.id}`;   
  socket.join(userRoom);   
  console.log(`User ${socket.user.id} joined room: ${userRoom}`);    
  
  // Handle sending messages   
  socket.on('sendMessage', async ({ receiver, message }, callback) => {     
    try {       
      // Input validation       
      if (!receiver || !message) {         
        throw new Error('Missing required fields');       
      }        
      
      console.log(`📤 Message from ${socket.user.id} to ${receiver}: ${message.substring(0, 30)}...`);        
      
      // Create and save the message to the database       
      const newMessage = await Message.create({          
        sender: socket.user.id,          
        receiver,          
        message        
      });        
      
      // Populate sender and receiver info       
      const populatedMessage = await Message.findById(newMessage._id)         
        .populate('sender', 'name imageUrls')
        .populate('receiver', 'name imageUrls');        
      
      // Calculate unread count for the RECEIVER (messages they haven't read from this sender)
      const unreadCountForReceiver = await Message.countDocuments({         
        receiver: receiver, // Messages TO the receiver
        sender: socket.user.id, // FROM this sender
        read: false       
      });
      
      // Calculate unread count for the SENDER (should be 0 since they just sent a message)
      const unreadCountForSender = await Message.countDocuments({         
        receiver: socket.user.id, // Messages TO the sender
        sender: receiver, // FROM the receiver
        read: false       
      });        
      
      // Prepare notification data for receiver
      const notificationDataForReceiver = {         
        message: populatedMessage,         
        unreadCount: unreadCountForReceiver,
        senderId: socket.user.id,
        type: 'newMessage'
      };        
      
      // Prepare notification data for sender (acknowledgment)
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
      
      console.log(`📨 Message delivered to ${receiverRoom}`);     
    } catch (err) {       
      console.error('❌ Message save error:', err);              
      
      if (callback) {         
        callback({           
          status: 'error',           
          error: err.message         
        });       
      } else {         
        socket.emit('messageError', {            
          message: 'Failed to save message',           
          error: err.message          
        });       
      }     
    }   
  });
  
  // Handle marking messages as read
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
        { read: true }
      );
      
      console.log(`📖 Marked ${result.modifiedCount} messages as read for user ${socket.user.id} from ${senderId}`);
      
      // Notify the sender that their messages were read
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
  
  // Handle typing events with improved validation   
  const handleTypingEvent = (type) => {     
    return ({ receiver }) => {       
      if (!receiver) {         
        console.log('❌ Missing receiver in typing event');         
        return;       
      }        
      
      if (type === 'start') {         
        console.log(`⌨️ User ${socket.user.id} is typing to ${receiver}`);         
        socket.to(`user_${receiver}`).emit('userTyping', {            
          userId: socket.user.id,           
          isTyping: true          
        });       
      } else {         
        console.log(`⌨️ User ${socket.user.id} stopped typing to ${receiver}`);         
        socket.to(`user_${receiver}`).emit('userTyping', {            
          userId: socket.user.id,           
          isTyping: false          
        });       
      }     
    };   
  };    
  
  socket.on('typing', handleTypingEvent('start'));   
  socket.on('stopTyping', handleTypingEvent('stop'));    
  
  // Handle user going online/offline
  socket.on('updateStatus', async ({ status }) => {
    try {
      // Update user status in database if you have a status field
      // await User.findByIdAndUpdate(socket.user.id, { status, lastSeen: new Date() });
      
      // Broadcast status to all user's conversation partners
      socket.broadcast.emit('userStatusUpdate', {
        userId: socket.user.id,
        status,
        lastSeen: new Date()
      });
    } catch (err) {
      console.error('❌ Status update error:', err);
    }
  });
  
  // Handle disconnection   
  socket.on('disconnect', (reason) => {     
    console.log(`❌ User ${socket.user?.id} disconnected: ${reason}`);
    
    // Broadcast offline status
    socket.broadcast.emit('userStatusUpdate', {
      userId: socket.user.id,
      status: 'offline',
      lastSeen: new Date()
    });
  });    
  
  // Handle connection errors   
  socket.on('error', (error) => {     
    console.log(`❌ Socket error for user ${socket.user?.id}:`, error);   
  }); 
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
});

// Error handling
process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`.red.bgBlack);
  server.close(() => process.exit(1));
});