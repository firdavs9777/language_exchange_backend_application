const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
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
    '../services/authService', '../services/userService', '../services/discoveryService',
    '../controllers/authController', '../controllers/userController',
    '../routes/auth', '../routes/users', '../routes/discovery',
    '../routes/matches', '../routes/conversations', '../routes/billing',
    '../index',
  ].forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');
  return buildApp();
}

async function teardown() {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
}

async function registerUser(app, email) {
  const body = {
    email, password: 'Hunter2!!', name: email.split('@')[0],
    age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
  };
  const r = await request(app).post('/flamebackend/v1/auth/register').send(body).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

test('GET /billing/status → free status', async (t) => {
  const app = await setup();
  const me = await registerUser(app, 'me@x.com');
  const res = await request(app)
    .get('/flamebackend/v1/billing/status')
    .set('Authorization', `Bearer ${me.token}`)
    .expect(200);
  assert.equal(res.body.data.is_premium, false);
  t.after(teardown);
});

test('GET /matches → valid empty page', async (t) => {
  const app = await setup();
  const me = await registerUser(app, 'me@x.com');
  const res = await request(app)
    .get('/flamebackend/v1/matches?limit=20&offset=0')
    .set('Authorization', `Bearer ${me.token}`)
    .expect(200);
  assert.deepEqual(res.body.data.matches, []);
  assert.equal(res.body.data.pagination.has_more, false);
  t.after(teardown);
});

test('GET /conversations → valid empty page', async (t) => {
  const app = await setup();
  const me = await registerUser(app, 'me@x.com');
  const res = await request(app)
    .get('/flamebackend/v1/conversations?limit=20&offset=0')
    .set('Authorization', `Bearer ${me.token}`)
    .expect(200);
  assert.deepEqual(res.body.data.conversations, []);
  t.after(teardown);
});

test('GET /discover → other users, excludes self', async (t) => {
  const app = await setup();
  const me = await registerUser(app, 'me@x.com');
  const other = await registerUser(app, 'other@x.com');

  const res = await request(app)
    .get('/flamebackend/v1/discover?limit=10&offset=0')
    .set('Authorization', `Bearer ${me.token}`)
    .expect(200);

  const ids = res.body.data.users.map((u) => u.id);
  assert.ok(ids.includes(other.id), 'discover includes another user');
  assert.ok(!ids.includes(me.id), 'discover excludes the viewer');
  // snake_case shape the Flutter client expects
  const u = res.body.data.users[0];
  assert.ok('looking_for' in u && 'is_online' in u && 'created_at' in u);
  t.after(teardown);
});

test('GET /discover → 401 without bearer', async (t) => {
  const app = await setup();
  await request(app).get('/flamebackend/v1/discover').expect(401);
  t.after(teardown);
});
