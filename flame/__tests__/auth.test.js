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
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  ['../db', '../models/User', '../models/RefreshToken', '../services/authService',
   '../controllers/authController', '../routes/auth', '../index']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');
  return buildApp();
}

const VALID_REG = {
  email: 'ada@x.com', password: 'Hunter2!!', name: 'Ada',
  age: 30, gender: 'female', lookingFor: 'male', interests: ['hiking'],
};

test('POST /auth/register → 201 + tokens', async (t) => {
  const app = await setup();
  const res = await request(app)
    .post('/flamebackend/v1/auth/register')
    .send(VALID_REG)
    .expect(201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, 'ada@x.com');
  assert.ok(res.body.data.tokens.accessToken);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/register → 422 on bad input (age < 18)', async (t) => {
  const app = await setup();
  const res = await request(app)
    .post('/flamebackend/v1/auth/register')
    .send({ ...VALID_REG, age: 15 })
    .expect(422);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VALIDATION');
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/login → 200 with correct credentials', async (t) => {
  const app = await setup();
  await request(app).post('/flamebackend/v1/auth/register').send(VALID_REG).expect(201);

  const res = await request(app)
    .post('/flamebackend/v1/auth/login')
    .send({ email: 'ada@x.com', password: 'Hunter2!!' })
    .expect(200);
  assert.ok(res.body.data.tokens.accessToken);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/login → 401 wrong password', async (t) => {
  const app = await setup();
  await request(app).post('/flamebackend/v1/auth/register').send(VALID_REG).expect(201);
  const res = await request(app)
    .post('/flamebackend/v1/auth/login')
    .send({ email: 'ada@x.com', password: 'wrong!!' })
    .expect(401);
  assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/refresh → 200 rotates token', async (t) => {
  const app = await setup();
  const reg = await request(app).post('/flamebackend/v1/auth/register').send(VALID_REG).expect(201);
  const refreshToken = reg.body.data.tokens.refreshToken;

  const res = await request(app)
    .post('/flamebackend/v1/auth/refresh')
    .send({ refreshToken })
    .expect(200);
  assert.ok(res.body.data.accessToken);
  assert.notEqual(res.body.data.refreshToken, refreshToken);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/logout → 200 (requires bearer token)', async (t) => {
  const app = await setup();
  const reg = await request(app).post('/flamebackend/v1/auth/register').send(VALID_REG).expect(201);
  const access = reg.body.data.tokens.accessToken;

  await request(app)
    .post('/flamebackend/v1/auth/logout')
    .set('Authorization', `Bearer ${access}`)
    .expect(200);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/logout → 401 without bearer', async (t) => {
  const app = await setup();
  await request(app).post('/flamebackend/v1/auth/logout').expect(401);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});
