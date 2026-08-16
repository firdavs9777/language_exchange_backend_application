const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  ['../db', '../models/User', '../models/Swipe', '../services/discoveryService',
   '../services/visibilityService', '../services/blockService']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  const User = require('../models/User');
  const mk = (email, name, age = 30, gender = 'female') => User.create({
    email, name, age, gender, lookingFor: 'female', passwordHash: 'x',
  });

  const me = await mk('me@x.com', 'Me');
  const seen = await mk('seen@x.com', 'Seen');
  const blocked = await mk('blocked@x.com', 'Blocked');
  const fresh = await mk('fresh@x.com', 'Fresh');

  return {
    meId: me._id.toString(), seenId: seen._id.toString(),
    blockedId: blocked._id.toString(), freshId: fresh._id.toString(),
    discoveryService: require('../services/discoveryService'),
    blockService: require('../services/blockService'),
    Swipe: require('../models/Swipe'),
  };
}

const teardown = (t) => t.after(async () => {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
});

test('an already-swiped user never reappears', async (t) => {
  const { meId, seenId, freshId, discoveryService, Swipe } = await setup();
  teardown(t);

  await Swipe.create({ from: meId, to: seenId, action: 'pass' });

  const { users } = await discoveryService.discover(meId, { limit: 20, offset: 0 });
  const ids = users.map((u) => u.id);

  assert.ok(!ids.includes(seenId), 'a swiped user must not come back');
  assert.ok(ids.includes(freshId));
});

test('blocked users are excluded from the deck', async (t) => {
  const { meId, blockedId, discoveryService, blockService } = await setup();
  teardown(t);

  await blockService.block(meId, blockedId);

  const { users } = await discoveryService.discover(meId, { limit: 20, offset: 0 });
  assert.ok(!users.map((u) => u.id).includes(blockedId));
});

test('the deck empties once everyone has been swiped', async (t) => {
  const { meId, seenId, blockedId, freshId, discoveryService, Swipe } = await setup();
  teardown(t);

  for (const to of [seenId, blockedId, freshId]) {
    await Swipe.create({ from: meId, to, action: 'pass' });
  }

  const { users, total } = await discoveryService.discover(meId, { limit: 20, offset: 0 });
  assert.equal(users.length, 0);
  assert.equal(total, 0);
});
