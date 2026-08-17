const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
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

// --- preferencesSet: an explicit 18-50 PATCH must still filter --------------
//
// minAge/maxAge default to 18/50 in the schema, so a document explicitly
// PATCHed to exactly 18-50 is bit-for-bit identical, on those two fields, to a
// document nobody has ever touched. The value-based heuristic above can't
// tell them apart. userService.updatePreferences stamps
// preferences.preferencesSet = true on every successful write; discoveryService
// applies the age filter whenever that flag is true, and only falls back to
// the value-based heuristic when it is false (the untouched-document case).

async function setupHttp(t) {
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
    '../db', '../models/User', '../models/RefreshToken', '../models/Swipe',
    '../services/authService', '../services/userService',
    '../services/visibilityService', '../services/discoveryService', '../services/blockService',
    '../controllers/authController', '../controllers/userController',
    '../routes/auth', '../routes/users', '../routes/discovery', '../index',
  ].forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');

  return { app: buildApp(), User: require('../models/User') };
}

async function registerHttpUser(app, email, extra = {}) {
  const body = {
    email, password: 'Hunter2!!', name: email.split('@')[0].padEnd(2, 'x'),
    age: 30, gender: 'other', lookingFor: 'other', interests: ['x'], ...extra,
  };
  const r = await request(app).post('/flamebackend/v1/auth/register').send(body).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

const authH = (token) => ({ Authorization: `Bearer ${token}` });

test('an explicit PATCH of 18-50 filters out a 62-year-old, unlike an untouched document', async (t) => {
  const { app, User } = await setupHttp(t);
  const me = await registerHttpUser(app, 'prefset-viewer@x.com');
  const old = await registerHttpUser(app, 'prefset-old@x.com', { age: 62 });

  await request(app).patch('/flamebackend/v1/users/me/preferences')
    .set(authH(me.token)).send({ min_age: 18, max_age: 50 }).expect(200);

  const res = await request(app).get('/flamebackend/v1/discover')
    .set(authH(me.token)).expect(200);
  const ids = res.body.data.users.map((u) => u.id);

  assert.ok(!ids.includes(old.id), 'an explicit 18-50 PATCH must filter out a 62-year-old');
});

test('a user who has never PATCHed preferences still sees the unfiltered feed', async (t) => {
  const { app } = await setupHttp(t);
  const me = await registerHttpUser(app, 'prefset-untouched-viewer@x.com');
  const old = await registerHttpUser(app, 'prefset-untouched-old@x.com', { age: 62 });

  const res = await request(app).get('/flamebackend/v1/discover')
    .set(authH(me.token)).expect(200);
  const ids = res.body.data.users.map((u) => u.id);

  assert.ok(ids.includes(old.id), 'no existing behaviour changes for a document nobody has touched');
});

test('a user who PATCHes some other range still filters as before', async (t) => {
  const { app } = await setupHttp(t);
  const me = await registerHttpUser(app, 'prefset-other-viewer@x.com');
  const mid = await registerHttpUser(app, 'prefset-other-mid@x.com', { age: 30 });
  const old = await registerHttpUser(app, 'prefset-other-old@x.com', { age: 62 });

  await request(app).patch('/flamebackend/v1/users/me/preferences')
    .set(authH(me.token)).send({ min_age: 25, max_age: 35 }).expect(200);

  const res = await request(app).get('/flamebackend/v1/discover')
    .set(authH(me.token)).expect(200);
  const ids = res.body.data.users.map((u) => u.id);

  assert.ok(ids.includes(mid.id), 'age inside the new explicit range is shown');
  assert.ok(!ids.includes(old.id), 'age outside the new explicit range is filtered, as before');
});
