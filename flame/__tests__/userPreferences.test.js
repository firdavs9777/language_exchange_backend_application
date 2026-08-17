// Stub Flame's S3 util so tests don't hit DigitalOcean.
require.cache[require.resolve('../utils/s3')] = {
  exports: {
    uploadBuffer: async (_buf, key) => `https://stub.example.com/${key}`,
    deleteObject: async () => {},
    bucket: 'stub-bucket',
  },
};

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const dbHelper = require('./helpers/db');

// Takes the test context so teardown registers BEFORE anything that can throw:
// a failing require in between leaves the mongod running and node never exits.
async function setup(t) {
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
    '../db', '../models/User', '../models/RefreshToken',
    '../services/authService', '../services/userService',
    '../services/visibilityService',
    '../controllers/authController', '../controllers/userController',
    '../routes/auth', '../routes/users', '../index',
  ].forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');
  return buildApp();
}

async function registerUser(app, email) {
  const body = {
    // padEnd guards against a short local-part, which would fail the auth
    // route's `name: z.string().min(2)` validation.
    email, password: 'Hunter2!!', name: email.split('@')[0].padEnd(2, 'x'),
    age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
  };
  const r = await request(app).post('/flamebackend/v1/auth/register').send(body).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

const authH = (token) => ({ Authorization: `Bearer ${token}` });
const URL = '/flamebackend/v1/users/me/preferences';

test('updates every preference field', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'aa@x.com');

  const res = await request(app).patch(URL).set(authH(a.token))
    .send({
      min_age: 21, max_age: 35, max_distance: 25,
      show_distance: false, show_online_status: false,
    })
    .expect(200);

  const p = res.body.data.preferences;
  assert.equal(p.minAge, 21);
  assert.equal(p.maxAge, 35);
  assert.equal(p.maxDistance, 25);
  assert.equal(p.showDistance, false);
  assert.equal(p.showOnlineStatus, false);
});

test('a partial body leaves the other fields alone', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'bb@x.com');

  await request(app).patch(URL).set(authH(a.token))
    .send({ min_age: 21, max_age: 35 }).expect(200);

  // preferences is a Mongoose SUB-DOCUMENT. Writing it wholesale rather than by
  // dotted path would reset maxDistance and both privacy flags to their
  // defaults — silently turning privacy back on.
  const res = await request(app).patch(URL).set(authH(a.token))
    .send({ show_online_status: false }).expect(200);

  const p = res.body.data.preferences;
  assert.equal(p.showOnlineStatus, false);
  assert.equal(p.minAge, 21, 'an earlier update must survive a later partial one');
  assert.equal(p.maxAge, 35);
  assert.equal(p.maxDistance, 50, 'untouched fields keep their default');
});

test('the change persists', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'cc@x.com');

  await request(app).patch(URL).set(authH(a.token))
    .send({ min_age: 30 }).expect(200);

  const me = await request(app).get('/flamebackend/v1/users/me')
    .set(authH(a.token)).expect(200);

  assert.equal(me.body.data.preferences.minAge, 30);
});

test('an empty body is rejected rather than a no-op 200', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'dd@x.com');

  // A request that changes nothing is a client bug; answering 200 hides it.
  await request(app).patch(URL).set(authH(a.token)).send({}).expect(422);
});

test('out-of-range values are rejected', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'ee@x.com');

  // 18 is the floor everywhere else in this codebase; a dating app cannot
  // accept a preference below it.
  await request(app).patch(URL).set(authH(a.token))
    .send({ min_age: 17 }).expect(422);
  await request(app).patch(URL).set(authH(a.token))
    .send({ max_age: 200 }).expect(422);
  await request(app).patch(URL).set(authH(a.token))
    .send({ max_distance: -5 }).expect(422);
});

test('min_age above max_age is rejected', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'ff@x.com');

  // An inverted range matches nobody, and Discover would silently return an
  // empty feed that looks like "no one is near you".
  await request(app).patch(URL).set(authH(a.token))
    .send({ min_age: 40, max_age: 30 }).expect(422);
});

test('an unauthenticated request is rejected', async (t) => {
  const app = await setup(t);
  await request(app).patch(URL).send({ min_age: 21 }).expect(401);
});
