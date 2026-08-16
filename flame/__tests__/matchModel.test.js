const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  ['../db', '../models/Match'].forEach(p => {
    try { delete require.cache[require.resolve(p)]; } catch {}
  });
  const { connect } = require('../db');
  await connect();
  return require('../models/Match');
}

test('pair() sorts so the same two users always produce one key', async (t) => {
  const Match = await setup();
  t.after(async () => {
    const { close } = require('../db');
    await close();
    await dbHelper.stop();
  });

  assert.deepEqual(Match.pair('b', 'a'), ['a', 'b']);
  assert.deepEqual(Match.pair('a', 'b'), ['a', 'b']);
});

test('one match per pair regardless of who swiped first', async (t) => {
  const Match = await setup();
  t.after(async () => {
    const { close } = require('../db');
    await close();
    await dbHelper.stop();
  });
  await Match.init();

  await Match.create({ users: Match.pair('a', 'b'), conversationId: 'c1' });

  await assert.rejects(
    () => Match.create({ users: Match.pair('b', 'a'), conversationId: 'c2' }),
    (err) => err.code === 11000,
    'sorted pair + unique index must collapse both orderings into one match',
  );
});

test('endedBy defaults to null so a live match is the default state', async (t) => {
  const Match = await setup();
  t.after(async () => {
    const { close } = require('../db');
    await close();
    await dbHelper.stop();
  });

  const m = await Match.create({ users: Match.pair('x', 'y'), conversationId: 'c3' });
  assert.equal(m.endedBy, null);
});

test('a user can be in MANY matches', async (t) => {
  const Match = await setup();
  t.after(async () => {
    const { close } = require('../db');
    await close();
    await dbHelper.stop();
  });
  await Match.init();

  await Match.create({ users: Match.pair('a', 'b'), conversationId: 'c1' });
  await Match.create({ users: Match.pair('a', 'c'), conversationId: 'c2' });
  await Match.create({ users: Match.pair('a', 'd'), conversationId: 'c3' });

  assert.equal(await Match.countDocuments({ users: 'a' }), 3);
});

test('an unsorted pair is rejected outright', async (t) => {
  const Match = await setup();
  t.after(async () => {
    const { close } = require('../db');
    await close();
    await dbHelper.stop();
  });

  await assert.rejects(() => Match.create({ users: ['b', 'a'], conversationId: 'c1' }));
});

test('a pair of identical ids is rejected', async (t) => {
  const Match = await setup();
  t.after(async () => {
    const { close } = require('../db');
    await close();
    await dbHelper.stop();
  });

  await assert.rejects(() => Match.create({ users: ['a', 'a'], conversationId: 'c1' }));
});
