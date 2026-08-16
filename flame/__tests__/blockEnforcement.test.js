const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  // utils/s3 throws at module load without these, and userService requires it.
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  ['../db', '../models/User', '../models/Swipe', '../models/Match',
   '../models/Conversation', '../models/Message', '../models/Story',
   '../models/RefreshToken',
   '../services/chatService', '../services/userService', '../services/storyService',
   '../services/swipeService', '../services/matchService', '../services/discoveryService',
   '../services/authService', '../services/presenceService',
   '../services/visibilityService', '../services/blockService',
   '../socket/flameSocket']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  const User = require('../models/User');
  const mk = (email, name) => User.create({
    email, name, age: 30, gender: 'other', lookingFor: 'other', passwordHash: 'x',
  });
  // Names are two characters: flame/models/User.js enforces minlength 2, and a
  // throw here would happen before the teardown hook registers.
  const a = await mk('a@x.com', 'Aa');
  const b = await mk('b@x.com', 'Bb');

  return {
    a: a._id.toString(), b: b._id.toString(),
    chatService: require('../services/chatService'),
    userService: require('../services/userService'),
    storyService: require('../services/storyService'),
    blockService: require('../services/blockService'),
    swipeService: require('../services/swipeService'),
    matchService: require('../services/matchService'),
    flameSocket: require('../socket/flameSocket'),
    Match: require('../models/Match'),
    Story: require('../models/Story'),
  };
}

const teardown = (t) => t.after(async () => {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
});

// Minimal stand-in for the Socket.IO server: records every emit so a test can
// assert a delivery was dropped rather than sent.
function fakeIo() {
  const emitted = [];
  return {
    emitted,
    of: () => ({
      to: (roomName) => ({
        emit: (event, payload) => emitted.push({ room: roomName, event, payload }),
      }),
    }),
  };
}

test('a blocked user cannot open a conversation', async (t) => {
  const { a, b, chatService, blockService } = await setup();
  teardown(t);

  await blockService.block(b, a);
  await assert.rejects(() => chatService.openConversation(a, b), (e) => e.status === 403);
});

test('a blocked user cannot send a message into an existing conversation', async (t) => {
  const { a, b, chatService, blockService } = await setup();
  teardown(t);

  const conv = await chatService.openConversation(a, b);
  await blockService.block(b, a);

  await assert.rejects(
    () => chatService.sendMessage(a, conv.id, { text: 'hello' }),
    (e) => e.status === 403,
  );
});

test('a blocked user disappears from the conversation list', async (t) => {
  const { a, b, chatService, blockService } = await setup();
  teardown(t);

  await chatService.openConversation(a, b);
  await blockService.block(a, b);

  const { conversations } = await chatService.listConversations(a, { limit: 20, offset: 0 });
  assert.equal(conversations.length, 0);
});

test('a blocked user 404s on profile view', async (t) => {
  const { a, b, userService, blockService } = await setup();
  teardown(t);

  await blockService.block(b, a);
  await assert.rejects(() => userService.getById(b, a), (e) => e.status === 404);
});

test('blocking ends an existing match', async (t) => {
  const { a, b, swipeService, matchService, blockService, Match } = await setup();
  teardown(t);

  await swipeService.record(a, b, 'like');
  await swipeService.record(b, a, 'like');
  assert.equal(await Match.countDocuments({ endedBy: null }), 1);

  await blockService.block(a, b);

  assert.equal(await Match.countDocuments({ endedBy: null }), 0, 'a block must unmatch');
  const { matches } = await matchService.list(a, {});
  assert.equal(matches.length, 0);
});

test('a blocked user disappears from the story feed', async (t) => {
  const { a, b, storyService, blockService, Story } = await setup();
  teardown(t);

  // Created through the model rather than storyService.createStory so the test
  // does not need to upload to object storage.
  await Story.create({
    userId: b,
    mediaUrl: 'https://example.test/s.jpg',
    mediaKey: 'stories/b/s.jpg',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  const before = await storyService.getFeed(a);
  assert.equal(before.length, 1, 'control: the story is visible before the block');

  await blockService.block(b, a);

  const after = await storyService.getFeed(a);
  assert.equal(after.length, 0, 'a blocked author must leave the story feed');
});

test('socket delivery drops a message to a blocked pair', async (t) => {
  const { a, b, blockService, flameSocket } = await setup();
  teardown(t);

  const io = fakeIo();
  await flameSocket.emitNewMessage(io, b, { sender_id: a, text: 'hi' });
  assert.equal(io.emitted.length, 1, 'control: an unblocked message is delivered');

  await blockService.block(b, a);

  await flameSocket.emitNewMessage(io, b, { sender_id: a, text: 'hi again' });
  assert.equal(io.emitted.length, 1, 'a live socket must not bypass the block');
});
