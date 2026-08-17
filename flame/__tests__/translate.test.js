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

const AXIOS = require.resolve('axios');

// Replaces axios for the duration of one test, so nothing reaches the network
// and every outbound request is observable.
function stubAxios(handler) {
  const real = require.cache[AXIOS];
  require.cache[AXIOS] = {
    id: AXIOS, filename: AXIOS, loaded: true, exports: { post: handler },
  };
  return () => {
    if (real) require.cache[AXIOS] = real; else delete require.cache[AXIOS];
  };
}

// Takes the test context so teardown registers BEFORE anything that can throw.
// Registering it at the end means a failing require leaves the mongod running
// and node never exits — one broken test becomes a hung suite.
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
  process.env.LIBRETRANSLATE_URL = 'https://libre.test';

  [
    '../db', '../models/User', '../models/RefreshToken', '../models/Story',
    '../models/Conversation', '../models/Message', '../models/Swipe',
    '../models/Match', '../models/Translation',
    '../services/authService', '../services/userService', '../services/storyService',
    '../services/visibilityService', '../services/chatService',
    '../services/matchService', '../services/translationService',
    '../controllers/authController', '../controllers/userController',
    '../controllers/storyController', '../controllers/chatController',
    '../controllers/translationController',
    '../routes/auth', '../routes/users', '../routes/stories',
    '../routes/conversations', '../routes/translate', '../index',
  ].forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');
  return buildApp();
}

async function registerUser(app, email) {
  const body = {
    // padEnd guards against short local-parts, which would fail the auth
    // route's `name: z.string().min(2)` validation.
    email, password: 'Hunter2!!', name: email.split('@')[0].padEnd(2, 'x'),
    age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
  };
  const r = await request(app).post('/flamebackend/v1/auth/register').send(body).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

const authH = (token) => ({ Authorization: `Bearer ${token}` });
const URL = '/flamebackend/v1/translate';

test('translates, returning the keys the shipped app parses', async (t) => {
  const restore = stubAxios(async () => ({ data: { translatedText: 'hola' } }));
  t.after(restore);

  const app = await setup(t);
  const a = await registerUser(app, 'aa@x.com');

  const res = await request(app).post(URL).set(authH(a.token))
    .send({ text: 'hello', target_lang: 'es', source_lang: 'en' })
    .expect(200);

  assert.equal(res.body.success, true);
  // lib/services/translation_service.dart reads exactly this key.
  assert.equal(res.body.data.translated_text, 'hola');
  assert.equal(res.body.data.detected_source_lang, 'en');
  assert.equal(res.body.data.cached, false);
});

test('the second identical request is served from the cache', async (t) => {
  let providerCalls = 0;
  const restore = stubAxios(async () => {
    providerCalls += 1;
    return { data: { translatedText: 'hola' } };
  });
  t.after(restore);

  const app = await setup(t);
  const a = await registerUser(app, 'bb@x.com');

  const send = () => request(app).post(URL).set(authH(a.token))
    .send({ text: 'hello', target_lang: 'es', source_lang: 'en' });

  await send().expect(200);
  const second = await send().expect(200);

  assert.equal(second.body.data.cached, true);
  assert.equal(providerCalls, 1);
});

test('omitting source_lang detects it and reports what was detected', async (t) => {
  const restore = stubAxios(async (url) => {
    if (url.endsWith('/detect')) return { data: [{ language: 'fr' }] };
    return { data: { translatedText: 'hello' } };
  });
  t.after(restore);

  const app = await setup(t);
  const a = await registerUser(app, 'cc@x.com');

  const res = await request(app).post(URL).set(authH(a.token))
    .send({ text: 'bonjour', target_lang: 'en' })
    .expect(200);

  assert.equal(res.body.data.translated_text, 'hello');
  assert.equal(res.body.data.detected_source_lang, 'fr');
});

test('missing text is 422', async (t) => {
  const restore = stubAxios(async () => ({ data: {} }));
  t.after(restore);

  const app = await setup(t);
  const a = await registerUser(app, 'dd@x.com');

  await request(app).post(URL).set(authH(a.token))
    .send({ target_lang: 'es' })
    .expect(422);
});

test('missing target_lang is 422', async (t) => {
  const restore = stubAxios(async () => ({ data: {} }));
  t.after(restore);

  const app = await setup(t);
  const a = await registerUser(app, 'ee@x.com');

  await request(app).post(URL).set(authH(a.token))
    .send({ text: 'hello' })
    .expect(422);
});

test('an unauthenticated request is rejected', async (t) => {
  let called = false;
  const restore = stubAxios(async () => { called = true; return { data: {} }; });
  t.after(restore);

  const app = await setup(t);

  // Every call is a metered outbound request. An open endpoint is somebody
  // else's translation bill.
  await request(app).post(URL)
    .send({ text: 'hello', target_lang: 'es', source_lang: 'en' })
    .expect(401);

  assert.equal(called, false, 'auth must run before the provider is touched');
});

test('a provider outage is 422 with a readable message, never 500', async (t) => {
  const restore = stubAxios(async () => { throw new Error('ECONNREFUSED'); });
  t.after(restore);

  const app = await setup(t);
  const a = await registerUser(app, 'ff@x.com');

  const res = await request(app).post(URL).set(authH(a.token))
    .send({ text: 'hello', target_lang: 'es', source_lang: 'en' })
    .expect(422);

  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /unavailable/i);
});
