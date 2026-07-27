const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setupEnv() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  ['../db', '../models/User', '../models/RefreshToken', '../services/authService',
   '../services/socialAuthService', '../utils/jwt']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
}

test('findOrCreate: new provider id creates an incomplete social user', async (t) => {
  await setupEnv();
  const socialAuthService = require('../services/socialAuthService');
  const User = require('../models/User');

  const { user, tokens, isNew } = await socialAuthService.findOrCreate('google', {
    providerId: 'g-1', email: 'new@x.com', name: 'Gee', emailVerified: true,
  });

  assert.equal(isNew, true);
  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);

  const doc = await User.findById(user.id);
  assert.equal(doc.googleId, 'g-1');
  assert.equal(doc.profileComplete, false);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('findOrCreate: same provider id again logs in the same user', async (t) => {
  await setupEnv();
  const socialAuthService = require('../services/socialAuthService');

  const first = await socialAuthService.findOrCreate('google', {
    providerId: 'g-2', email: 'again@x.com', name: 'Gee', emailVerified: true,
  });
  const second = await socialAuthService.findOrCreate('google', {
    providerId: 'g-2', email: 'again@x.com', name: 'Gee', emailVerified: true,
  });

  assert.equal(second.isNew, false);
  assert.equal(second.user.id, first.user.id);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('findOrCreate: links to existing password user when email verified', async (t) => {
  await setupEnv();
  const socialAuthService = require('../services/socialAuthService');
  const authService = require('../services/authService');
  const User = require('../models/User');

  const { user: pwUser } = await authService.register({
    email: 'link@x.com', password: 'Hunter2!!', name: 'Link',
    age: 30, gender: 'female', lookingFor: 'male', interests: ['x'],
  });

  const res = await socialAuthService.findOrCreate('google', {
    providerId: 'g-3', email: 'link@x.com', name: 'Link', emailVerified: true,
  });

  assert.equal(res.isNew, false);
  assert.equal(res.user.id, pwUser.id);

  const doc = await User.findById(pwUser.id);
  assert.equal(doc.googleId, 'g-3');
  assert.ok(doc.passwordHash); // still has its password
  assert.notEqual(doc.passwordHash, null);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('findOrCreate: does NOT link when email is unverified (creates new user)', async (t) => {
  await setupEnv();
  const socialAuthService = require('../services/socialAuthService');
  const authService = require('../services/authService');
  const User = require('../models/User');

  const { user: pwUser } = await authService.register({
    email: 'nolink@x.com', password: 'Hunter2!!', name: 'NoLink',
    age: 30, gender: 'female', lookingFor: 'male', interests: ['x'],
  });

  const res = await socialAuthService.findOrCreate('google', {
    providerId: 'g-4', email: 'nolink@x.com', name: 'NoLink', emailVerified: false,
  });

  assert.equal(res.isNew, true);
  assert.notEqual(res.user.id, pwUser.id);

  // original password user is untouched (no googleId)
  const orig = await User.findById(pwUser.id);
  assert.equal(orig.googleId, null);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('findOrCreate: sets correct id field for facebook and apple', async (t) => {
  await setupEnv();
  const socialAuthService = require('../services/socialAuthService');
  const User = require('../models/User');

  const fb = await socialAuthService.findOrCreate('facebook', {
    providerId: 'fb-1', email: 'fb@x.com', name: 'Fb', emailVerified: true,
  });
  const fbDoc = await User.findById(fb.user.id);
  assert.equal(fbDoc.facebookId, 'fb-1');

  // Apple with no email → synthetic email keeps unique index satisfied
  const ap = await socialAuthService.findOrCreate('apple', {
    providerId: 'ap-1', email: null, name: null, emailVerified: false,
  });
  const apDoc = await User.findById(ap.user.id);
  assert.equal(apDoc.appleId, 'ap-1');
  assert.equal(apDoc.email, 'apple_ap-1@social.flame');

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});
