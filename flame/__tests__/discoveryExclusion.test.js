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

// Fixtures for the gender/age preference branches, which the exclusion
// fixtures above cannot exercise: they are all one gender and all age 30.
//
// The 18-50 age window is the User model's default for `preferences`, so it
// applies to every viewer here unless the test overrides it. These tests pin
// the FILTERING behaviour; they deliberately do not assert the default values
// themselves, which are a product decision.
async function setupPreferences({ lookingFor, minAge, maxAge }) {
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
  const mk = (email, name, gender, age) => User.create({
    email, name, age, gender, lookingFor: 'other', passwordHash: 'x',
  });

  const me = await User.create({
    email: 'me@x.com',
    name: 'Me',
    age: 30,
    gender: 'other',
    lookingFor,
    passwordHash: 'x',
    preferences: { minAge, maxAge },
  });

  // One of each gender at an in-window age, plus two out-of-window ages and one
  // user past the default maxAge (50) entirely, to exercise the "untouched
  // default window means no filter" escape hatch.
  const male = await mk('male@x.com', 'Ma', 'male', 30);
  const female = await mk('female@x.com', 'Fe', 'female', 30);
  const nonBinary = await mk('nb@x.com', 'Nb', 'non_binary', 30);
  const young = await mk('young@x.com', 'Yo', 'male', 19);
  const old = await mk('old@x.com', 'Ol', 'male', 45);
  const veryOld = await mk('veryold@x.com', 'Vo', 'male', 60);

  const id = (u) => u._id.toString();
  return {
    meId: id(me),
    maleId: id(male),
    femaleId: id(female),
    nonBinaryId: id(nonBinary),
    youngId: id(young),
    oldId: id(old),
    veryOldId: id(veryOld),
    discoveryService: require('../services/discoveryService'),
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

// --- gender preference ------------------------------------------------------

test('lookingFor a specific gender shows only that gender', async (t) => {
  const { meId, maleId, femaleId, nonBinaryId, discoveryService } =
    await setupPreferences({ lookingFor: 'female', minAge: 18, maxAge: 50 });
  teardown(t);

  const { users } = await discoveryService.discover(meId, { limit: 20, offset: 0 });
  const ids = users.map((u) => u.id);

  assert.ok(ids.includes(femaleId), 'the requested gender is shown');
  assert.ok(!ids.includes(maleId), 'other genders are filtered out');
  assert.ok(!ids.includes(nonBinaryId));
  assert.ok(users.every((u) => u.gender === 'female'));
});

test('lookingFor non_binary works the same way', async (t) => {
  const { meId, maleId, femaleId, nonBinaryId, discoveryService } =
    await setupPreferences({ lookingFor: 'non_binary', minAge: 18, maxAge: 50 });
  teardown(t);

  const { users } = await discoveryService.discover(meId, { limit: 20, offset: 0 });
  const ids = users.map((u) => u.id);

  assert.ok(ids.includes(nonBinaryId));
  assert.ok(!ids.includes(maleId));
  assert.ok(!ids.includes(femaleId));
});

test("lookingFor 'other' applies no gender filter at all", async (t) => {
  const { meId, maleId, femaleId, nonBinaryId, discoveryService } =
    await setupPreferences({ lookingFor: 'other', minAge: 18, maxAge: 50 });
  teardown(t);

  const { users } = await discoveryService.discover(meId, { limit: 20, offset: 0 });
  const ids = users.map((u) => u.id);

  assert.ok(ids.includes(maleId), "'other' means no preference, not a gender to match");
  assert.ok(ids.includes(femaleId));
  assert.ok(ids.includes(nonBinaryId));
});

// --- age window -------------------------------------------------------------

test('the age window excludes users on either side of it', async (t) => {
  const { meId, maleId, youngId, oldId, discoveryService } =
    await setupPreferences({ lookingFor: 'male', minAge: 25, maxAge: 35 });
  teardown(t);

  const { users, total } = await discoveryService.discover(meId, { limit: 20, offset: 0 });
  const ids = users.map((u) => u.id);

  assert.ok(ids.includes(maleId), 'age 30 is inside 25-35');
  assert.ok(!ids.includes(youngId), 'age 19 is below minAge 25');
  assert.ok(!ids.includes(oldId), 'age 45 is above maxAge 35');
  assert.equal(total, 1, 'total reflects the filter, not the whole table');
});

test('a widened age window brings the excluded users back', async (t) => {
  const { meId, maleId, youngId, oldId, discoveryService } =
    await setupPreferences({ lookingFor: 'male', minAge: 18, maxAge: 99 });
  teardown(t);

  const { users } = await discoveryService.discover(meId, { limit: 20, offset: 0 });
  const ids = users.map((u) => u.id);

  assert.ok(ids.includes(maleId));
  assert.ok(ids.includes(youngId), 'control: 19 was only hidden by the narrower window');
  assert.ok(ids.includes(oldId), 'control: 45 was only hidden by the narrower window');
});

test('the age bounds are inclusive at both ends', async (t) => {
  const { meId, youngId, oldId, discoveryService } =
    await setupPreferences({ lookingFor: 'male', minAge: 19, maxAge: 45 });
  teardown(t);

  const { users } = await discoveryService.discover(meId, { limit: 20, offset: 0 });
  const ids = users.map((u) => u.id);

  assert.ok(ids.includes(youngId), 'a user exactly at minAge is included');
  assert.ok(ids.includes(oldId), 'a user exactly at maxAge is included');
});

// --- untouched default window (18/50) means "no age preference" -------------
//
// preferences.minAge/maxAge default to 18/50 in the schema and were written
// into every existing user document at insert time, so treating them as a
// real filter silently hid everyone over 50 from everyone. The fix: an
// EXACTLY untouched 18/50 window skips the age filter entirely.

test('an untouched default window (18/50) applies no age filter, so a 60-year-old is visible',
  async (t) => {
    const { meId, veryOldId, discoveryService } =
      await setupPreferences({ lookingFor: 'male', minAge: 18, maxAge: 50 });
    teardown(t);

    const { users } = await discoveryService.discover(meId, { limit: 20, offset: 0 });
    const ids = users.map((u) => u.id);

    assert.ok(ids.includes(veryOldId), 'age 60 must not be hidden by the untouched default window');
  });

test('moving only maxAge away from its default still filters', async (t) => {
  const { meId, maleId, youngId, oldId, veryOldId, discoveryService } =
    await setupPreferences({ lookingFor: 'male', minAge: 18, maxAge: 40 });
  teardown(t);

  const { users } = await discoveryService.discover(meId, { limit: 20, offset: 0 });
  const ids = users.map((u) => u.id);

  assert.ok(ids.includes(maleId), 'age 30 is inside 18-40');
  assert.ok(ids.includes(youngId), 'age 19 is inside 18-40');
  assert.ok(!ids.includes(oldId), 'age 45 is above the moved maxAge of 40');
  assert.ok(!ids.includes(veryOldId), 'age 60 is above the moved maxAge of 40');
});

test('moving only minAge away from its default still filters', async (t) => {
  const { meId, maleId, youngId, oldId, veryOldId, discoveryService } =
    await setupPreferences({ lookingFor: 'male', minAge: 30, maxAge: 50 });
  teardown(t);

  const { users } = await discoveryService.discover(meId, { limit: 20, offset: 0 });
  const ids = users.map((u) => u.id);

  assert.ok(ids.includes(maleId), 'age 30 is exactly the moved minAge, inclusive');
  assert.ok(!ids.includes(youngId), 'age 19 is below the moved minAge of 30');
  assert.ok(ids.includes(oldId), 'age 45 is inside 30-50');
  assert.ok(!ids.includes(veryOldId), 'age 60 is above the untouched maxAge of 50');
});
