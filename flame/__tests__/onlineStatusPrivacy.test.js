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
    '../db', '../models/User', '../models/RefreshToken',
    '../models/Match', '../models/Conversation', '../models/Message', '../models/Swipe',
    '../services/authService', '../services/userService',
    '../services/visibilityService', '../services/discoveryService',
    '../services/chatService', '../services/matchService', '../services/blockService',
    '../services/swipeService',
    '../controllers/authController', '../controllers/userController',
    '../controllers/chatController', '../services/conversationControlsService',
    '../controllers/matchController', '../controllers/swipeController',
    '../routes/auth', '../routes/users', '../routes/discovery', '../routes/conversations',
    '../routes/matches', '../routes/swipes',
    '../index',
  ].forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');

  return {
    app: buildApp(),
    User: require('../models/User'),
    chatService: require('../services/chatService'),
    matchService: require('../services/matchService'),
    swipeService: require('../services/swipeService'),
  };
}

async function registerUser(app, email) {
  // padEnd guards against a short local-part, which would fail the auth
  // route's `name: z.string().min(2)` validation.
  const body = {
    email, password: 'Hunter2!!', name: email.split('@')[0].padEnd(2, 'x'),
    age: 25, gender: 'other', lookingFor: 'other', interests: ['x'],
  };
  const r = await request(app).post('/flamebackend/v1/auth/register').send(body).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

const authH = (token) => ({ Authorization: `Bearer ${token}` });

// Sets the fields discoveryService and the socket presence layer both read:
// preferences.showOnlineStatus (a sub-document field) and the top-level
// isOnline flag.
async function setPresence(User, userId, { showOnlineStatus, isOnline }) {
  await User.findByIdAndUpdate(userId, {
    'preferences.showOnlineStatus': showOnlineStatus,
    isOnline,
  });
}

test('a user who hid their status reads as offline in Discover', async (t) => {
  const { app, User } = await setup(t);
  const me = await registerUser(app, 'discover-viewer-1@x.com');
  const other = await registerUser(app, 'discover-hidden@x.com');

  await setPresence(User, other.id, { showOnlineStatus: false, isOnline: true });

  const res = await request(app).get('/flamebackend/v1/discover')
    .set(authH(me.token)).expect(200);

  const seen = res.body.data.users.find((u) => u.id === other.id);
  assert.ok(seen, 'control: the other user appears in the deck');
  assert.equal(seen.is_online, false, 'a hidden status must not leak as online');
});

test('a user who allows their status reads as online in Discover — the guard is conditional', async (t) => {
  const { app, User } = await setup(t);
  const me = await registerUser(app, 'discover-viewer-2@x.com');
  const other = await registerUser(app, 'discover-visible@x.com');

  await setPresence(User, other.id, { showOnlineStatus: true, isOnline: true });

  const res = await request(app).get('/flamebackend/v1/discover')
    .set(authH(me.token)).expect(200);

  const seen = res.body.data.users.find((u) => u.id === other.id);
  assert.ok(seen, 'control: the other user appears in the deck');
  assert.equal(seen.is_online, true, 'an allowed status must still be reported truthfully');
});

test('a user who hid their status reads as offline in the conversation list', async (t) => {
  const { app, User, chatService } = await setup(t);
  const me = await registerUser(app, 'convo-viewer@x.com');
  const other = await registerUser(app, 'convo-hidden@x.com');

  await chatService.openConversation(me.id, other.id);
  await setPresence(User, other.id, { showOnlineStatus: false, isOnline: true });

  const res = await request(app).get('/flamebackend/v1/conversations')
    .set(authH(me.token)).expect(200);

  const conv = res.body.data.conversations.find((c) => c.other_user_id === other.id);
  assert.ok(conv, 'control: the conversation appears in the list');
  assert.equal(
    conv.other_user.is_online, false,
    'the conversation list is a separate call site from Discover — one shared '
      + 'helper passing does not prove this one uses it too',
  );
});

test('hiding your own status does not hide theirs from you', async (t) => {
  const { app, User } = await setup(t);
  const me = await registerUser(app, 'asymmetry-viewer@x.com');
  const other = await registerUser(app, 'asymmetry-other@x.com');

  // The viewer hides their OWN status...
  await setPresence(User, me.id, { showOnlineStatus: false, isOnline: true });
  // ...but the other user has left theirs visible and online.
  await setPresence(User, other.id, { showOnlineStatus: true, isOnline: true });

  const res = await request(app).get('/flamebackend/v1/discover')
    .set(authH(me.token)).expect(200);

  const seen = res.body.data.users.find((u) => u.id === other.id);
  assert.ok(seen, 'control: the other user appears in the deck');
  assert.equal(
    seen.is_online, true,
    "the viewer's own preference must not affect what they see of someone else",
  );
});

// --- toPublicMinimal: the surface nobody remembered ------------------------
//
// userService.toPublicMinimal has its own, separate `isOnline` field (no
// underscore — that shape is fixed by the shipped app) and is the shape
// behind THREE more call sites that describe another user: the profile view
// (userService.getById -> GET /users/:id), the matches list
// (matchService.list), and the "it's a match!" swipe payload
// (swipeService.toMatchPayload). None of the discoveryService fix above
// touches any of these.

test('a user who hid their status reads as offline through GET /users/:id', async (t) => {
  const { app, User } = await setup(t);
  const me = await registerUser(app, 'profile-viewer@x.com');
  const other = await registerUser(app, 'profile-hidden@x.com');

  await setPresence(User, other.id, { showOnlineStatus: false, isOnline: true });

  const res = await request(app).get(`/flamebackend/v1/users/${other.id}`)
    .set(authH(me.token)).expect(200);

  assert.equal(res.body.data.isOnline, false, 'a hidden status must not leak through the profile view');
});

test('a user who allows their status reads as online through GET /users/:id — the guard is conditional', async (t) => {
  const { app, User } = await setup(t);
  const me = await registerUser(app, 'profile-viewer-2@x.com');
  const other = await registerUser(app, 'profile-visible@x.com');

  await setPresence(User, other.id, { showOnlineStatus: true, isOnline: true });

  const res = await request(app).get(`/flamebackend/v1/users/${other.id}`)
    .set(authH(me.token)).expect(200);

  assert.equal(res.body.data.isOnline, true, 'an allowed status must still be reported truthfully');
});

test('a user who hid their status reads as offline in the matches list', async (t) => {
  const { app, User, swipeService } = await setup(t);
  const me = await registerUser(app, 'matchlist-viewer@x.com');
  const other = await registerUser(app, 'matchlist-hidden@x.com');

  await swipeService.record(me.id, other.id, 'like');
  await swipeService.record(other.id, me.id, 'like');
  await setPresence(User, other.id, { showOnlineStatus: false, isOnline: true });

  const res = await request(app).get('/flamebackend/v1/matches')
    .set(authH(me.token)).expect(200);

  const match = res.body.data.matches.find((m) => m.user.id === other.id);
  assert.ok(match, 'control: the match appears in the list');
  assert.equal(
    match.user.isOnline, false,
    'the matches list is a separate call site from the profile view — one shared '
      + 'helper passing does not prove this one uses it too',
  );
});

test('a user who hid their status reads as offline in the "it\'s a match!" payload', async (t) => {
  const { app, User } = await setup(t);
  const me = await registerUser(app, 'matchpayload-viewer@x.com');
  const other = await registerUser(app, 'matchpayload-hidden@x.com');

  await setPresence(User, other.id, { showOnlineStatus: false, isOnline: true });

  // `other` likes first...
  await request(app).post('/flamebackend/v1/swipes/like')
    .set(authH(other.token)).send({ user_id: me.id }).expect(200);

  // ...then the viewer likes back, completing the match and receiving the
  // "it's a match!" payload that carries the other user's shape inline.
  const res = await request(app).post('/flamebackend/v1/swipes/like')
    .set(authH(me.token)).send({ user_id: other.id }).expect(200);

  assert.equal(res.body.data.is_match, true, 'control: the swipe completed a match');
  assert.equal(
    res.body.data.match.user.isOnline, false,
    'the match payload is a third call site through toPublicMinimal — the guard must cover it too',
  );
});

// --- Step 4: characterize the socket presence fan-out (already correct) ----
//
// flameSocket.js already honours showOnlineStatus (getShowOnlineStatus, guards
// on the connect broadcast, the presence:bulk filter, and the cached
// socket.showOnlineStatus on disconnect). Nothing here is being fixed; this
// pins the presence:bulk snapshot so a future change can't quietly regress it.
// Harness copied from blockEnforcement.test.js (fakeNamespace/fakeSocket/
// driveConnection), which drives nsHandlers.connection(socket) directly rather
// than opening a real socket.io-client connection.

function fakeNamespace() {
  const emitted = [];
  const nsHandlers = {};
  const ns = {
    use: () => {},
    on: (event, fn) => { nsHandlers[event] = fn; },
    to: (roomName) => ({
      emit: (event, payload) => emitted.push({ room: roomName, event, payload }),
    }),
  };
  return { io: { of: () => ns }, emitted, nsHandlers };
}

function fakeSocket(userId) {
  const selfEmitted = [];
  const on = {};
  return {
    userId,
    connected: true,
    selfEmitted,
    handlers: on,
    join: () => {},
    on: (event, fn) => { on[event] = fn; },
    emit: (event, payload) => selfEmitted.push({ event, payload }),
  };
}

// The connect flow runs in a detached async IIFE; it always finishes by
// emitting `presence:bulk` back to the socket, so that is the settle signal.
async function driveConnection(nsHandlers, socket) {
  nsHandlers.connection(socket);
  for (let i = 0; i < 300; i += 1) {
    if (socket.selfEmitted.some((e) => e.event === 'presence:bulk')) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('connection flow never settled');
}

test('presence:bulk omits a partner who hid their status and keeps one who did not', async (t) => {
  const { User, chatService } = await setup(t);

  // Flame's own DB, freshly connected by setup(t) above — required here
  // (rather than added to setup's return value) because they are not tied to
  // the Mongo connection: flameSocket is loaded fresh in this process for the
  // first time, and presenceService is an in-memory singleton reset per test.
  const flameSocket = require('../socket/flameSocket');
  const presenceService = require('../services/presenceService');
  presenceService.reset();
  t.after(() => presenceService.reset());

  const viewer = await User.create({
    email: 'bulk-viewer@x.com', name: 'Vw', age: 30, gender: 'other',
    lookingFor: 'other', passwordHash: 'x',
  });
  const hidden = await User.create({
    email: 'bulk-hidden@x.com', name: 'Hd', age: 30, gender: 'other',
    lookingFor: 'other', passwordHash: 'x',
  });
  const visible = await User.create({
    email: 'bulk-visible@x.com', name: 'Vs', age: 30, gender: 'other',
    lookingFor: 'other', passwordHash: 'x',
  });
  const viewerId = viewer._id.toString();
  const hiddenId = hidden._id.toString();
  const visibleId = visible._id.toString();

  await chatService.openConversation(viewerId, hiddenId);
  await chatService.openConversation(viewerId, visibleId);
  await setPresence(User, hiddenId, { showOnlineStatus: false, isOnline: true });
  // `visible` keeps preferences.showOnlineStatus at its default (true).

  // Both partners are already connected elsewhere, from presenceService's
  // point of view — this is what makes them eligible for the bulk snapshot.
  presenceService.markOnline(hiddenId);
  presenceService.markOnline(visibleId);

  const { io, nsHandlers } = fakeNamespace();
  flameSocket.initFlameSocket(io);

  const socket = fakeSocket(viewerId);
  await driveConnection(nsHandlers, socket);

  const bulk = socket.selfEmitted.find((e) => e.event === 'presence:bulk').payload.online;
  assert.ok(bulk.includes(visibleId), 'control: a visible online partner appears in the snapshot');
  assert.ok(!bulk.includes(hiddenId), 'a partner who hid their status must not appear online');
});
