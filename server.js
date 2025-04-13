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
const io = require('socket.io');
const passport = require('passport');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Load env vars
dotenv.config({
  path: './config/config.env',
});
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
const server = http.createServer(app); // Create HTTP server
const socketIO = io(server); // Initialize Socket.IO with the HTTP server

// Cookie
app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(
  fileUpload({
    limits: {
      fileSize: 10 * 1024 * 1024, // Around 10MB
    },
    abortOnLimit: true,
    createParentPath: true,
  })
);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Sanitize Data
app.use(mongoSanitize());
// Set security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
// Set security script and prevent xss attack
app.use(xss());
// Rate Limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 10000,
});
app.use(limiter);
// Prevent http param pollution
app.use(hpp());
// Prevent cors
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
// Mount routers
app.get('/test', (req, res) => {
  res.send('Test route is working!');
});
app.use('/api/v1/moments', moments);
app.use('/api/v1/auth', auth);
app.use('/api/v1/messages', messages);
app.use('/api/v1/auth/users', users);
app.use('/api/v1/languages', languages);
app.use('/api/v1/comments', comments);
app.use(errorHandler);
app.use(passport.initialize());

// Socket.io connection
socketIO.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('sendMessage', async ({ sender, receiver, message }) => {
    const newMessage = await Message.create({ sender, receiver, message });
    socketIO.emit('message', newMessage); // Emit to all clients or filter based on user
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});


// ENV PORT name loaded
const PORT = process.env.PORT || 5000;

server.listen(
  PORT,
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold
  )
);
// Handle unhandles promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red.bgBlack);
  // Close server & exit process
  server.close(() => process.exit(1));
});