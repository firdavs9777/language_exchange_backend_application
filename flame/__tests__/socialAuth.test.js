const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const dbHelper = require('./helpers/db');

const SOCIAL_ENV = ['FLAME_GOOGLE_CLIENT_ID', 'FLAME_APPLE_CLIENT_ID', 'FLAME_FACEBOOK_APP_ID', 'FLAME_FACEBOOK_APP_SECRET'];

function clearSocialEnv() {
  for (const k of SOCIAL_ENV) delete process.env[k];
}

// Resets caches, connects, and optionally patches socialVerify BEFORE the
// controller is (re)required, then builds the app. Returns the app.
async function setup({ patch } = {}) {
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
   '../services/socialAuthService', '../utils/jwt', '../utils/socialVerify',
   '../controllers/authController', '../controllers/socialAuthController',
   '../routes/auth', '../index']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  if (patch) {
    // Require the (fresh) verifier and mutate its exports so the controller,
    // which does `require('../utils/socialVerify').verifyX(...)`, sees the stub.
    const sv = require('../utils/socialVerify');
    patch(sv);
  }

  const { buildApp } = require('./helpers/app');
  return buildApp();
}

const BASE = '/flamebackend/v1';

test('POST /auth/check-email: available true for fresh email, false after register, 422 on invalid', async (t) => {
  clearSocialEnv();
  const app = await setup();

  const fresh = await request(app).post(`${BASE}/auth/check-email`).send({ email: 'free@x.com' }).expect(200);
  assert.equal(fresh.body.success, true);
  assert.equal(fresh.body.data.available, true);

  await request(app).post(`${BASE}/auth/register`).send({
    email: 'taken@x.com', password: 'Hunter2!!', name: 'Ta',
    age: 30, gender: 'female', lookingFor: 'male', interests: ['x'],
  }).expect(201);

  const taken = await request(app).post(`${BASE}/auth/check-email`).send({ email: 'taken@x.com' }).expect(200);
  assert.equal(taken.body.data.available, false);

  const bad = await request(app).post(`${BASE}/auth/check-email`).send({ email: 'not-an-email' }).expect(422);
  assert.equal(bad.body.error.code, 'VALIDATION');

  // Soft-deleted user's email must STILL report unavailable: the unique email
  // index holds the row, so register would 409. check-email must reflect that.
  const User = require('../models/User');
  await User.updateOne({ email: 'taken@x.com' }, { $set: { isDeleted: true, deletedAt: new Date() } });
  const softDeleted = await request(app).post(`${BASE}/auth/check-email`).send({ email: 'taken@x.com' }).expect(200);
  assert.equal(softDeleted.body.data.available, false);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/google|apple|facebook → 501 PROVIDER_NOT_CONFIGURED when unconfigured', async (t) => {
  clearSocialEnv();
  const app = await setup();

  const g = await request(app).post(`${BASE}/auth/google`).send({ id_token: 'x' }).expect(501);
  assert.equal(g.body.error.code, 'PROVIDER_NOT_CONFIGURED');

  const a = await request(app).post(`${BASE}/auth/apple`).send({ id_token: 'x' }).expect(501);
  assert.equal(a.body.error.code, 'PROVIDER_NOT_CONFIGURED');

  const f = await request(app).post(`${BASE}/auth/facebook`).send({ access_token: 'x' }).expect(501);
  assert.equal(f.body.error.code, 'PROVIDER_NOT_CONFIGURED');

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/google → 201 then 200 with stubbed verifier', async (t) => {
  clearSocialEnv();
  process.env.FLAME_GOOGLE_CLIENT_ID = 'g-client';
  const app = await setup({
    patch: (sv) => {
      sv.verifyGoogle = async () => ({
        providerId: 'g1', email: 'g@x.com', name: 'Gee', emailVerified: true, photo: null,
      });
    },
  });

  const first = await request(app).post(`${BASE}/auth/google`).send({ id_token: 'anything' }).expect(201);
  assert.equal(first.body.success, true);
  assert.equal(first.body.data.is_new_user, true);
  assert.ok(first.body.data.user.id);
  assert.ok(first.body.data.tokens.accessToken);
  assert.ok(first.body.data.tokens.refreshToken);

  const second = await request(app).post(`${BASE}/auth/google`).send({ id_token: 'anything' }).expect(200);
  assert.equal(second.body.data.is_new_user, false);
  assert.equal(second.body.data.user.id, first.body.data.user.id);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); clearSocialEnv(); });
});
