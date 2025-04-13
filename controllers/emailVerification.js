// utils/emailVerification.js
const crypto = require('crypto');

const usersVerification = {}; // In-memory store

exports.generateVerificationCode = (userId) => {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiration = Date.now() + 15 * 60 * 1000; // 15 minutes
  usersVerification[userId] = { code, expiration };
  return code;
};

exports.checkVerificationCode = (userId, code) => {
  const user = usersVerification[userId];
  if (!user || !user.code) return { success: false, msg: 'Invalid user or code.' };
  if (user.code !== code) return { success: false, msg: 'Invalid verification code.' };
  if (user.expiration < Date.now()) return { success: false, msg: 'Code expired.' };

  delete usersVerification[userId];
  return { success: true };
};
