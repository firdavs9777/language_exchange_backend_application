// A media message must be delivered exactly like a text one: pushed over the
// socket and notified. It was not — sendMedia stored the message and returned
// it, with none of sendMessage's realtime/push side effects — so a received
// photo or voice note never reached the recipient's list, never moved the
// unread badge, never appeared in an open chat (the REST poll is disabled
// whenever realtime is on), and fired no notification.
//
// Both side effects are observed by stubbing the modules the controller
// lazily requires, which is also how the controller keeps them best-effort.
process.env.FLAME_SPACES_BUCKET = 't';
process.env.SPACES_ENDPOINT = 'e';
process.env.DO_SPACES_KEY = 'k';
process.env.DO_SPACES_SECRET = 's';

const S3_PATH = require.resolve('../utils/s3');
require.cache[S3_PATH] = {
  id: S3_PATH, filename: S3_PATH, loaded: true,
  exports: {
    uploadBuffer: async (_buf, key) => `https://stub.example.com/${key}`,
    deleteObject: async () => {},
    bucket: 'stub-bucket',
  },
};

// Captures, reset by each test through resetSpies().
const emitted = [];
const pushed = [];

const SOCKET_PATH = require.resolve('../socket/flameSocket');
require.cache[SOCKET_PATH] = {
  id: SOCKET_PATH, filename: SOCKET_PATH, loaded: true,
  exports: {
    emitNewMessage: (_io, receiverId, message) => { emitted.push({ receiverId, message }); },
    emitMessageEdited: () => {},
    emitMessageDeleted: () => {},
  },
};

const PUSH_PATH = require.resolve('../services/pushService');
require.cache[PUSH_PATH] = {
  id: PUSH_PATH, filename: PUSH_PATH, loaded: true,
  exports: {
    sendChatMessage: async (receiverId, payload) => { pushed.push({ receiverId, payload }); return { sent: 0 }; },
    sendToUser: async () => ({ sent: 0 }),
    isConfigured: () => false,
  },
};

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const dbHelper = require('./helpers/db');

function resetSpies() {
  emitted.length = 0;
  pushed.length = 0;
}

async function setup() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  [
    '../db', '../models/User', '../models/RefreshToken', '../models/Story',
    '../models/Conversation', '../models/Message', '../models/Swipe',
    '../models/Match',
    '../services/visibilityService', '../services/chatService',
    '../services/matchService', '../services/swipeService', '../services/blockService',
    '../services/mediaService', '../services/conversationControlsService',
    '../services/authService', '../services/userService', '../services/storyService',
    '../controllers/authController', '../controllers/userController', '../controllers/storyController',
    '../controllers/chatController', '../controllers/blockController',
    '../routes/auth', '../routes/users', '../routes/stories', '../routes/conversations',
    '../routes/blocks', '../index',
  ].forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');
  const app = buildApp();
  // The controller only emits when the app carries an io instance; its
  // identity is never inspected, only forwarded to the (stubbed) socket module.
  app.set('io', {});
  resetSpies();
  return app;
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

async function openConv(app, from, toId) {
  const r = await request(app).post('/flamebackend/v1/conversations')
    .set(authH(from.token)).send({ user_id: toId }).expect(201);
  return r.body.data.id;
}

const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);
const audioBytes = () => Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);

test('an image send pushes over the socket and notifies the receiver', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  const res = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/image`)
    .set(authH(a.token))
    .attach('image', jpeg(), { filename: 'photo.jpg', contentType: 'image/jpeg' })
    .expect(201);

  assert.equal(emitted.length, 1, 'a media send must emit message:new exactly once');
  assert.equal(emitted[0].receiverId, b.id, 'the push goes to the receiver, not the sender');
  assert.equal(emitted[0].message.id, res.body.data.id);
  assert.equal(emitted[0].message.message_type, 'image');
  assert.ok(emitted[0].message.image_url, 'the emitted payload must carry the media url');

  assert.equal(pushed.length, 1, 'a media send must fire exactly one chat notification');
  assert.equal(pushed[0].receiverId, b.id);
  assert.equal(pushed[0].payload.text, '[image]', 'a media message has no text; the body is the bracketed kind');
  assert.equal(pushed[0].payload.conversationId, convId);
});

test('a voice send pushes with the [voice] preview', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/voice`)
    .set(authH(a.token))
    .attach('voice', audioBytes(), { filename: 'note.m4a', contentType: 'audio/mp4' })
    .expect(201);

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].message.message_type, 'voice');
  assert.equal(pushed.length, 1);
  assert.equal(pushed[0].payload.text, '[voice]');
});

test('a rejected media send emits and notifies nothing', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/image`)
    .set(authH(a.token))
    .attach('image', Buffer.from('not-an-image'), { filename: 'file.zip', contentType: 'application/zip' })
    .expect(422);

  assert.equal(emitted.length, 0, 'nothing was stored, so nothing may be delivered');
  assert.equal(pushed.length, 0);
  assert.ok(b.id);
});
