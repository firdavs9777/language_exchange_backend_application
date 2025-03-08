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

// Email Verification Logic
const usersVerification = {}; // In-memory user storage (replace with a database in production)

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: process.env.MAILTRAP_PORT,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS,
  },
});

async function generateVerificationCode(userId) {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiration = Date.now() + 15 * 60 * 1000; // 15 minutes
  usersVerification[userId] = { code, expiration };
  return code;
}

async function sendVerificationEmail(email, code) {
  const mailOptions = {
    from: 'your-app@example.com',
    to: email,
    subject: 'Email Verification Code',
    text: `Your verification code is: ${code}`,
  };

  await transporter.sendMail(mailOptions);
}

app.post('/api/v1/verify/send', async (req, res) => {
  const { email, userId } = req.body;
  console.log(email);
  console.log(userId);
  if (!email || !userId) {
    return res.status(400).send('Email and userId are required.');
  }

  const code = await generateVerificationCode(userId);
  await sendVerificationEmail(email, code);

  res.send('Verification code sent to your email.');
});

app.post('/api/v1/verify/check', (req, res) => {
  const { userId, code } = req.body;
  const user = usersVerification[userId];

  if (!user || !user.code) {
    return res.status(400).send('Invalid user or code.');
  }

  if (user.code !== code) {
    return res.status(400).send('Invalid verification code.');
  }

  if (user.expiration < Date.now()) {
    return res.status(400).send('Code expired.');
  }

  // Mark user as verified in your user database (replace with your actual logic)
  console.log(`User ${userId} email verified.`);
  delete usersVerification[userId]; // Invalidate the code
  res.send('Email verified!');
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