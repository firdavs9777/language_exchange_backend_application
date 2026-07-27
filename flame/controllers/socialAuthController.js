const { FlameError, ValidationError } = require('../utils/errors');
const socialVerify = require('../utils/socialVerify');
const socialAuthService = require('../services/socialAuthService');
const User = require('../models/User');

function guard(provider) {
  if (!socialVerify.isConfigured(provider)) {
    const label = { google: 'Google', apple: 'Apple', facebook: 'Facebook' }[provider];
    throw new FlameError('PROVIDER_NOT_CONFIGURED', `${label} sign-in is not configured`, 501);
  }
}

async function respond(res, provider, payload) {
  const { user, tokens, isNew } = await socialAuthService.findOrCreate(provider, payload);
  res.status(isNew ? 201 : 200).json({
    success: true, data: { user, tokens, is_new_user: isNew },
  });
}

async function google(req, res) {
  guard('google');
  const payload = await socialVerify.verifyGoogle(req.body.id_token);
  await respond(res, 'google', payload);
}

async function apple(req, res) {
  guard('apple');
  const payload = await socialVerify.verifyApple(req.body.id_token);
  await respond(res, 'apple', payload);
}

async function facebook(req, res) {
  guard('facebook');
  const payload = await socialVerify.verifyFacebook(req.body.access_token);
  await respond(res, 'facebook', payload);
}

async function checkEmail(req, res) {
  const email = String(req.body.email || '').toLowerCase().trim();
  const exists = await User.exists({ email, isDeleted: { $ne: true } });
  res.json({ success: true, data: { available: !exists } });
}

module.exports = { google, apple, facebook, checkEmail };
