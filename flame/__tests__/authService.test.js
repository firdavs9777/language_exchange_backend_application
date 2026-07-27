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
  ['../db', '../models/User', '../models/RefreshToken', '../services/authService', '../utils/jwt']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
}

test('authService.register creates user + tokens + persists refresh jti', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');
  const RefreshToken = require('../models/RefreshToken');

  const { user, tokens } = await authService.register({
    email: 'Ada@Example.com', password: 'Hunter2!!', name: 'Ada',
    age: 30, gender: 'female', lookingFor: 'male', interests: ['hiking'],
  });

  assert.equal(user.email, 'ada@example.com'); // lowercased
  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);

  const stored = await RefreshToken.find({ userId: user.id });
  assert.equal(stored.length, 1);

  t.after(async () => {
    const { close } = require('../db'); await close(); await dbHelper.stop();
  });
});

test('authService.register persists location + photos when provided', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');
  const User = require('../models/User');

  const { user } = await authService.register({
    email: 'geo@x.com', password: 'Hunter2!!', name: 'Geo',
    age: 28, gender: 'female', lookingFor: 'male', interests: ['x'],
    latitude: 37.77, longitude: -122.42,
    photos: ['https://cdn.x/a.jpg', 'https://cdn.x/b.jpg'],
  });

  const doc = await User.findById(user.id);
  assert.deepEqual(doc.locationGeo.coordinates, [-122.42, 37.77]); // [lng, lat]
  assert.equal(doc.location.coordinates.latitude, 37.77);
  assert.equal(doc.location.coordinates.longitude, -122.42);
  assert.equal(doc.photos.length, 2);
  assert.equal(doc.photos[0].isPrimary, true);
  assert.equal(doc.photos[1].isPrimary, false);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('authService.register without location/photos succeeds and leaves location null', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');
  const User = require('../models/User');

  const { user } = await authService.register({
    email: 'noloc@x.com', password: 'Hunter2!!', name: 'No',
    age: 28, gender: 'male', lookingFor: 'female', interests: ['x'],
  });

  const doc = await User.findById(user.id);
  assert.equal(doc.location, null);
  assert.equal(doc.photos.length, 0);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('authService.register rejects duplicate email with ConflictError', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');
  const { ConflictError } = require('../utils/errors');

  const args = { email: 'dup@x.com', password: 'Hunter2!!', name: 'Al', age: 22, gender: 'male', lookingFor: 'female', interests: ['x'] };
  await authService.register(args);
  await assert.rejects(authService.register(args), (e) => e instanceof ConflictError);

  t.after(async () => {
    const { close } = require('../db'); await close(); await dbHelper.stop();
  });
});

test('login: returns tokens for correct password', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');

  await authService.register({
    email: 'login@x.com', password: 'Hunter2!!', name: 'Lo',
    age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
  });
  const { user, tokens } = await authService.login({ email: 'login@x.com', password: 'Hunter2!!' });
  assert.equal(user.email, 'login@x.com');
  assert.ok(tokens.accessToken);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('login: throws AuthError on wrong password', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');
  const { AuthError } = require('../utils/errors');

  await authService.register({
    email: 'bad@x.com', password: 'right1!!', name: 'Xy',
    age: 22, gender: 'male', lookingFor: 'female', interests: ['x'],
  });
  await assert.rejects(
    authService.login({ email: 'bad@x.com', password: 'wrong!!' }),
    (e) => e instanceof AuthError && e.code === 'INVALID_CREDENTIALS',
  );

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('refresh: rotates refresh token (old jti revoked)', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');
  const RefreshToken = require('../models/RefreshToken');

  const { tokens } = await authService.register({
    email: 'r@x.com', password: 'Hunter2!!', name: 'Ro',
    age: 22, gender: 'male', lookingFor: 'female', interests: ['x'],
  });

  const before = await RefreshToken.findOne({ isRevoked: false });
  const newTokens = await authService.refreshTokens(tokens.refreshToken);
  assert.notEqual(newTokens.refreshToken, tokens.refreshToken);

  const oldAfter = await RefreshToken.findById(before._id);
  assert.equal(oldAfter.isRevoked, true);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('logout: revokes all of a user\'s refresh tokens', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');
  const RefreshToken = require('../models/RefreshToken');

  const { user } = await authService.register({
    email: 'lo@x.com', password: 'Hunter2!!', name: 'Lo',
    age: 22, gender: 'male', lookingFor: 'female', interests: ['x'],
  });
  await authService.logout(user.id);
  const active = await RefreshToken.find({ userId: user.id, isRevoked: false });
  assert.equal(active.length, 0);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});
