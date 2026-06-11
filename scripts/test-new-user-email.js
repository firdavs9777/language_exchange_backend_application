/**
 * Sends a preview of the redesigned "new user joined" admin email to a
 * recipient of your choice. Uses a fully-populated mock user so every section
 * of the template renders — gives a worst-case (= richest) layout to review.
 *
 * Usage:
 *   node scripts/test-new-user-email.js
 *   node scripts/test-new-user-email.js you@example.com
 *
 * Does NOT mutate the database. Counts users via the raw collection API to
 * sidestep the Node-25 / jsonwebtoken / SlowBuffer incompatibility that
 * breaks loading the Mongoose User model on this Node version (see
 * create-temp-account.js for the same workaround).
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const sendEmail = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');

const RECIPIENT = process.argv[2] || 'bananatalkmain@gmail.com';

const mockUser = {
  _id: '6700000000000000000000aa',
  name: 'Test Preview User',
  username: 'preview_user',
  email: 'preview.user@example.com',
  gender: 'female',
  bio: 'Hi! Im learning Korean and love connecting with new people from around the world. Looking forward to making friends here :)',
  occupation: 'Product Designer',
  school: 'Yonsei University',
  birth_year: '1998',
  birth_month: '04',
  birth_day: '17',
  mbti: 'INFJ',
  bloodType: 'O+',
  native_language: 'English',
  language_to_learn: 'Korean',
  isEmailVerified: true,
  isRegistrationComplete: true,
  profileCompleted: true,
  termsAccepted: true,
  termsAcceptedDate: new Date('2026-06-09T10:14:00Z'),
  signupPlatform: 'ios',
  userMode: 'regular',
  role: 'user',
  followers: new Array(12).fill(null),
  following: new Array(34).fill(null),
  location: {
    type: 'Point',
    coordinates: [127.0276, 37.4979],  // Gangnam, Seoul (lng, lat)
    formattedAddress: 'Gangnam-gu, Seoul, South Korea',
    city: 'Seoul',
    state: 'Seoul',
    country: 'South Korea'
  },
  vipSubscription: {
    isActive: true,
    plan: 'monthly'
  },
  images: [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'
  ],
  googleId: null,
  facebookId: null,
  appleId: null,
  createdAt: new Date('2026-06-11T09:32:00Z')
};

const mockContext = {
  platform: 'ios',
  device: {
    device: 'Mobile',
    ipAddress: '203.0.113.42',
    userAgent: 'Bananatalk/3.2.1 (iPhone; iOS 17.5.1; Scale/3.00) CFNetwork/1494.0.7 Darwin/23.5.0',
    deviceModel: 'iPhone16,1',
    osVersion: 'iOS 17.5.1',
    appVersion: '3.2.1',
    appBuild: '482'
  }
};

const run = async () => {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    console.error('Missing MAILGUN_API_KEY or MAILGUN_DOMAIN in config/config.env');
    process.exit(1);
  }

  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to DB: ${conn.connection.host}`);

  let totalUsers = null;
  try {
    totalUsers = await conn.connection.collection('users').countDocuments({ isRegistrationComplete: true });
    console.log(`Total registered users: ${totalUsers}`);
  } catch (err) {
    console.warn('Could not count users:', err.message);
  }

  const tpl = templates.newUserNotificationEmail(mockUser, { ...mockContext, totalUsers });

  console.log(`Sending preview to: ${RECIPIENT}`);
  console.log(`Subject: ${tpl.subject}`);

  try {
    await sendEmail({
      email: RECIPIENT,
      subject: tpl.subject,
      message: tpl.text,
      html: tpl.html
    });
    console.log('DONE — check the inbox.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('FAILED:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

run().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
