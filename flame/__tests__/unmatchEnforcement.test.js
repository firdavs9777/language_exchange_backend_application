// Unmatching has to reach the chat layer.
//
// `matchService.unmatch` only sets `endedBy`, which for a long time was read by
// `matchService.list` alone: the conversation the match created stayed in both
// users' Messages lists and both sides could keep messaging each other forever.
// These tests pin the inverse of the block direction, which blockService
// already covered.
const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  // utils/s3 throws at module load without these, and userService requires it.
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  ['../db', '../models/User', '../models/Swipe', '../models/Match',
   '../models/Conversation', '../models/Message',
   '../services/chatService', '../services/userService', '../services/swipeService',
   '../services/matchService', '../services/discoveryService',
   '../services/visibilityService', '../services/blockService']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  const User = require('../models/User');
  // Names are two characters: flame/models/User.js enforces minlength 2, and a
  // throw here would happen before the teardown hook registers.
  const mk = (email, name) => User.create({
    email, name, age: 30, gender: 'other', lookingFor: 'other', passwordHash: 'x',
  });
  const a = await mk('a@x.com', 'Aa');
  const b = await mk('b@x.com', 'Bb');

  const aId = a._id.toString();
  const bId = b._id.toString();

  const swipeService = require('../services/swipeService');
  await swipeService.record(aId, bId, 'like');
  const res = await swipeService.record(bId, aId, 'like');

  const chatService = require('../services/chatService');
  const conv = await chatService.openConversation(aId, bId);

  return {
    a: aId,
    b: bId,
    matchId: res.match.id,
    convId: conv.id,
    chatService,
    matchService: require('../services/matchService'),
    blockService: require('../services/blockService'),
    Match: require('../models/Match'),
  };
}

const teardown = (t) => t.after(async () => {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
});

test('control: a live match can be messaged and is listed', async (t) => {
  const { a, b, convId, chatService } = await setup();
  teardown(t);

  await chatService.sendMessage(a, convId, { text: 'hi' });
  const mine = await chatService.listConversations(a, { limit: 20, offset: 0 });
  const theirs = await chatService.listConversations(b, { limit: 20, offset: 0 });
  assert.equal(mine.conversations.length, 1);
  assert.equal(theirs.conversations.length, 1);
});

test('after an unmatch the unmatcher cannot send into the conversation', async (t) => {
  const { a, matchId, convId, chatService, matchService } = await setup();
  teardown(t);

  await matchService.unmatch(a, matchId);

  await assert.rejects(
    () => chatService.sendMessage(a, convId, { text: 'still here' }),
    (e) => e.status === 403,
  );
});

test('after an unmatch the OTHER side cannot send either', async (t) => {
  const { a, b, matchId, convId, chatService, matchService } = await setup();
  teardown(t);

  await matchService.unmatch(a, matchId);

  await assert.rejects(
    () => chatService.sendMessage(b, convId, { text: 'why did you go' }),
    (e) => e.status === 403,
    'an unmatch is mutual — the person who was unmatched loses the chat too',
  );
});

test('an unmatched conversation leaves BOTH users conversation lists', async (t) => {
  const { a, b, matchId, chatService, matchService } = await setup();
  teardown(t);

  await matchService.unmatch(a, matchId);

  const mine = await chatService.listConversations(a, { limit: 20, offset: 0 });
  const theirs = await chatService.listConversations(b, { limit: 20, offset: 0 });
  assert.equal(mine.conversations.length, 0, 'gone for the unmatcher');
  assert.equal(theirs.conversations.length, 0, 'gone for the unmatched');
});

test('isEndedBetween is order-independent and false for a live match', async (t) => {
  const { a, b, matchId, matchService } = await setup();
  teardown(t);

  assert.equal(await matchService.isEndedBetween(a, b), false, 'the match is live');

  await matchService.unmatch(b, matchId);

  assert.equal(await matchService.isEndedBetween(a, b), true);
  assert.equal(await matchService.isEndedBetween(b, a), true, 'the pair is unordered');
});

test('a block also closes the conversation, through the same ended-match path', async (t) => {
  const { a, b, convId, chatService, blockService } = await setup();
  teardown(t);

  await blockService.block(a, b);

  const theirs = await chatService.listConversations(b, { limit: 20, offset: 0 });
  assert.equal(theirs.conversations.length, 0);
  await assert.rejects(
    () => chatService.sendMessage(b, convId, { text: 'hello?' }),
    (e) => e.status === 403,
  );
});

test('an unrelated conversation survives an unmatch', async (t) => {
  const { a, matchId, chatService, matchService } = await setup();
  teardown(t);

  const User = require('../models/User');
  const c = await User.create({
    email: 'c@x.com', name: 'Cc', age: 30, gender: 'other',
    lookingFor: 'other', passwordHash: 'x',
  });
  const cId = c._id.toString();
  const other = await chatService.openConversation(a, cId);

  await matchService.unmatch(a, matchId);

  const mine = await chatService.listConversations(a, { limit: 20, offset: 0 });
  assert.equal(mine.conversations.length, 1, 'only the unmatched pair is hidden');
  assert.equal(mine.conversations[0].id, other.id);
  await chatService.sendMessage(a, other.id, { text: 'unaffected' }); // must not throw
});
