// Stub Flame's S3 util so tests don't hit DigitalOcean.
require.cache[require.resolve('../utils/s3')] = {
  exports: {
    uploadBuffer: async (_buf, key) => `https://stub.example.com/${key}`,
    deleteObject: async () => {},
    bucket: 'stub-bucket',
  },
};

const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const dbHelper = require('./helpers/db');

// One database for the whole file, and a fresh app per test.
//
// The per-test setup()/teardown() pattern used elsewhere spins a new in-memory
// Mongo for every test; by the sixth, model bindings from a stopped server
// surface as MongoNotConnectedError on an unrelated route. These tests need
// isolated *limiter counters*, not isolated data — and a limiter's state lives
// in the app instance, so rebuilding just the app gives exactly that, in a
// fraction of the time.
const MODULES = [
  '../db', '../models/User', '../models/RefreshToken', '../models/Story',
  '../models/Conversation', '../models/Message', '../models/Swipe',
  '../models/Match',
  '../services/authService', '../services/userService', '../services/storyService',
  '../services/visibilityService', '../services/chatService',
  '../services/matchService',
  '../controllers/authController', '../controllers/userController',
  '../controllers/storyController', '../controllers/chatController',
  '../controllers/socialAuthController',
  '../routes/auth', '../routes/users', '../routes/stories',
  '../routes/conversations', '../index',
];

async function startDb() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  MODULES.forEach((m) => { try { delete require.cache[require.resolve(m)]; } catch {} });
  const { connect } = require('../db');
  await connect();
}

async function stopDb() {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
}

// Rebuilds only the route layer, so every test starts with empty rate-limit
// counters while keeping the one live connection.
function freshApp() {
  ['../routes/auth', '../index'].forEach((m) => {
    try { delete require.cache[require.resolve(m)]; } catch {}
  });
  const { buildApp } = require('./helpers/app');
  return buildApp();
}

before(startDb);
after(stopDb);

const P = '/flamebackend/v1';
const LONDON = [-0.1276, 51.5072];
const NEAR_LONDON = [-0.1400, 51.5100];   // ~1 km
const PARIS = [2.3522, 48.8566];          // ~344 km

async function makeUser(app, email, over = {}) {
  const res = await request(app).post(`${P}/auth/register`).send({
    email, password: 'Hunter2!!', name: email.split('@')[0].slice(0, 20).padEnd(2, 'x'),
    age: 30, gender: 'female', lookingFor: 'male', interests: ['Travel'],
  }).expect(201);
  const id = res.body.data.user.id;
  // Required lazily: the harness clears model modules in startDb, so a
  // top-level require would bind User to a connection that no longer exists and
  // every write would buffer until it timed out.
  const User = require('../models/User');
  if (Object.keys(over).length) await User.updateOne({ _id: id }, { $set: over });
  return { id, token: res.body.data.tokens.accessToken };
}

const geo = (coords) => ({ locationGeo: { type: 'Point', coordinates: coords } });
const authH = (token) => ({ Authorization: `Bearer ${token}` });

const deck = async (app, token, limit = 50) => {
  const res = await request(app).get(`${P}/discover?limit=${limit}`)
    .set(authH(token)).expect(200);
  return res.body.data.users.map((u) => u.name);
};

test('a profile inside the radius is returned and one outside is not', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'radius-me@x.com', {
    ...geo(LONDON),
    'preferences.maxDistance': 50,
    'preferences.preferencesSet': true,
  });
  await makeUser(app, 'near@x.com', { gender: 'male', ...geo(NEAR_LONDON) });
  await makeUser(app, 'far@x.com', { gender: 'male', ...geo(PARIS) });

  const names = await deck(app, me.token);

  assert.ok(names.includes('near'), 'a 1 km profile must be in a 50 km radius');
  assert.ok(!names.includes('far'), 'a 344 km profile must not be');
});

test('a profile with no location is returned regardless', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'nullloc-me@x.com', {
    ...geo(LONDON),
    'preferences.maxDistance': 10,
    'preferences.preferencesSet': true,
  });
  await makeUser(app, 'nowhere@x.com', { gender: 'male', locationGeo: null });

  // Excluding them would make every account predating mandatory location capture
  // invisible to everyone, with nothing on screen saying so.
  assert.ok((await deck(app, me.token)).includes('nowhere'));
});

test('a viewer with no location gets no distance filter', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'noloc-me@x.com', {
    locationGeo: null,
    'preferences.maxDistance': 1,
    'preferences.preferencesSet': true,
  });
  await makeUser(app, 'anywhere@x.com', { gender: 'male', ...geo(PARIS) });

  assert.ok((await deck(app, me.token)).includes('anywhere'),
    'you cannot measure from nowhere; an unfiltered deck beats an empty one');
});

test('distance does not apply until preferences were deliberately written', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'untouched-me@x.com', {
    ...geo(LONDON),
    'preferences.maxDistance': 1,
    'preferences.preferencesSet': false,
  });
  await makeUser(app, 'faraway@x.com', { gender: 'male', ...geo(PARIS) });

  assert.ok((await deck(app, me.token)).includes('faraway'));
});

