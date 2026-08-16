const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  ['../db', '../models/User', '../models/Swipe', '../services/blockService',
   '../services/visibilityService']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  const User = require('../models/User');
  const mk = (email, name) => User.create({
    email, name, age: 30, gender: 'other', lookingFor: 'other', passwordHash: 'x',
  });

  const a = await mk('a@x.com', 'Aa');
  const b = await mk('b@x.com', 'Bb');
  const c = await mk('c@x.com', 'Cc');

  return {
    a: a._id.toString(), b: b._id.toString(), c: c._id.toString(),
    blockService: require('../services/blockService'),
    visibility: require('../services/visibilityService'),
    Swipe: require('../models/Swipe'),
  };
}

const teardown = (t) => t.after(async () => {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
});

test('blockedIdsFor covers BOTH directions', async (t) => {
  const { a, b, c, blockService, visibility } = await setup();
  teardown(t);

  await blockService.block(a, b); // a blocked b
  await blockService.block(c, a); // c blocked a

  const ids = await visibility.blockedIdsFor(a);
  assert.ok(ids.includes(b), 'people I blocked must be hidden');
  assert.ok(ids.includes(c), 'people who blocked me must be hidden too');
});

test('assertCanInteract throws whichever way the block runs', async (t) => {
  const { a, b, blockService, visibility } = await setup();
  teardown(t);

  await blockService.block(a, b);

  await assert.rejects(() => visibility.assertCanInteract(a, b), (e) => e.status === 403);
  await assert.rejects(() => visibility.assertCanInteract(b, a), (e) => e.status === 403);
});

test('assertCanInteract passes for unrelated users', async (t) => {
  const { a, c, visibility } = await setup();
  teardown(t);

  await visibility.assertCanInteract(a, c); // must not throw
});

test('excludedIdsFor adds swiped users when asked', async (t) => {
  const { a, b, c, Swipe, visibility } = await setup();
  teardown(t);

  await Swipe.create({ from: a, to: c, action: 'pass' });

  const withSwipes = await visibility.excludedIdsFor(a, { includeSwiped: true });
  assert.ok(withSwipes.includes(c));

  const withoutSwipes = await visibility.excludedIdsFor(a, { includeSwiped: false });
  assert.ok(!withoutSwipes.includes(c));
});

test('a block still holds when the mirrored array is missing', async (t) => {
  const { a, b, visibility } = await setup();
  teardown(t);

  const User = require('../models/User');
  // Simulate a crash between blockService's two writes: only the blocker's
  // side landed.
  await User.updateOne(
    { _id: a },
    { $push: { blockedUsers: { user: b, blockedAt: new Date() } } },
  );

  await assert.rejects(() => visibility.assertCanInteract(a, b), (e) => e.status === 403);
  await assert.rejects(
    () => visibility.assertCanInteract(b, a),
    (e) => e.status === 403,
    'the block must hold from the target side too, even with blockedBy unwritten',
  );
});
