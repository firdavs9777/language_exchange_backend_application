// Stub Flame's S3 util so tests don't hit DigitalOcean.
const stubbedUrl = 'https://stub.example.com/photo-key.jpg';
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
  ['../db', '../models/User', '../models/RefreshToken',
   '../services/authService', '../services/userService',
   '../controllers/authController', '../controllers/userController',
   '../routes/auth', '../routes/users', '../index']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');
  return buildApp();
}

const REG = {
  email: 'me@x.com', password: 'Hunter2!!', name: 'Me',
  age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
};

async function registerAndGetToken(app) {
  const r = await request(app).post('/flamebackend/v1/auth/register').send(REG).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

test('GET /users/me → 200 returns full profile', async (t) => {
  const app = await setup();
  const { token } = await registerAndGetToken(app);
  const res = await request(app)
    .get('/flamebackend/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(res.body.data.email, 'me@x.com');
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('GET /users/me → 401 without bearer', async (t) => {
  const app = await setup();
  await request(app).get('/flamebackend/v1/users/me').expect(401);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('GET /users/:id → 200 returns public profile (no email)', async (t) => {
  const app = await setup();
  const { token, id } = await registerAndGetToken(app);
  const res = await request(app)
    .get(`/flamebackend/v1/users/${id}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(res.body.data.name, 'Me');
  assert.equal(res.body.data.email, undefined);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('PATCH /users/me → 200 updates allowed fields, ignores rest', async (t) => {
  const app = await setup();
  const { token } = await registerAndGetToken(app);
  const res = await request(app)
    .patch('/flamebackend/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ bio: 'updated', email: 'try-to-change@x.com' })
    .expect(200);
  assert.equal(res.body.data.bio, 'updated');
  assert.equal(res.body.data.email, 'me@x.com');
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('GET /users/:id → 422 for malformed ObjectId', async (t) => {
  const app = await setup();
  const { token } = await registerAndGetToken(app);
  await request(app)
    .get('/flamebackend/v1/users/not-an-id')
    .set('Authorization', `Bearer ${token}`)
    .expect(422);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /users/me/photos → 201 adds photo to user', async (t) => {
  const app = await setup();
  const { token } = await registerAndGetToken(app);

  const res = await request(app)
    .post('/flamebackend/v1/users/me/photos')
    .set('Authorization', `Bearer ${token}`)
    .attach('photo', Buffer.from('fake-bytes'), { filename: 'p.jpg', contentType: 'image/jpeg' })
    .expect(201);
  assert.ok(res.body.data.id);
  assert.match(res.body.data.url, /^https:\/\/stub\.example\.com\//);
  assert.equal(res.body.data.isPrimary, true); // first photo is primary

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /users/me/photos → 422 on bad content-type', async (t) => {
  const app = await setup();
  const { token } = await registerAndGetToken(app);
  await request(app)
    .post('/flamebackend/v1/users/me/photos')
    .set('Authorization', `Bearer ${token}`)
    .attach('photo', Buffer.from('fake'), { filename: 'p.gif', contentType: 'image/gif' })
    .expect(422);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

// Re-export `stubbedUrl` for visibility (silence unused-var warnings; keeps stub pattern as spec'd).
void stubbedUrl;
