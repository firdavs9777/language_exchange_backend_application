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

// Takes the test context so teardown registers BEFORE anything that can throw:
// a failing require in between leaves the mongod running and node never exits.
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
    // blockService binds User at load, so it keeps the previous test's closed
    // connection unless it is cleared here too — the block test 500s otherwise
    // with MongoNotConnectedError.
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
    // padEnd guards against short local-parts, which would fail the auth
    // route's `name: z.string().min(2)` validation.
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

const listIds = async (app, token, { archived = false } = {}) => {
  const r = await request(app)
    .get(`${BASE}?archived=${archived}`)
    .set(authH(token))
    .expect(200);
  return r.body.data.conversations.map((c) => c.id);
};

test('archiving removes it from the default list', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'aa@x.com');
  const b = await registerUser(app, 'bb@x.com');
  const convId = await openConversation(app, a, b.id);

  assert.deepEqual(await listIds(app, a.token), [convId]);

  await request(app).post(`${BASE}/${convId}/archive`).set(authH(a.token)).expect(200);

  assert.deepEqual(await listIds(app, a.token), []);
});

test('an archived conversation is reachable through ?archived=true', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'cc@x.com');
  const b = await registerUser(app, 'dd@x.com');
  const convId = await openConversation(app, a, b.id);

  await request(app).post(`${BASE}/${convId}/archive`).set(authH(a.token)).expect(200);

  // Without this the conversation is unreachable — the messages still there,
  // the user unable to get to them. That is data loss by another name.
  assert.deepEqual(await listIds(app, a.token, { archived: true }), [convId]);
});

test('archiving affects only the archiving user', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'ee@x.com');
  const b = await registerUser(app, 'ff@x.com');
  const convId = await openConversation(app, a, b.id);

  await request(app).post(`${BASE}/${convId}/archive`).set(authH(a.token)).expect(200);

  assert.deepEqual(await listIds(app, b.token), [convId],
    'archiving is one participant\'s filing decision, not a shared state change');
});

test('unarchiving puts it back', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'gg@x.com');
  const b = await registerUser(app, 'hh@x.com');
  const convId = await openConversation(app, a, b.id);

  await request(app).post(`${BASE}/${convId}/archive`).set(authH(a.token)).expect(200);
  await request(app).delete(`${BASE}/${convId}/archive`).set(authH(a.token)).expect(200);

  assert.deepEqual(await listIds(app, a.token), [convId]);
  assert.deepEqual(await listIds(app, a.token, { archived: true }), []);
});

test('archiving twice leaves exactly one entry', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'ii@x.com');
  const b = await registerUser(app, 'jj@x.com');
  const convId = await openConversation(app, a, b.id);

  await request(app).post(`${BASE}/${convId}/archive`).set(authH(a.token)).expect(200);
  await request(app).post(`${BASE}/${convId}/archive`).set(authH(a.token)).expect(200);

  const Conversation = require('../models/Conversation');
  const conv = await Conversation.findById(convId).lean();

  // $addToSet would NOT dedupe these: they carry an archivedAt, so no two
  // entries for one user are ever equal. The guard is an explicit $ne filter.
  assert.equal(conv.archivedBy.length, 1);
  assert.equal(conv.archivedBy[0].user, a.id);
});

test('a non-participant gets 403 on both verbs', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'kk@x.com');
  const b = await registerUser(app, 'll@x.com');
  const stranger = await registerUser(app, 'mm@x.com');
  const convId = await openConversation(app, a, b.id);

  await request(app).post(`${BASE}/${convId}/archive`)
    .set(authH(stranger.token)).expect(403);
  await request(app).delete(`${BASE}/${convId}/archive`)
    .set(authH(stranger.token)).expect(403);
});

test('archiving does not stop unread counting', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'nn@x.com');
  const b = await registerUser(app, 'oo@x.com');
  const convId = await openConversation(app, a, b.id);

  await request(app).post(`${BASE}/${convId}/archive`).set(authH(a.token)).expect(200);

  await request(app).post(`${BASE}/${convId}/messages`).set(authH(b.token))
    .send({ text: 'still here' }).expect(201);

  // Archive is filing, not muting and not blocking. The message still arrives
  // and still counts; it is just filed away.
  const r = await request(app).get(`${BASE}?archived=true`).set(authH(a.token)).expect(200);
  assert.equal(r.body.data.conversations[0].unread_count, 1);
});

test('the archived list still excludes blocked partners', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'pp@x.com');
  const blocked = await registerUser(app, 'qq@x.com');
  const normal = await registerUser(app, 'rr@x.com');

  const blockedConv = await openConversation(app, a, blocked.id);
  const normalConv = await openConversation(app, a, normal.id);

  await request(app).post(`${BASE}/${blockedConv}/archive`).set(authH(a.token)).expect(200);
  await request(app).post(`${BASE}/${normalConv}/archive`).set(authH(a.token)).expect(200);

  await request(app).post('/flamebackend/v1/blocks').set(authH(a.token))
    .send({ user_id: blocked.id }).expect(201);

  // The archived list runs through the same filter as the default one, so a
  // block hides a conversation on both sides of the archive line. Re-deriving
  // the filter for the archived case is exactly how that would stop being true.
  assert.deepEqual(await listIds(app, a.token, { archived: true }), [normalConv]);
});
