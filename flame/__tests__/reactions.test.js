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
    '../db', '../models/User', '../models/RefreshToken', '../models/Story',
    '../models/Conversation', '../models/Message', '../models/Swipe',
    '../models/Match',
    '../services/authService', '../services/userService', '../services/storyService',
    // chatService/userService/storyService now enforce blocks through
    // visibilityService, which binds User and Swipe at load — clear all three
    // or they keep the previous test's closed connection. chatService also
    // consults matchService (ended matches close the conversation), which binds
    // Match, so those two go in the list for the same reason.
    '../services/visibilityService', '../services/chatService',
    '../services/matchService', '../socket/flameSocket',
    '../controllers/authController', '../controllers/userController', '../controllers/storyController',
    '../controllers/chatController',
    '../routes/auth', '../routes/users', '../routes/stories', '../routes/conversations', '../routes/messages', '../index',
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
    // padEnd guards against short local-parts (e.g. 'a@x.com' -> 'a'), which would
    // otherwise fail the auth route's `name: z.string().min(2)` validation.
    email, password: 'Hunter2!!', name: email.split('@')[0].padEnd(2, 'x'),
    age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
  };
  const r = await request(app).post('/flamebackend/v1/auth/register').send(body).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

const authH = (token) => ({ Authorization: `Bearer ${token}` });

async function openAndSend(app, a, b) {
  const conv = (await request(app).post('/flamebackend/v1/conversations')
    .set(authH(a.token)).send({ user_id: b.id }).expect(201)).body.data.id;
  const msg = await request(app).post(`/flamebackend/v1/conversations/${conv}/messages`)
    .set(authH(a.token)).send({ text: 'react to me' }).expect(201);
  return msg.body.data.id;
}

test('add, replace, and remove a reaction (one per user)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const msgId = await openAndSend(app, a, b);

  // B reacts
  const r1 = await request(app).post(`/flamebackend/v1/messages/${msgId}/reactions`)
    .set(authH(b.token)).send({ emoji: '❤️' }).expect(201);
  assert.equal(r1.body.data.reactions.length, 1);
  assert.equal(r1.body.data.reactions[0].user_id, b.id);
  assert.equal(r1.body.data.reactions[0].emoji, '❤️');

  // B changes reaction → still one, replaced
  const r2 = await request(app).post(`/flamebackend/v1/messages/${msgId}/reactions`)
    .set(authH(b.token)).send({ emoji: '😂' }).expect(201);
  assert.equal(r2.body.data.reactions.length, 1);
  assert.equal(r2.body.data.reactions[0].emoji, '😂');

  // B removes
  const r3 = await request(app).delete(`/flamebackend/v1/messages/${msgId}/reactions`)
    .set(authH(b.token)).expect(200);
  assert.equal(r3.body.data.reactions.length, 0);
});

test('a non-participant cannot react (403)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const c = await registerUser(app, 'c@x.com');
  const msgId = await openAndSend(app, a, b);
  await request(app).post(`/flamebackend/v1/messages/${msgId}/reactions`)
    .set(authH(c.token)).send({ emoji: '❤️' }).expect(403);
});

test('reacting to a missing message is 404', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  await request(app).post('/flamebackend/v1/messages/0123456789abcdef01234567/reactions')
    .set(authH(a.token)).send({ emoji: '❤️' }).expect(404);
});

test('reactions require auth (401)', async (t) => {
  const app = await setup();
  t.after(teardown);
  await request(app).post('/flamebackend/v1/messages/0123456789abcdef01234567/reactions')
    .send({ emoji: '❤️' }).expect(401);
});
