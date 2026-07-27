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
    '../models/Conversation', '../models/Message',
    '../services/authService', '../services/userService', '../services/storyService',
    '../services/chatService',
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
    email, password: 'Hunter2!!', name: email.split('@')[0].padEnd(2, 'x'),
    age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
  };
  const r = await request(app).post('/flamebackend/v1/auth/register').send(body).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

const authH = (token) => ({ Authorization: `Bearer ${token}` });

async function openAndSend(app, a, b, text = 'original text') {
  const conv = (await request(app).post('/flamebackend/v1/conversations')
    .set(authH(a.token)).send({ user_id: b.id }).expect(201)).body.data.id;
  const msg = await request(app).post(`/flamebackend/v1/conversations/${conv}/messages`)
    .set(authH(a.token)).send({ text }).expect(201);
  return { convId: conv, msgId: msg.body.data.id };
}

test('sender edits their own message → is_edited true, text changed', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const { msgId } = await openAndSend(app, a, b);

  const edited = await request(app).patch(`/flamebackend/v1/messages/${msgId}`)
    .set(authH(a.token)).send({ text: 'updated text' }).expect(200);
  assert.equal(edited.body.data.text, 'updated text');
  assert.equal(edited.body.data.is_edited, true);
  assert.ok(edited.body.data.edited_at);
});

test('editing another user\'s message is forbidden (403)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const { msgId } = await openAndSend(app, a, b);

  await request(app).patch(`/flamebackend/v1/messages/${msgId}`)
    .set(authH(b.token)).send({ text: 'i am not the sender' }).expect(403);
});

test('editing a deleted message fails', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const { msgId } = await openAndSend(app, a, b);

  await request(app).delete(`/flamebackend/v1/messages/${msgId}?scope=everyone`)
    .set(authH(a.token)).expect(200);

  await request(app).patch(`/flamebackend/v1/messages/${msgId}`)
    .set(authH(a.token)).send({ text: 'too late' }).expect(422);
});

test('editing after the 15-minute window is expired (422)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const { msgId } = await openAndSend(app, a, b);

  // Mongoose's timestamps plugin strips createdAt from Model.updateOne($set) to
  // protect it from accidental overwrites, so we go through the raw driver
  // collection to backdate this message for the expiry check.
  const Message = require('../models/Message');
  await Message.collection.updateOne(
    { _id: new (require('mongoose').Types.ObjectId)(msgId) },
    { $set: { createdAt: new Date(Date.now() - 16 * 60 * 1000) } },
  );

  const res = await request(app).patch(`/flamebackend/v1/messages/${msgId}`)
    .set(authH(a.token)).send({ text: 'too late' }).expect(422);
  assert.equal(res.body.error.code, 'EDIT_WINDOW_EXPIRED');
});

test('editing requires auth (401)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const { msgId } = await openAndSend(app, a, b);

  await request(app).patch(`/flamebackend/v1/messages/${msgId}`)
    .send({ text: 'no auth' }).expect(401);
});

test('delete-for-everyone by sender → is_deleted true, text empty, hidden from both', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const { convId, msgId } = await openAndSend(app, a, b);

  const del = await request(app).delete(`/flamebackend/v1/messages/${msgId}?scope=everyone`)
    .set(authH(a.token)).expect(200);
  assert.equal(del.body.data.is_deleted, true);
  assert.equal(del.body.data.text, '');

  const threadA = await request(app).get(`/flamebackend/v1/conversations/${convId}/messages`)
    .set(authH(a.token)).expect(200);
  assert.equal(threadA.body.data.messages.length, 0);

  const threadB = await request(app).get(`/flamebackend/v1/conversations/${convId}/messages`)
    .set(authH(b.token)).expect(200);
  assert.equal(threadB.body.data.messages.length, 0);
});

test('delete-for-everyone by non-sender is forbidden (403)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const { msgId } = await openAndSend(app, a, b);

  await request(app).delete(`/flamebackend/v1/messages/${msgId}?scope=everyone`)
    .set(authH(b.token)).expect(403);
});

test('delete-for-everyone after the 1-hour window is expired (422)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const { msgId } = await openAndSend(app, a, b);

  const Message = require('../models/Message');
  await Message.collection.updateOne(
    { _id: new (require('mongoose').Types.ObjectId)(msgId) },
    { $set: { createdAt: new Date(Date.now() - 61 * 60 * 1000) } },
  );

  const res = await request(app).delete(`/flamebackend/v1/messages/${msgId}?scope=everyone`)
    .set(authH(a.token)).expect(422);
  assert.equal(res.body.error.code, 'DELETE_WINDOW_EXPIRED');
});

test('delete-for-me hides the message from the deleter but not the other participant', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const { convId, msgId } = await openAndSend(app, a, b);

  const del = await request(app).delete(`/flamebackend/v1/messages/${msgId}`)
    .set(authH(a.token)).expect(200);
  assert.equal(del.body.data.is_deleted, false);

  const threadA = await request(app).get(`/flamebackend/v1/conversations/${convId}/messages`)
    .set(authH(a.token)).expect(200);
  assert.equal(threadA.body.data.messages.length, 0);

  const threadB = await request(app).get(`/flamebackend/v1/conversations/${convId}/messages`)
    .set(authH(b.token)).expect(200);
  assert.equal(threadB.body.data.messages.length, 1);
  assert.equal(threadB.body.data.messages[0].text, 'original text');
});

test('deleting requires auth (401)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const { msgId } = await openAndSend(app, a, b);

  await request(app).delete(`/flamebackend/v1/messages/${msgId}`).expect(401);
});
