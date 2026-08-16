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
    // chatService/userService/storyService enforce blocks through
    // visibilityService, which binds User and Swipe at load — clear all three
    // or they keep the previous test's closed connection. chatService also
    // consults matchService (ended matches close the conversation), which binds
    // Match, so those two go in the list for the same reason.
    // conversationControlsService binds Conversation/Message directly and
    // reuses chatService's participant helper, so it goes here too.
    '../services/visibilityService', '../services/chatService',
    '../services/matchService', '../services/conversationControlsService',
    '../services/authService', '../services/userService', '../services/storyService',
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
const BASE = '/flamebackend/v1/conversations';

test('mute mutes for the caller only — the other participant is unaffected', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const open = await request(app).post(BASE).set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const convId = open.body.data.id;

  await request(app).post(`${BASE}/${convId}/mute`).set(authH(a.token)).send({}).expect(201);

  const Conversation = require('../models/Conversation');
  const conv = await Conversation.findById(convId).lean();
  assert.equal(conv.mutedBy.length, 1);
  assert.equal(conv.mutedBy[0].user, a.id);
  assert.equal(conv.mutedBy[0].mutedUntil, null);
  assert.ok(!conv.mutedBy.some((m) => m.user === b.id), "muting must not create an entry for the other participant");
});

test('mute with a duration sets a future mutedUntil; DELETE /mute unmutes', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const open = await request(app).post(BASE).set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const convId = open.body.data.id;

  const before = Date.now();
  await request(app).post(`${BASE}/${convId}/mute`).set(authH(a.token)).send({ duration: 60000 }).expect(201);

  const Conversation = require('../models/Conversation');
  let conv = await Conversation.findById(convId).lean();
  let entry = conv.mutedBy.find((m) => m.user === a.id);
  assert.ok(entry, 'expected a mutedBy entry for a');
  assert.ok(entry.mutedUntil, 'expected mutedUntil to be set for a timed mute');
  assert.ok(new Date(entry.mutedUntil).getTime() > before);

  await request(app).delete(`${BASE}/${convId}/mute`).set(authH(a.token)).expect(200);
  conv = await Conversation.findById(convId).lean();
  entry = conv.mutedBy.find((m) => m.user === a.id);
  assert.equal(entry, undefined, 'unmute must remove the entry entirely');
});

test('muting twice does not create duplicate entries (the $addToSet trap)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const open = await request(app).post(BASE).set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const convId = open.body.data.id;

  await request(app).post(`${BASE}/${convId}/mute`).set(authH(a.token)).send({}).expect(201);
  await request(app).post(`${BASE}/${convId}/mute`).set(authH(a.token)).send({ duration: 60000 }).expect(201);

  const Conversation = require('../models/Conversation');
  const conv = await Conversation.findById(convId).lean();
  const entries = conv.mutedBy.filter((m) => m.user === a.id);
  assert.equal(entries.length, 1, 'a second mute call must update the existing entry, not push a duplicate');
  assert.ok(entries[0].mutedUntil, 'the second call\'s duration should have taken effect');
});

test('muting does not hide the conversation or stop unread counting', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const open = await request(app).post(BASE).set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const convId = open.body.data.id;

  await request(app).post(`${BASE}/${convId}/mute`).set(authH(a.token)).send({}).expect(201);

  // B sends a message to A while A has the conversation muted.
  await request(app).post(`${BASE}/${convId}/messages`).set(authH(b.token)).send({ text: 'hi' }).expect(201);

  const listA = await request(app).get(BASE).set(authH(a.token)).expect(200);
  assert.equal(listA.body.data.conversations.length, 1, 'a muted conversation must still be listed');
  assert.equal(listA.body.data.conversations[0].id, convId);
  assert.equal(listA.body.data.conversations[0].unread_count, 1, 'muting must not stop unread counting');
});

test('pin with { message_id } pins for the caller only', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const open = await request(app).post(BASE).set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const convId = open.body.data.id;
  const msg = await request(app).post(`${BASE}/${convId}/messages`).set(authH(a.token)).send({ text: 'pin me' }).expect(201);
  const msgId = msg.body.data.id;

  await request(app).post(`${BASE}/${convId}/pin`).set(authH(a.token)).send({ message_id: msgId }).expect(201);

  const Conversation = require('../models/Conversation');
  const conv = await Conversation.findById(convId).lean();
  assert.equal(conv.pinnedBy.length, 1);
  assert.equal(conv.pinnedBy[0].user, a.id);
  assert.equal(conv.pinnedBy[0].messageId, msgId);
  assert.ok(!conv.pinnedBy.some((p) => p.user === b.id), "pinning must not create an entry for the other participant");
});

