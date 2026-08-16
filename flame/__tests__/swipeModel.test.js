const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  ['../db', '../models/Swipe'].forEach(p => {
    try { delete require.cache[require.resolve(p)]; } catch {}
  });
  const { connect } = require('../db');
  await connect();
  return require('../models/Swipe');
}

test('a user cannot swipe the same person twice', async (t) => {
  const Swipe = await setup();
  t.after(async () => {
    const { close } = require('../db');
    await close();
    await dbHelper.stop();
  });
  await Swipe.init(); // ensure indexes are built before asserting on them

  await Swipe.create({ from: 'a', to: 'b', action: 'like' });

  await assert.rejects(
    () => Swipe.create({ from: 'a', to: 'b', action: 'pass' }),
    (err) => err.code === 11000,
    'the unique (from,to) index must reject a second swipe on the same person',
  );
});

test('the reverse direction is a different swipe', async (t) => {
  const Swipe = await setup();
  t.after(async () => {
    const { close } = require('../db');
    await close();
    await dbHelper.stop();
  });
  await Swipe.init();

  await Swipe.create({ from: 'a', to: 'b', action: 'like' });
  await Swipe.create({ from: 'b', to: 'a', action: 'like' });

  assert.equal(await Swipe.countDocuments({}), 2);
});

test('action is restricted to like, pass and super', async (t) => {
  const Swipe = await setup();
  t.after(async () => {
    const { close } = require('../db');
    await close();
    await dbHelper.stop();
  });

  await assert.rejects(() => Swipe.create({ from: 'a', to: 'b', action: 'maybe' }));
});
