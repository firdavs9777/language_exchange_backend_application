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
    '../services/matchService',
    '../controllers/authController', '../controllers/userController', '../controllers/storyController',
    '../controllers/chatController',
    '../routes/auth', '../routes/users', '../routes/stories', '../routes/conversations', '../index',
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
const P = '/flamebackend/v1';

// Registers two users, opens a conversation, and sends `count` messages from a.
// Returns ids oldest-first.
async function seed(app, count) {
  const a = await registerUser(app, 'cur-a@x.com');
  const b = await registerUser(app, 'cur-b@x.com');
  const open = await request(app).post(`${P}/conversations`)
    .set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const convId = open.body.data.id;
  const ids = [];
  for (let i = 0; i < count; i++) {
    const res = await request(app).post(`${P}/conversations/${convId}/messages`)
      .set(authH(a.token)).send({ text: `m${i}` }).expect(201);
    ids.push(res.body.data.id);
  }
  return { a, b, convId, ids };
}

test('before returns strictly older messages, with no overlap', async (t) => {
  const app = await setup();
  t.after(teardown);
  const { a, convId, ids } = await seed(app, 5);

  const page1 = await request(app)
    .get(`${P}/conversations/${convId}/messages?limit=2`)
    .set(authH(a.token)).expect(200);
  const p1 = page1.body.data.messages.map((m) => m.id);
  assert.deepEqual(p1, [ids[4], ids[3]]);
  assert.equal(page1.body.data.pagination.has_more, true);

  const page2 = await request(app)
    .get(`${P}/conversations/${convId}/messages?limit=2&before=${ids[3]}`)
    .set(authH(a.token)).expect(200);
  const p2 = page2.body.data.messages.map((m) => m.id);
  assert.deepEqual(p2, [ids[2], ids[1]]);
  assert.equal(p2.some((id) => p1.includes(id)), false);
});

test('a message arriving between pages causes neither gap nor duplicate', async (t) => {
  const app = await setup();
  t.after(teardown);
  const { a, b, convId, ids } = await seed(app, 5);

  const page1 = await request(app)
    .get(`${P}/conversations/${convId}/messages?limit=2`)
    .set(authH(a.token)).expect(200);
  const p1 = page1.body.data.messages.map((m) => m.id);
  const cursor = p1[p1.length - 1];

  // The partner sends while we are paging. Under skip/offset this shifted the
  // window and page 2 lost the oldest message it should have returned.
  await request(app).post(`${P}/conversations/${convId}/messages`)
    .set(authH(b.token)).send({ text: 'interleaved' }).expect(201);

  const page2 = await request(app)
    .get(`${P}/conversations/${convId}/messages?limit=2&before=${cursor}`)
    .set(authH(a.token)).expect(200);
  const p2 = page2.body.data.messages.map((m) => m.id);

  assert.deepEqual(p2, [ids[2], ids[1]]);
  assert.equal(p2.some((id) => p1.includes(id)), false);
});

test('the offset path still works and still returns total', async (t) => {
  const app = await setup();
  t.after(teardown);
  const { a, convId } = await seed(app, 5);

  const res = await request(app)
    .get(`${P}/conversations/${convId}/messages?limit=2&offset=2`)
    .set(authH(a.token)).expect(200);
  assert.equal(res.body.data.messages.length, 2);
  assert.equal(res.body.data.pagination.total, 5);
});

test('before wins when both before and offset are sent', async (t) => {
  const app = await setup();
  t.after(teardown);
  const { a, convId, ids } = await seed(app, 5);

  const res = await request(app)
    .get(`${P}/conversations/${convId}/messages?limit=2&before=${ids[3]}&offset=99`)
    .set(authH(a.token)).expect(200);
  // offset=99 alone would return nothing; before wins.
  assert.deepEqual(res.body.data.messages.map((m) => m.id), [ids[2], ids[1]]);
});

test('a malformed before is rejected, not silently ignored', async (t) => {
  const app = await setup();
  t.after(teardown);
  const { a, convId } = await seed(app, 2);

  await request(app)
    .get(`${P}/conversations/${convId}/messages?before=not-an-object-id`)
    .set(authH(a.token)).expect(422);
});
