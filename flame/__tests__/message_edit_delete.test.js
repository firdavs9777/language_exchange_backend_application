// Stub Flame's S3 util so tests don't hit DigitalOcean. deleteObject records
// its keys so "delete for everyone" can be checked against the bucket, not
// just against the row.
const deletedKeys = [];
require.cache[require.resolve('../utils/s3')] = {
  exports: {
    uploadBuffer: async (_buf, key) => `https://stub.example.com/${key}`,
    deleteObject: async (key) => { deletedKeys.push(key); },
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

// "Delete for everyone" on a photo used to blank only `text`: mediaUrl stayed
// on the row, so toMessage kept handing out a live, world-readable Spaces URL
// for a message the sender had retracted, and the object itself was never
// deleted by any path. Invisible in the app (the bubble hides deleted
// messages) and a broken promise on a dating product.
test('delete-for-everyone on a media message revokes the url and the object', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const open = await request(app).post('/flamebackend/v1/conversations')
    .set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const convId = open.body.data.id;

  const sent = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/image`)
    .set(authH(a.token))
    .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { filename: 'p.jpg', contentType: 'image/jpeg' })
    .expect(201);
  assert.ok(sent.body.data.image_url, 'precondition: the send stored a media url');

  const Message = require('../models/Message');
  const stored = await Message.findById(sent.body.data.id).lean();
  const key = stored.mediaKey;
  assert.ok(key, 'precondition: the send stored a media key');

  deletedKeys.length = 0;
  const del = await request(app).delete(`/flamebackend/v1/messages/${sent.body.data.id}?scope=everyone`)
    .set(authH(a.token)).expect(200);

  assert.equal(del.body.data.is_deleted, true);
  assert.equal(del.body.data.image_url, null, 'the response must not keep serving the media url');
  assert.equal(del.body.data.media_info, null);

  const after = await Message.findById(sent.body.data.id).lean();
  assert.equal(after.mediaUrl, null, 'the row must not keep pointing at a live public object');
  assert.equal(after.mediaKey, null);
  assert.equal(after.thumbnailUrl, null);

  assert.deepEqual(deletedKeys, [key], 'the bucket object must be deleted, not orphaned forever');
});

// Best-effort means best-effort: the user asked for the message to be gone, so
// a Spaces outage must not turn that into a 500 with the row untouched.
test('a failing bucket delete does not fail delete-for-everyone', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const open = await request(app).post('/flamebackend/v1/conversations')
    .set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const convId = open.body.data.id;

  const sent = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/image`)
    .set(authH(a.token))
    .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { filename: 'p.jpg', contentType: 'image/jpeg' })
    .expect(201);

  const s3 = require('../utils/s3');
  const original = s3.deleteObject;
  s3.deleteObject = async () => { throw new Error('spaces is down'); };
  t.after(() => { s3.deleteObject = original; });

  const del = await request(app).delete(`/flamebackend/v1/messages/${sent.body.data.id}?scope=everyone`)
    .set(authH(a.token)).expect(200);
  assert.equal(del.body.data.is_deleted, true);
  assert.equal(del.body.data.image_url, null, 'the row is scrubbed before the bucket is touched');
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

test('delete-for-me hides the message from the conversation-list preview (per-user)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const { msgId } = await openAndSend(app, a, b, 'last message preview text');

  // B sees the preview before deleting.
  const listBBefore = await request(app).get('/flamebackend/v1/conversations')
    .set(authH(b.token)).expect(200);
  assert.equal(listBBefore.body.data.conversations[0].last_message.text, 'last message preview text');

  // B deletes it for themself only.
  await request(app).delete(`/flamebackend/v1/messages/${msgId}`)
    .set(authH(b.token)).expect(200);

  // B no longer sees a preview for that conversation.
  const listBAfter = await request(app).get('/flamebackend/v1/conversations')
    .set(authH(b.token)).expect(200);
  assert.equal(listBAfter.body.data.conversations[0].last_message, null);

  // A (who didn't delete it) still sees the preview text.
  const listA = await request(app).get('/flamebackend/v1/conversations')
    .set(authH(a.token)).expect(200);
  assert.equal(listA.body.data.conversations[0].last_message.text, 'last message preview text');
});

test('deleting requires auth (401)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const { msgId } = await openAndSend(app, a, b);

  await request(app).delete(`/flamebackend/v1/messages/${msgId}`).expect(401);
});
