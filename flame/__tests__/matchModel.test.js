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
