// Stub Flame's S3 util so tests don't hit DigitalOcean.
require.cache[require.resolve('../utils/s3')] = {
  exports: {
    uploadBuffer: async (_buf, key) => `https://stub.example.com/${key}`,
    deleteObject: async () => {},
    bucket: 'stub-bucket',
  },
};

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  [
    '../db', '../models/User', '../models/RefreshToken',
    '../services/authService', '../services/deviceService',
    '../controllers/authController', '../controllers/notificationController',
    '../routes/auth', '../routes/notifications', '../index',
  ].forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');
  return buildApp();
}

async function teardown() {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
}

async function registerUser(app, email) {
  const body = {
    email, password: 'Hunter2!!', name: email.split('@')[0].padEnd(2, 'x'),
    age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
  };
  const r = await request(app).post('/flamebackend/v1/auth/register').send(body).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

const authH = (token) => ({ Authorization: `Bearer ${token}` });

test('register a device token → persists on the user', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');

  const res = await request(app)
    .post('/flamebackend/v1/notifications/register-token')
    .set(authH(a.token))
    .send({ token: 'tok-1', platform: 'ios', deviceId: 'dev-1' })
    .expect(201);
  assert.equal(res.body.data.tokens.length, 1);
  assert.equal(res.body.data.tokens[0].token, 'tok-1');
  assert.equal(res.body.data.tokens[0].platform, 'ios');
  assert.equal(res.body.data.tokens[0].device_id, 'dev-1');
  assert.equal(res.body.data.tokens[0].active, true);
  assert.ok(res.body.data.tokens[0].last_updated);

  const User = require('../models/User');
  const stored = await User.findById(a.id);
  assert.equal(stored.fcmTokens.length, 1);
  assert.equal(stored.fcmTokens[0].token, 'tok-1');
  assert.equal(stored.fcmTokens[0].deviceId, 'dev-1');
});

test('registering again with the same deviceId replaces the token (no duplicate)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');

  await request(app)
    .post('/flamebackend/v1/notifications/register-token')
    .set(authH(a.token))
    .send({ token: 'tok-1', platform: 'ios', deviceId: 'dev-1' })
    .expect(201);

  const res = await request(app)
    .post('/flamebackend/v1/notifications/register-token')
    .set(authH(a.token))
    .send({ token: 'tok-2', platform: 'android', deviceId: 'dev-1' })
    .expect(201);

  assert.equal(res.body.data.tokens.length, 1);
  assert.equal(res.body.data.tokens[0].token, 'tok-2');
  assert.equal(res.body.data.tokens[0].platform, 'android');
  assert.equal(res.body.data.tokens[0].device_id, 'dev-1');

  const User = require('../models/User');
  const stored = await User.findById(a.id);
  assert.equal(stored.fcmTokens.length, 1);
  assert.equal(stored.fcmTokens[0].token, 'tok-2');
});

test('remove a device token', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');

  await request(app)
    .post('/flamebackend/v1/notifications/register-token')
    .set(authH(a.token))
    .send({ token: 'tok-1', platform: 'ios', deviceId: 'dev-1' })
    .expect(201);

  const res = await request(app)
    .delete('/flamebackend/v1/notifications/remove-token/dev-1')
    .set(authH(a.token))
    .expect(200);
  assert.equal(res.body.data.tokens.length, 0);

  const User = require('../models/User');
  const stored = await User.findById(a.id);
  assert.equal(stored.fcmTokens.length, 0);
});

test('get settings returns sensible defaults', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');

  const res = await request(app)
    .get('/flamebackend/v1/notifications/settings')
    .set(authH(a.token))
    .expect(200);
  assert.deepEqual(res.body.data, { enabled: true, chat_messages: true, matches: true });
});

test('update settings persists', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');

  const res = await request(app)
    .put('/flamebackend/v1/notifications/settings')
    .set(authH(a.token))
    .send({ chatMessages: false })
    .expect(200);
  assert.deepEqual(res.body.data, { enabled: true, chat_messages: false, matches: true });

  const again = await request(app)
    .get('/flamebackend/v1/notifications/settings')
    .set(authH(a.token))
    .expect(200);
  assert.deepEqual(again.body.data, { enabled: true, chat_messages: false, matches: true });
});

test('unauthenticated requests are rejected (401)', async (t) => {
  const app = await setup();
  t.after(teardown);
  await request(app).get('/flamebackend/v1/notifications/settings').expect(401);
  await request(app)
    .post('/flamebackend/v1/notifications/register-token')
    .send({ token: 't', platform: 'ios', deviceId: 'd' })
    .expect(401);
});

test('invalid register-token payload is rejected (422)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');

  await request(app)
    .post('/flamebackend/v1/notifications/register-token')
    .set(authH(a.token))
    .send({ token: 'tok-1', platform: 'windows', deviceId: 'dev-1' })
    .expect(422);

  await request(app)
    .post('/flamebackend/v1/notifications/register-token')
    .set(authH(a.token))
    .send({ platform: 'ios', deviceId: 'dev-1' })
    .expect(422);
});

test('invalid settings payload is rejected (422)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');

  await request(app)
    .put('/flamebackend/v1/notifications/settings')
    .set(authH(a.token))
    .send({ enabled: 'yes' })
    .expect(422);
});
