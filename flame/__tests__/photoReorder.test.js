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

const P = '/flamebackend/v1';
const authH = (token) => ({ Authorization: `Bearer ${token}` });

async function makeUser(app, email) {
  const res = await request(app).post(`${P}/auth/register`).send({
    email, password: 'Hunter2!!', name: email.split('@')[0].slice(0, 20).padEnd(2, 'x'),
    age: 30, gender: 'female', lookingFor: 'male', interests: ['Travel'],
  }).expect(201);
  return { id: res.body.data.user.id, token: res.body.data.tokens.accessToken };
}

// Writes photos straight onto the document — the upload route needs a real
// multipart body and S3, and this route's behaviour depends on neither.
// Required lazily: the harness clears model modules in startDb.
async function givePhotos(userId, ids) {
  const User = require('../models/User');
  await User.updateOne({ _id: userId }, {
    $set: {
      photos: ids.map((id, i) => ({
        id, url: `https://stub.example.com/${id}.jpg`,
        isPrimary: i === 0, order: i,
      })),
    },
  });
}

const idsOf = (res) => res.body.data.photos.map((p) => p.id);

test('a permutation reorders and moves isPrimary to the new first', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'reorder-ok@x.com');
  await givePhotos(me.id, ['a', 'b', 'c']);

  const res = await request(app).patch(`${P}/users/me/photos/reorder`)
    .set(authH(me.token)).send({ photo_ids: ['c', 'a', 'b'] }).expect(200);

  assert.deepEqual(idsOf(res), ['c', 'a', 'b']);
  assert.equal(res.body.data.photos[0].is_primary, true);
  assert.equal(res.body.data.photos[1].is_primary, false);
  assert.deepEqual(res.body.data.photos.map((p) => p.order), [0, 1, 2]);
});

test('the response carries is_primary, which is what the client reads', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'reorder-casing@x.com');
  await givePhotos(me.id, ['a', 'b']);

  const res = await request(app).patch(`${P}/users/me/photos/reorder`)
    .set(authH(me.token)).send({ photo_ids: ['b', 'a'] }).expect(200);

  // Photo.fromJson reads is_primary. The upload route emits only isPrimary, so
  // that field parses as false on every photo today; this route emits both.
  assert.equal(res.body.data.photos[0].is_primary, true);
  assert.equal(res.body.data.photos[0].isPrimary, true);
});

test('an id the caller does not own is rejected', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'reorder-foreign@x.com');
  await givePhotos(me.id, ['a', 'b']);

  await request(app).patch(`${P}/users/me/photos/reorder`)
    .set(authH(me.token)).send({ photo_ids: ['a', 'somebody-elses'] }).expect(422);
});

test('a subset is rejected rather than silently deleting a photo', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'reorder-subset@x.com');
  await givePhotos(me.id, ['a', 'b', 'c']);

  await request(app).patch(`${P}/users/me/photos/reorder`)
    .set(authH(me.token)).send({ photo_ids: ['b', 'a'] }).expect(422);

  const after = await request(app).get(`${P}/users/me`).set(authH(me.token)).expect(200);
  assert.equal(after.body.data.photos.length, 3);
});

test('a duplicated id is rejected', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'reorder-dup@x.com');
  await givePhotos(me.id, ['a', 'b']);

  await request(app).patch(`${P}/users/me/photos/reorder`)
    .set(authH(me.token)).send({ photo_ids: ['a', 'a'] }).expect(422);
});

test('an empty list is rejected', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'reorder-empty@x.com');
  await givePhotos(me.id, ['a']);

  await request(app).patch(`${P}/users/me/photos/reorder`)
    .set(authH(me.token)).send({ photo_ids: [] }).expect(422);
});

test('reordering requires auth', async () => {
  const app = freshApp();
  await request(app).patch(`${P}/users/me/photos/reorder`)
    .send({ photo_ids: ['a'] }).expect(401);
});
