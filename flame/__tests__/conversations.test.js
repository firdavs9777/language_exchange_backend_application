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
    // padEnd guards against short local-parts (e.g. 'a@x.com' -> 'a'), which would
    // otherwise fail the auth route's `name: z.string().min(2)` validation.
    email, password: 'Hunter2!!', name: email.split('@')[0].padEnd(2, 'x'),
    age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
  };
  const r = await request(app).post('/flamebackend/v1/auth/register').send(body).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

const authH = (token) => ({ Authorization: `Bearer ${token}` });

test('open → send → list → thread → mark read (happy path)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');

  // A opens a conversation with B
  const open = await request(app)
    .post('/flamebackend/v1/conversations')
    .set(authH(a.token))
    .send({ user_id: b.id })
    .expect(201);
  const convId = open.body.data.id;
  assert.equal(open.body.data.other_user_id, b.id);
  assert.equal(open.body.data.unread_count, 0);
  assert.equal(open.body.data.other_user.name, 'bx');

  // Opening again returns the SAME conversation (no duplicate)
  const open2 = await request(app)
    .post('/flamebackend/v1/conversations')
    .set(authH(a.token))
    .send({ user_id: b.id })
    .expect(201);
  assert.equal(open2.body.data.id, convId);

  // A sends a message
  const send = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages`)
    .set(authH(a.token))
    .send({ text: 'hello b' })
    .expect(201);
  assert.equal(send.body.data.text, 'hello b');
  assert.equal(send.body.data.sender_id, a.id);
  assert.equal(send.body.data.receiver_id, b.id);
  assert.equal(send.body.data.message_type, 'text');

  // B lists conversations → sees it with unread_count 1 and the last message
  const listB = await request(app)
    .get('/flamebackend/v1/conversations')
    .set(authH(b.token))
    .expect(200);
  assert.equal(listB.body.data.conversations.length, 1);
  assert.equal(listB.body.data.conversations[0].unread_count, 1);
  assert.equal(listB.body.data.conversations[0].last_message.text, 'hello b');
  assert.equal(listB.body.data.pagination.total, 1);
  assert.equal(listB.body.data.conversations[0].other_user.name, 'ax');

  // B reads the thread (newest first) and marks read
  const thread = await request(app)
    .get(`/flamebackend/v1/conversations/${convId}/messages`)
    .set(authH(b.token))
    .expect(200);
  assert.equal(thread.body.data.messages.length, 1);
  assert.equal(thread.body.data.messages[0].text, 'hello b');

  await request(app)
    .put(`/flamebackend/v1/conversations/${convId}/read`)
    .set(authH(b.token))
    .expect(200);

  const listB2 = await request(app)
    .get('/flamebackend/v1/conversations')
    .set(authH(b.token))
    .expect(200);
  assert.equal(listB2.body.data.conversations[0].unread_count, 0);
});

test('a non-participant is forbidden from the thread', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const c = await registerUser(app, 'c@x.com');
  const open = await request(app).post('/flamebackend/v1/conversations')
    .set(authH(a.token)).send({ user_id: b.id }).expect(201);
  await request(app)
    .get(`/flamebackend/v1/conversations/${open.body.data.id}/messages`)
    .set(authH(c.token))
    .expect(403);
});

test('unauthenticated requests are rejected', async (t) => {
  const app = await setup();
  t.after(teardown);
  await request(app).get('/flamebackend/v1/conversations').expect(401);
});

test('empty text is rejected (422)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const open = await request(app).post('/flamebackend/v1/conversations')
    .set(authH(a.token)).send({ user_id: b.id }).expect(201);
  await request(app)
    .post(`/flamebackend/v1/conversations/${open.body.data.id}/messages`)
    .set(authH(a.token))
    .send({ text: '' })
    .expect(422);
});

test('opening a conversation with a non-existent user is 404', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  await request(app).post('/flamebackend/v1/conversations')
    .set(authH(a.token))
    .send({ user_id: '0123456789abcdef01234567' })
    .expect(404);
});

test('reply_to references an earlier message in the same conversation', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const open = await request(app).post('/flamebackend/v1/conversations')
    .set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const conv = open.body.data.id;
  const first = await request(app).post(`/flamebackend/v1/conversations/${conv}/messages`)
    .set(authH(a.token)).send({ text: 'original' }).expect(201);

  const reply = await request(app).post(`/flamebackend/v1/conversations/${conv}/messages`)
    .set(authH(b.token)).send({ text: 'quoted!', reply_to: first.body.data.id }).expect(201);
  assert.equal(reply.body.data.reply_to, first.body.data.id);
});

test('reply_to pointing at another conversation is rejected (422)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const c = await registerUser(app, 'c@x.com');
  const convAB = (await request(app).post('/flamebackend/v1/conversations')
    .set(authH(a.token)).send({ user_id: b.id }).expect(201)).body.data.id;
  const convAC = (await request(app).post('/flamebackend/v1/conversations')
    .set(authH(a.token)).send({ user_id: c.id }).expect(201)).body.data.id;
  const msgInAC = await request(app).post(`/flamebackend/v1/conversations/${convAC}/messages`)
    .set(authH(a.token)).send({ text: 'in AC' }).expect(201);

  await request(app).post(`/flamebackend/v1/conversations/${convAB}/messages`)
    .set(authH(a.token)).send({ text: 'bad reply', reply_to: msgInAC.body.data.id })
    .expect(422);
});
