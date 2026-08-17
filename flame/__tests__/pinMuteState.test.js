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

// Pin and mute have had working backends and app service calls for a while,
// and no UI — partly because the app had no way to LEARN the state. Nothing in
// the conversation payload said whether it was muted, and pins were only ever
// returned by the mutators, so a pinned bar would have been empty on entry and
// vanished on reopen.

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
    '../services/blockService', '../services/conversationControlsService',
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

async function send(app, from, convId, text) {
  const r = await request(app).post(`${BASE}/${convId}/messages`).set(authH(from.token))
    .send({ text }).expect(201);
  return r.body.data.id;
}

const firstConversation = async (app, token) => {
  const r = await request(app).get(BASE).set(authH(token)).expect(200);
  return r.body.data.conversations[0];
};

test('a conversation reports whether the caller has muted it', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'aa@x.com');
  const b = await registerUser(app, 'bb@x.com');
  const convId = await openConversation(app, a, b.id);

  assert.equal((await firstConversation(app, a.token)).is_muted, false);

  await request(app).post(`${BASE}/${convId}/mute`).set(authH(a.token))
    .send({}).expect(201);

  assert.equal((await firstConversation(app, a.token)).is_muted, true,
    'without this the mute menu item has to guess its own state');
});

test('mute state is per viewer', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'cc@x.com');
  const b = await registerUser(app, 'dd@x.com');
  const convId = await openConversation(app, a, b.id);

  await request(app).post(`${BASE}/${convId}/mute`).set(authH(a.token))
    .send({}).expect(201);

  assert.equal((await firstConversation(app, a.token)).is_muted, true);
  assert.equal((await firstConversation(app, b.token)).is_muted, false,
    'muting is one participant\'s choice');
});

test('an expired mute reports as not muted', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'ee@x.com');
  const b = await registerUser(app, 'ff@x.com');
  const convId = await openConversation(app, a, b.id);

  const Conversation = require('../models/Conversation');
  await Conversation.updateOne(
    { _id: convId },
    { $push: { mutedBy: { user: a.id, mutedUntil: new Date(Date.now() - 1000) } } },
  );

  // The expiry rule lives in one place; a second copy in toConversation would
  // be free to disagree with isMutedFor, and only one of them gates push.
  assert.equal((await firstConversation(app, a.token)).is_muted, false);
});

test('GET /pins returns the caller\'s pinned messages with content', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'gg@x.com');
  const b = await registerUser(app, 'hh@x.com');
  const convId = await openConversation(app, a, b.id);
  const msgId = await send(app, b, convId, 'meet at seven');

  await request(app).post(`${BASE}/${convId}/pin`).set(authH(a.token))
    .send({ message_id: msgId }).expect(201);

  const r = await request(app).get(`${BASE}/${convId}/pins`).set(authH(a.token)).expect(200);

  assert.equal(r.body.data.pinned_messages.length, 1);
  assert.equal(r.body.data.pinned_messages[0].message_id, msgId);
  assert.equal(r.body.data.pinned_messages[0].content, 'meet at seven',
    'a bar showing an id instead of the message is not a bar');
});

test('GET /pins is empty before anything is pinned', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'ii@x.com');
  const b = await registerUser(app, 'jj@x.com');
  const convId = await openConversation(app, a, b.id);

  const r = await request(app).get(`${BASE}/${convId}/pins`).set(authH(a.token)).expect(200);
  assert.deepEqual(r.body.data.pinned_messages, []);
});

test('GET /pins is scoped to the caller', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'kk@x.com');
  const b = await registerUser(app, 'll@x.com');
  const convId = await openConversation(app, a, b.id);
  const msgId = await send(app, b, convId, 'meet at seven');

  await request(app).post(`${BASE}/${convId}/pin`).set(authH(a.token))
    .send({ message_id: msgId }).expect(201);

  const r = await request(app).get(`${BASE}/${convId}/pins`).set(authH(b.token)).expect(200);
  assert.deepEqual(r.body.data.pinned_messages, [],
    'both users\' pins live in one array on one document');
});

test('a non-participant cannot read the pins', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'mm@x.com');
  const b = await registerUser(app, 'nn@x.com');
  const stranger = await registerUser(app, 'oo@x.com');
  const convId = await openConversation(app, a, b.id);

  await request(app).get(`${BASE}/${convId}/pins`).set(authH(stranger.token)).expect(403);
});