test('DELETE /pin/:messageId unpins', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const open = await request(app).post(BASE).set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const convId = open.body.data.id;
  const msg = await request(app).post(`${BASE}/${convId}/messages`).set(authH(a.token)).send({ text: 'pin me' }).expect(201);
  const msgId = msg.body.data.id;

  await request(app).post(`${BASE}/${convId}/pin`).set(authH(a.token)).send({ message_id: msgId }).expect(201);
  await request(app).delete(`${BASE}/${convId}/pin/${msgId}`).set(authH(a.token)).expect(200);

  const Conversation = require('../models/Conversation');
  const conv = await Conversation.findById(convId).lean();
  assert.equal(conv.pinnedBy.length, 0);
});

test('pinning the same message twice does not create duplicate entries', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const open = await request(app).post(BASE).set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const convId = open.body.data.id;
  const msg = await request(app).post(`${BASE}/${convId}/messages`).set(authH(a.token)).send({ text: 'pin me' }).expect(201);
  const msgId = msg.body.data.id;

  await request(app).post(`${BASE}/${convId}/pin`).set(authH(a.token)).send({ message_id: msgId }).expect(201);
  await request(app).post(`${BASE}/${convId}/pin`).set(authH(a.token)).send({ message_id: msgId }).expect(201);

  const Conversation = require('../models/Conversation');
  const conv = await Conversation.findById(convId).lean();
  const entries = conv.pinnedBy.filter((p) => p.user === a.id && p.messageId === msgId);
  assert.equal(entries.length, 1, 'pinning the same message twice must not push a duplicate entry');
});

test('a non-participant gets 403 on mute, unmute, pin and unpin', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const c = await registerUser(app, 'c@x.com');
  const open = await request(app).post(BASE).set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const convId = open.body.data.id;
  const msg = await request(app).post(`${BASE}/${convId}/messages`).set(authH(a.token)).send({ text: 'x' }).expect(201);
  const msgId = msg.body.data.id;

  // _assertParticipant (shared with the rest of chat) throws 403, not 404 —
  // consistent with the rest of the chat surface (see getMessages).
  await request(app).post(`${BASE}/${convId}/mute`).set(authH(c.token)).send({}).expect(403);
  await request(app).delete(`${BASE}/${convId}/mute`).set(authH(c.token)).expect(403);
  await request(app).post(`${BASE}/${convId}/pin`).set(authH(c.token)).send({ message_id: msgId }).expect(403);
  await request(app).delete(`${BASE}/${convId}/pin/${msgId}`).set(authH(c.token)).expect(403);
});

test('pinning a message that belongs to another conversation is 422', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const c = await registerUser(app, 'c@x.com');
  const convAB = (await request(app).post(BASE).set(authH(a.token)).send({ user_id: b.id }).expect(201)).body.data.id;
  const convAC = (await request(app).post(BASE).set(authH(a.token)).send({ user_id: c.id }).expect(201)).body.data.id;
  const msgInAC = await request(app).post(`${BASE}/${convAC}/messages`).set(authH(a.token)).send({ text: 'in AC' }).expect(201);

  await request(app).post(`${BASE}/${convAB}/pin`)
    .set(authH(a.token)).send({ message_id: msgInAC.body.data.id }).expect(422);
});

test('isMutedFor treats an expired mutedUntil as not muted, but an indefinite mute as muted', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const open = await request(app).post(BASE).set(authH(a.token)).send({ user_id: b.id }).expect(201);
  const convId = open.body.data.id;

  const conversationControlsService = require('../services/conversationControlsService');
  const Conversation = require('../models/Conversation');

  // Directly install an already-expired mutedUntil — the mute endpoint only
  // ever produces a forward-looking one, so this reaches past it on purpose.
  await Conversation.updateOne(
    { _id: convId },
    { $push: { mutedBy: { user: a.id, mutedUntil: new Date(Date.now() - 1000), mutedAt: new Date() } } },
  );
  assert.equal(await conversationControlsService.isMutedFor(convId, a.id), false,
    'an expired mutedUntil must not count as muted');

  await Conversation.updateOne({ _id: convId }, { $pull: { mutedBy: { user: a.id } } });
  await Conversation.updateOne(
    { _id: convId },
    { $push: { mutedBy: { user: a.id, mutedUntil: null, mutedAt: new Date() } } },
  );
  assert.equal(await conversationControlsService.isMutedFor(convId, a.id), true,
    'mutedUntil: null means indefinite, and must count as muted');

  // Argument order is (conversationId, userId) — b never muted, so false.
  assert.equal(await conversationControlsService.isMutedFor(convId, b.id), false);
});