test('the deck stays in lastActive order with the geo filter applied', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'order-me@x.com', {
    ...geo(LONDON),
    'preferences.maxDistance': 500,
    'preferences.preferencesSet': true,
  });
  // The nearer profile is the STALER one. Under $near it would come first; under
  // $geoWithin plus sort(lastActive) the fresher one must.
  await makeUser(app, 'stalenear@x.com', {
    gender: 'male', ...geo(NEAR_LONDON), lastActive: new Date('2020-01-01'),
  });
  await makeUser(app, 'freshfar@x.com', {
    gender: 'male', ...geo(PARIS), lastActive: new Date('2030-01-01'),
  });

  const names = await deck(app, me.token);
  // Relative, not absolute: the database is shared across this file, so earlier
  // tests' users are also in range. What matters is that the nearer-but-staler
  // profile sorts BELOW the farther-but-fresher one.
  assert.ok(names.indexOf('freshfar') < names.indexOf('stalenear'),
    `expected freshfar before stalenear, got ${names.join(', ')} — this is what `
    + 'stops $geoWithin quietly becoming $near later');
});

test('max_distance below 1 is rejected', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'floor@x.com', {});
  await request(app).patch(`${P}/users/me/preferences`)
    .set(authH(me.token)).send({ max_distance: 0 }).expect(422);
});

test('interests filter matches on any overlap', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'int-me@x.com', {
    'preferences.interestsFilter': ['Music', 'Hiking'],
    'preferences.preferencesSet': true,
  });
  await makeUser(app, 'onematch@x.com', { gender: 'male', interests: ['Music', 'Food'] });
  await makeUser(app, 'nomatch@x.com', { gender: 'male', interests: ['Gaming'] });

  const names = await deck(app, me.token);

  assert.ok(names.includes('onematch'), 'one shared interest is enough');
  assert.ok(!names.includes('nomatch'));
});

test('an empty interests filter filters nothing', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'noint-me@x.com', {
    'preferences.interestsFilter': [],
    'preferences.preferencesSet': true,
  });
  await makeUser(app, 'anyone@x.com', { gender: 'male', interests: ['Gaming'] });

  assert.ok((await deck(app, me.token)).includes('anyone'));
});

test('interests_filter is persisted through the PATCH', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'patch-int@x.com', {});

  const res = await request(app).patch(`${P}/users/me/preferences`)
    .set(authH(me.token)).send({ interests_filter: ['Music', 'Art'] }).expect(200);

  assert.deepEqual(res.body.data.preferences.interestsFilter, ['Music', 'Art']);
});

test('an off-catalogue interest token is rejected', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'badtoken@x.com', {});

  await request(app).patch(`${P}/users/me/preferences`)
    .set(authH(me.token)).send({ interests_filter: ['NotAnInterest'] }).expect(422);
});

test('more than ten interest tokens are rejected', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'toomany@x.com', {});
  const { INTEREST_TOKENS } = require('../config/interests');

  await request(app).patch(`${P}/users/me/preferences`)
    .set(authH(me.token)).send({ interests_filter: INTEREST_TOKENS.slice(0, 11) })
    .expect(422);
});

test('the head path omits total and derives has_more from a full page', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'head-me@x.com', {});
  for (let i = 0; i < 3; i++) await makeUser(app, `head${i}@x.com`, { gender: 'male' });

  const res = await request(app).get(`${P}/discover?limit=2`)
    .set(authH(me.token)).expect(200);

  assert.equal(res.body.data.users.length, 2);
  assert.equal(res.body.data.pagination.has_more, true);
  assert.equal(res.body.data.pagination.total, undefined,
    'a response must not carry a field it did not compute');
  assert.equal(res.body.data.pagination.offset, undefined);
});

test('the legacy offset path is unchanged', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'legacy-me@x.com', {});
  for (let i = 0; i < 3; i++) await makeUser(app, `legacy${i}@x.com`, { gender: 'male' });

  const res = await request(app).get(`${P}/discover?limit=2&offset=1`)
    .set(authH(me.token)).expect(200);

  assert.equal(typeof res.body.data.pagination.total, 'number');
  assert.equal(res.body.data.pagination.offset, 1);
});

test('swiping then refetching the head never repeats or skips a profile', async () => {
  const app = freshApp();
  const me = await makeUser(app, 'drift-me@x.com', {});
  const mine = [];
  for (let i = 0; i < 6; i++) {
    mine.push((await makeUser(app, `drift${i}@x.com`,
      { gender: 'male', interests: ['DriftOnly'] })).id);
  }
  // Isolate this test from users other tests created in the shared database.
  const User = require('../models/User');
  await User.updateOne({ _id: me.id }, {
    $set: { 'preferences.interestsFilter': ['DriftOnly'], 'preferences.preferencesSet': true },
  });

  const seen = new Set();
  for (let round = 0; round < 3; round++) {
    const page = await request(app).get(`${P}/discover?limit=2`)
      .set(authH(me.token)).expect(200);
    for (const u of page.body.data.users) {
      assert.ok(!seen.has(u.id), 'a profile was served twice');
      seen.add(u.id);
      await request(app).post(`${P}/swipes/pass`).set(authH(me.token))
        .send({ user_id: u.id }).expect(200);
    }
  }

  assert.equal(seen.size, 6,
    'every profile must be served exactly once — under skip(offset) the growing '
    + 'excluded set made page two step over profiles never seen');
});
