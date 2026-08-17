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

// Search is the route most likely to become a side door into the exclusions
// Phase A established: it reads messages directly rather than going through the
// conversation list, so a filter that is merely SIMILAR to the list's would let
// a blocked pair's messages back out. Tests 2 and 3 are the point of the whole
// design.

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
    '../services/blockService', '../services/messageSearchService',
    '../controllers/authController', '../controllers/userController',
    '../controllers/storyController', '../controllers/chatController',
    '../controllers/blockController',
    '../routes/auth', '../routes/users', '../routes/stories',
    '../routes/conversations', '../routes/messages', '../routes/blocks',
    '../routes/matches', '../index',
  ].forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  // The $text index is declared on the schema; Mongoose only builds it when
  // asked, and an unbuilt text index makes every $text query error.
  const Message = require('../models/Message');
  await Message.createIndexes();

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
const CONV = '/flamebackend/v1/conversations';
const SEARCH = '/flamebackend/v1/messages/search';

async function openConversation(app, a, bId) {
  const r = await request(app).post(CONV).set(authH(a.token))
    .send({ user_id: bId }).expect(201);
  return r.body.data.id;
}

async function send(app, from, convId, text) {
  const r = await request(app).post(`${CONV}/${convId}/messages`).set(authH(from.token))
    .send({ text }).expect(201);
  return r.body.data.id;
}

const search = async (app, token, q, extra = '') => {
  const r = await request(app).get(`${SEARCH}?q=${encodeURIComponent(q)}${extra}`)
    .set(authH(token)).expect(200);
  return r.body.data;
};

test('finds a matching message', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'aa@x.com');
  const b = await registerUser(app, 'bb@x.com');
  const convId = await openConversation(app, a, b.id);
  await send(app, b, convId, 'shall we get sushi tomorrow');

  const data = await search(app, a.token, 'sushi');

  assert.equal(data.total, 1);
  assert.equal(data.messages.length, 1);
  assert.match(data.messages[0].text, /sushi/);
  assert.equal(data.messages[0].conversation_id, convId,
    'a result the caller cannot navigate to is not a result');
});

test('a blocked pair\'s messages are unreachable', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'cc@x.com');
  const b = await registerUser(app, 'dd@x.com');
  const convId = await openConversation(app, a, b.id);
  await send(app, b, convId, 'shall we get sushi tomorrow');

  assert.equal((await search(app, a.token, 'sushi')).total, 1);

  await request(app).post('/flamebackend/v1/blocks').set(authH(a.token))
    .send({ user_id: b.id }).expect(201);

  // This is the hole the design exists to keep shut. A search that returns a
  // blocked pair's messages reopens Phase A through a route nobody audited.
  const after = await search(app, a.token, 'sushi');
  assert.equal(after.total, 0);
  assert.deepEqual(after.messages, []);
});

test('an ended match\'s messages are unreachable', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'ee@x.com');
  const b = await registerUser(app, 'ff@x.com');
  const convId = await openConversation(app, a, b.id);
  await send(app, b, convId, 'shall we get sushi tomorrow');

  const Match = require('../models/Match');
  await Match.create({
    users: [a.id, b.id], conversationId: convId, endedBy: a.id,
  });

  assert.equal((await search(app, a.token, 'sushi')).total, 0);
});

test('another user\'s conversation is never searched', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'gg@x.com');
  const b = await registerUser(app, 'hh@x.com');
  const c = await registerUser(app, 'ii@x.com');

  const theirs = await openConversation(app, b, c.id);
  await send(app, b, theirs, 'shall we get sushi tomorrow');

  assert.equal((await search(app, a.token, 'sushi')).total, 0);
});

test('an archived conversation is still mine to search', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'jj@x.com');
  const b = await registerUser(app, 'kk@x.com');
  const convId = await openConversation(app, a, b.id);
  await send(app, b, convId, 'shall we get sushi tomorrow');

  await request(app).post(`${CONV}/${convId}/archive`).set(authH(a.token)).expect(200);

  // Filing something away is not forgetting it.
  assert.equal((await search(app, a.token, 'sushi')).total, 1);
});

test('deleted messages are excluded', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'll@x.com');
  const b = await registerUser(app, 'mm@x.com');
  const convId = await openConversation(app, a, b.id);
  const msgId = await send(app, b, convId, 'shall we get sushi tomorrow');

  await request(app).delete(`/flamebackend/v1/messages/${msgId}?scope=everyone`)
    .set(authH(b.token)).expect(200);

  assert.equal((await search(app, a.token, 'sushi')).total, 0);
});

test('a message deleted for me is hidden from me but not from them', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'nn@x.com');
  const b = await registerUser(app, 'oo@x.com');
  const convId = await openConversation(app, a, b.id);
  const msgId = await send(app, b, convId, 'shall we get sushi tomorrow');

  await request(app).delete(`/flamebackend/v1/messages/${msgId}?scope=me`)
    .set(authH(a.token)).expect(200);

  assert.equal((await search(app, a.token, 'sushi')).total, 0);
  assert.equal((await search(app, b.token, 'sushi')).total, 1,
    'delete-for-me is one person\'s view, not a retraction');
});

test('total and the page agree', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'pp@x.com');
  const b = await registerUser(app, 'qq@x.com');
  const convId = await openConversation(app, a, b.id);
  await send(app, b, convId, 'sushi one');
  await send(app, b, convId, 'sushi two');
  await send(app, b, convId, 'sushi three');

  const data = await search(app, a.token, 'sushi', '&limit=2');

  assert.equal(data.messages.length, 2);
  assert.equal(data.total, 3, 'total is the match count, not the page size');
});

test('an oversized limit is capped', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'rr@x.com');
  const b = await registerUser(app, 'ss@x.com');
  const convId = await openConversation(app, a, b.id);
  await send(app, b, convId, 'sushi');

  // Asking for 5000 must not become a 5000-document response.
  const data = await search(app, a.token, 'sushi', '&limit=5000');
  assert.ok(data.messages.length <= 100);
});

test('an empty query is rejected rather than returning everything', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'tt@x.com');

  await request(app).get(`${SEARCH}?q=`).set(authH(a.token)).expect(422);
});

test('search requires authentication', async (t) => {
  const app = await setup(t);
  await request(app).get(`${SEARCH}?q=sushi`).expect(401);
});
