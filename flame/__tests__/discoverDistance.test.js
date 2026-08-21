// Stub Flame's S3 util so tests don't hit DigitalOcean.
require.cache[require.resolve('../utils/s3')] = {
  exports: {
    uploadBuffer: async (_buf, key) => `https://stub.example.com/${key}`,
    deleteObject: async () => {},
    bucket: 'stub-bucket',
  },
};

const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const dbHelper = require('./helpers/db');

// One database for the whole file, and a fresh app per test.
//
// The per-test setup()/teardown() pattern used elsewhere spins a new in-memory
// Mongo for every test; by the sixth, model bindings from a stopped server
// surface as MongoNotConnectedError on an unrelated route. These tests need
// isolated *limiter counters*, not isolated data — and a limiter's state lives
// in the app instance, so rebuilding just the app gives exactly that, in a
// fraction of the time.
const MODULES = [
  '../db', '../models/User', '../models/RefreshToken', '../models/Story',
  '../models/Conversation', '../models/Message', '../models/Swipe',
  '../models/Match',
  '../services/authService', '../services/userService', '../services/storyService',
  '../services/visibilityService', '../services/chatService',
  '../services/matchService',
  '../controllers/authController', '../controllers/userController',
  '../controllers/storyController', '../controllers/chatController',
  '../controllers/socialAuthController',
  '../routes/auth', '../routes/users', '../routes/stories',
  '../routes/conversations', '../index',
];

async function startDb() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  MODULES.forEach((m) => { try { delete require.cache[require.resolve(m)]; } catch {} });
  const { connect } = require('../db');
  await connect();
}

async function stopDb() {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
}

// Rebuilds only the route layer, so every test starts with empty rate-limit
// counters while keeping the one live connection.
function freshApp() {
  ['../routes/auth', '../index'].forEach((m) => {
    try { delete require.cache[require.resolve(m)]; } catch {}
  });
  const { buildApp } = require('./helpers/app');
  return buildApp();
}

before(startDb);
after(stopDb);

const { toDiscoverUser, haversineKm } = require('../services/discoveryService');

// London and Paris, ~344 km apart.
const LONDON = [-0.1276, 51.5072];
const PARIS = [2.3522, 48.8566];

const userDoc = (over = {}) => ({
  _id: { toString: () => 'u1' },
  name: 'A', age: 30, gender: 'female', lookingFor: 'male',
  bio: '', interests: [], photos: [],
  isOnline: false, isVerified: false, lastActive: new Date(),
  createdAt: new Date(),
  preferences: {},
  ...over,
});

test('haversineKm measures a known distance', () => {
  const km = haversineKm(LONDON, PARIS);
  assert.ok(km > 330 && km < 360, `expected ~344, got ${km}`);
  assert.equal(Math.round(haversineKm(LONDON, LONDON)), 0);
});

test('distance is a real number when both sides have a location', () => {
  const target = userDoc({ locationGeo: { type: 'Point', coordinates: PARIS } });
  const viewer = { locationGeo: { type: 'Point', coordinates: LONDON } };

  const out = toDiscoverUser(target, viewer);

  assert.ok(out.distance > 330 && out.distance < 360);
});

test('distance is null when the target hid it', () => {
  const target = userDoc({
    locationGeo: { type: 'Point', coordinates: PARIS },
    preferences: { showDistance: false },
  });
  const viewer = { locationGeo: { type: 'Point', coordinates: LONDON } };

  assert.equal(toDiscoverUser(target, viewer).distance, null);
});

test('distance is null when either side has no location', () => {
  const located = userDoc({ locationGeo: { type: 'Point', coordinates: PARIS } });
  const viewer = { locationGeo: { type: 'Point', coordinates: LONDON } };

  assert.equal(toDiscoverUser(userDoc(), viewer).distance, null);
  assert.equal(toDiscoverUser(located, {}).distance, null);
  // This is the case that used to render "0 km away" on every card.
  assert.equal(toDiscoverUser(located, undefined).distance, null);
});

test('showDistance is asymmetric — hiding yours does not hide theirs', () => {
  const target = userDoc({ locationGeo: { type: 'Point', coordinates: PARIS } });
  const viewer = {
    locationGeo: { type: 'Point', coordinates: LONDON },
    preferences: { showDistance: false },
  };

  assert.ok(toDiscoverUser(target, viewer).distance > 330,
    'the viewer hiding their own distance must not blind them to others');
});

test('the existing single-argument callers still work', () => {
  // chatService.toConversation calls toDiscoverUser(doc) with no viewer.
  const out = toDiscoverUser(userDoc());
  assert.equal(out.distance, null);
  assert.equal(out.name, 'A');
});
