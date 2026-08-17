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

// A sticker here is an EMOJI, carried in the message text — the same model
// BananaTalk uses (chat_sticker_panel.dart is a hardcoded map of Unicode
// characters). It is not a pack catalog with hosted artwork; the five
// /stickers/* endpoints Flame's app once called have never existed in either
// backend, and the app's bubble still renders a sticker as Image.network,
// which is the model that never shipped.
//
// So the whole backend change is: let a message declare itself a sticker.

async function setup(t) {
  await dbHelper.start();
  t.after(async () => {
    try { await require('../db').close(); } catch { /* never opened */ }
    await dbHelper.stop();
  });

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
    '../services/visibilityService', '../services/chatService',
    '../services/matchService', '../services/authService',
    '../services/userService', '../services/storyService',
    '../services/blockService',
    '../controllers/authController', '../controllers/userController',
    '../controllers/storyController', '../controllers/chatController',
    '../controllers/blockController',
    '../routes/auth', '../routes/users', '../routes/stories',
    '../routes/conversations', '../routes/blocks', '../index',
  ].forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');
  return buildApp();
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
const BASE = '/flamebackend/v1/conversations';

async function openConversation(app, a, bId) {
  const r = await request(app).post(BASE).set(authH(a.token))
    .send({ user_id: bId }).expect(201);
  return r.body.data.id;
}

test('a message can declare itself a sticker', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'aa@x.com');
  const b = await registerUser(app, 'bb@x.com');
  const convId = await openConversation(app, a, b.id);

  const res = await request(app).post(`${BASE}/${convId}/messages`).set(authH(a.token))
    .send({ text: '🎉', message_type: 'sticker' })
    .expect(201);

  assert.equal(res.body.data.message_type, 'sticker');
  assert.equal(res.body.data.text, '🎉');
});

test('omitting message_type still sends text', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'cc@x.com');
  const b = await registerUser(app, 'dd@x.com');
  const convId = await openConversation(app, a, b.id);

  const res = await request(app).post(`${BASE}/${convId}/messages`).set(authH(a.token))
    .send({ text: 'hello' })
    .expect(201);

  // Every already-installed client omits it. Defaulting anywhere but 'text'
  // would relabel every message they send.
  assert.equal(res.body.data.message_type, 'text');
});

test('an arbitrary message_type is rejected', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'ee@x.com');
  const b = await registerUser(app, 'ff@x.com');
  const convId = await openConversation(app, a, b.id);

  // The media kinds have their own upload routes with size and MIME checks.
  // Letting this field name one would be a way to fabricate a media message
  // with no file behind it.
  for (const bad of ['image', 'video', 'voice', 'audio', 'hologram']) {
    await request(app).post(`${BASE}/${convId}/messages`).set(authH(a.token))
      .send({ text: 'x', message_type: bad })
      .expect(422);
  }
});

test('a sticker still runs the block and ended-match guards', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'gg@x.com');
  const b = await registerUser(app, 'hh@x.com');
  const convId = await openConversation(app, a, b.id);

  await request(app).post('/flamebackend/v1/blocks').set(authH(a.token))
    .send({ user_id: b.id }).expect(201);

  // Same preamble as a text send — a new message KIND must not become a new
  // way around the exclusions.
  await request(app).post(`${BASE}/${convId}/messages`).set(authH(a.token))
    .send({ text: '🎉', message_type: 'sticker' })
    .expect(403);
});

test('a sticker is a valid reply target and can itself reply', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'ii@x.com');
  const b = await registerUser(app, 'jj@x.com');
  const convId = await openConversation(app, a, b.id);

  const first = await request(app).post(`${BASE}/${convId}/messages`).set(authH(b.token))
    .send({ text: 'good news' }).expect(201);

  const res = await request(app).post(`${BASE}/${convId}/messages`).set(authH(a.token))
    .send({ text: '🎉', message_type: 'sticker', reply_to: first.body.data.id })
    .expect(201);

  assert.equal(res.body.data.message_type, 'sticker');
  assert.ok(res.body.data.reply_to);
});

test('a sticker bumps the conversation like any message', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'kk@x.com');
  const b = await registerUser(app, 'll@x.com');
  const convId = await openConversation(app, a, b.id);

  await request(app).post(`${BASE}/${convId}/messages`).set(authH(a.token))
    .send({ text: '🎉', message_type: 'sticker' }).expect(201);

  const r = await request(app).get(BASE).set(authH(b.token)).expect(200);
  const conv = r.body.data.conversations[0];

  assert.equal(conv.unread_count, 1);
  assert.equal(conv.last_message.message_type, 'sticker');
});
