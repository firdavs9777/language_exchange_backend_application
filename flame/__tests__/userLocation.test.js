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

const URL = '/flamebackend/v1/users/me/location';

test('stores the coordinates', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'aa@x.com');

  const res = await request(app).patch(URL).set(authH(a.token))
    .send({ latitude: 37.5665, longitude: 126.9780 })
    .expect(200);

  assert.equal(res.body.data.location.latitude, 37.5665);
  assert.equal(res.body.data.location.longitude, 126.9780);
});

test('writes locationGeo in GeoJSON order, longitude first', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'bb@x.com');

  await request(app).patch(URL).set(authH(a.token))
    .send({ latitude: 37.5665, longitude: 126.9780 }).expect(200);

  const User = require('../models/User');
  const user = await User.findById(a.id).lean();

  // GeoJSON is [lng, lat] — the reverse of how people say it. Swapping them
  // puts the user in the wrong hemisphere and yields plausible wrong distances.
  assert.deepEqual(user.locationGeo.coordinates, [126.9780, 37.5665]);
  assert.equal(user.locationGeo.type, 'Point');
});

test('a 2dsphere query finds the NEW position, not the old one', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'cc@x.com');
  const User = require('../models/User');
  await User.createIndexes();

  await request(app).patch(URL).set(authH(a.token))
    .send({ latitude: 37.5665, longitude: 126.9780 }).expect(200);
  await request(app).patch(URL).set(authH(a.token))
    .send({ latitude: 48.8566, longitude: 2.3522 }).expect(200);

  // The assertion that proves locationGeo is actually updated rather than
  // written once: search near Paris and find them, search near Seoul and not.
  const nearParis = await User.find({
    locationGeo: {
      $near: {
        $geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
        $maxDistance: 50000,
      },
    },
  }).lean();
  assert.equal(nearParis.length, 1);

  const nearSeoul = await User.find({
    locationGeo: {
      $near: {
        $geometry: { type: 'Point', coordinates: [126.9780, 37.5665] },
        $maxDistance: 50000,
      },
    },
  }).lean();
  assert.equal(nearSeoul.length, 0, 'the old position must not still match');
});

test('both coordinates are required', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'dd@x.com');

  await request(app).patch(URL).set(authH(a.token))
    .send({ latitude: 37.5 }).expect(422);
  await request(app).patch(URL).set(authH(a.token))
    .send({ longitude: 126.9 }).expect(422);
});

test('out-of-range coordinates are rejected', async (t) => {
  const app = await setup(t);
  const a = await registerUser(app, 'ee@x.com');

  // Mongo rejects these at query time with an opaque error; catching them here
  // gives the client something it can act on.
  await request(app).patch(URL).set(authH(a.token))
    .send({ latitude: 91, longitude: 0 }).expect(422);
  await request(app).patch(URL).set(authH(a.token))
    .send({ latitude: 0, longitude: 181 }).expect(422);
});

test('an unauthenticated request is rejected', async (t) => {
  const app = await setup(t);
  await request(app).patch(URL).send({ latitude: 0, longitude: 0 }).expect(401);
});
