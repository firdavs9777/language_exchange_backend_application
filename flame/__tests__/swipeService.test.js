const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  ['../db', '../models/User', '../models/Swipe', '../models/Match',
   '../models/Conversation', '../services/chatService', '../services/userService',
   '../services/visibilityService', '../services/blockService',
   '../services/swipeService']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  const User = require('../models/User');
  const mk = (email, name) => User.create({
    email, name, age: 30, gender: 'other', lookingFor: 'other', passwordHash: 'x',
  });
  const a = await mk('a@x.com', 'Aa');
  const b = await mk('b@x.com', 'Bb');

  return {
    a: a._id.toString(), b: b._id.toString(),
    swipeService: require('../services/swipeService'),
    blockService: require('../services/blockService'),
    Match: require('../models/Match'),
    Swipe: require('../models/Swipe'),
  };
}

const teardown = (t) => t.after(async () => {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
});

test('a one-sided like is not a match', async (t) => {
  const { a, b, swipeService } = await setup();
  teardown(t);

  const res = await swipeService.record(a, b, 'like');
  assert.equal(res.isMatch, false);
  assert.equal(res.match, null);
});

test('a reciprocal like creates a match AND a conversation', async (t) => {
  const { a, b, swipeService, Match } = await setup();
  teardown(t);

  await swipeService.record(a, b, 'like');
  const res = await swipeService.record(b, a, 'like');

  assert.equal(res.isMatch, true);
  assert.equal(res.match.user.id, a, 'match.user is the OTHER participant');
  assert.ok(res.match.matched_at, 'the app parses matched_at');

  assert.equal(await Match.countDocuments({}), 1);
});

test('a pass never matches, even if the other liked', async (t) => {
  const { a, b, swipeService } = await setup();
  teardown(t);

  await swipeService.record(a, b, 'like');
  const res = await swipeService.record(b, a, 'pass');
  assert.equal(res.isMatch, false);
});

test('super counts as a like for matching', async (t) => {
  const { a, b, swipeService } = await setup();
  teardown(t);

  await swipeService.record(a, b, 'super');
  const res = await swipeService.record(b, a, 'like');
  assert.equal(res.isMatch, true);
});

test('swiping twice is idempotent and does not double-match', async (t) => {
  const { a, b, swipeService, Match, Swipe } = await setup();
  teardown(t);

  await swipeService.record(a, b, 'like');
  await swipeService.record(a, b, 'like');
  await swipeService.record(b, a, 'like');
  await swipeService.record(b, a, 'like');

  assert.equal(await Swipe.countDocuments({ from: a, to: b }), 1);
  assert.equal(await Match.countDocuments({}), 1);
});

test('simultaneous likes still produce exactly one match', async (t) => {
  const { a, b, swipeService, Match } = await setup();
  teardown(t);

  const [r1, r2] = await Promise.all([
    swipeService.record(a, b, 'like'),
    swipeService.record(b, a, 'like'),
  ]);

  assert.equal(await Match.countDocuments({}), 1);
  assert.ok(r1.isMatch || r2.isMatch, 'at least one side must learn about the match');
});

test('a blocked user cannot be swiped', async (t) => {
  const { a, b, swipeService, blockService } = await setup();
  teardown(t);

  await blockService.block(b, a); // b blocked a
  await assert.rejects(() => swipeService.record(a, b, 'like'), (e) => e.status === 403);
});
