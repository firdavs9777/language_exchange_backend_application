const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

// s3.js reads these at module load and throws without them; chatService pulls
// it in transitively, so they must be set before any require below.
process.env.FLAME_SPACES_BUCKET = 't';
process.env.SPACES_ENDPOINT = 'e';
process.env.DO_SPACES_KEY = 'k';
process.env.DO_SPACES_SECRET = 's';
process.env.LIBRETRANSLATE_URL = 'https://libre.test';

const AXIOS = require.resolve('axios');

// Stub axios so no network call happens and every request is observable.
function withStubbedAxios(handler) {
  const real = require.cache[AXIOS];
  require.cache[AXIOS] = {
    id: AXIOS, filename: AXIOS, loaded: true,
    exports: { post: handler },
  };
  return () => {
    if (real) require.cache[AXIOS] = real; else delete require.cache[AXIOS];
  };
}

// Takes the test context so teardown is registered BEFORE anything that can
// throw. Registering it afterwards — the obvious order — means a failing
// require leaves the mongod running and node never exits, which turns one
// broken test into a hung suite.
async function setup(t) {
  await dbHelper.start();
  t.after(async () => {
    try { await require('../db').close(); } catch { /* never opened */ }
    await dbHelper.stop();
  });

  ['../db', '../models/Translation', '../services/translationService']
    .forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
  return require('../services/translationService');
}

test('translates with an explicit source language', async (t) => {
  const calls = [];
  const restore = withStubbedAxios(async (url, body) => {
    calls.push({ url, body });
    return { data: { translatedText: 'hola' } };
  });
  t.after(restore);

  const svc = await setup(t);

  const out = await svc.translate({ text: 'hello', targetLang: 'es', sourceLang: 'en' });

  assert.equal(out.translatedText, 'hola');
  assert.equal(out.detectedSourceLang, 'en');
  assert.equal(out.cached, false);
  assert.equal(calls.length, 1, 'an explicit source must skip detection');
  assert.match(calls[0].url, /\/translate$/);
  assert.equal(calls[0].body.q, 'hello');
  assert.equal(calls[0].body.source, 'en');
  assert.equal(calls[0].body.target, 'es');
});

test('detects the source language when none is given', async (t) => {
  const calls = [];
  const restore = withStubbedAxios(async (url, body) => {
    calls.push({ url, body });
    if (url.endsWith('/detect')) return { data: [{ language: 'fr', confidence: 99 }] };
    return { data: { translatedText: 'hello' } };
  });
  t.after(restore);

  const svc = await setup(t);

  const out = await svc.translate({ text: 'bonjour', targetLang: 'en' });

  assert.equal(out.translatedText, 'hello');
  assert.equal(out.detectedSourceLang, 'fr');
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/detect$/, 'detection runs first');
});

test('a repeat request is served from the cache without calling the provider', async (t) => {
  let providerCalls = 0;
  const restore = withStubbedAxios(async (url) => {
    providerCalls += 1;
    if (url.endsWith('/detect')) return { data: [{ language: 'en' }] };
    return { data: { translatedText: 'hola' } };
  });
  t.after(restore);

  const svc = await setup(t);

  const first = await svc.translate({ text: 'hello', targetLang: 'es', sourceLang: 'en' });
  const second = await svc.translate({ text: 'hello', targetLang: 'es', sourceLang: 'en' });

  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.translatedText, 'hola');
  assert.equal(providerCalls, 1,
    'LibreTranslate is rate limited and a bubble re-translates on every rebuild');
});

test('an auto-detect request hits the cache written by an explicit-source one', async (t) => {
  let translateCalls = 0;
  const restore = withStubbedAxios(async (url) => {
    if (url.endsWith('/detect')) return { data: [{ language: 'en' }] };
    translateCalls += 1;
    return { data: { translatedText: 'hola' } };
  });
  t.after(restore);

  const svc = await setup(t);

  await svc.translate({ text: 'hello', targetLang: 'es', sourceLang: 'en' });
  const auto = await svc.translate({ text: 'hello', targetLang: 'es' });

  assert.equal(auto.cached, true,
    'the key is the DETECTED language, so both requests resolve to one entry');
  assert.equal(translateCalls, 1);
});

test('translating into the source language is a no-op, not a provider call', async (t) => {
  let translateCalls = 0;
  const restore = withStubbedAxios(async (url) => {
    if (url.endsWith('/detect')) return { data: [{ language: 'en' }] };
    translateCalls += 1;
    return { data: { translatedText: 'should not happen' } };
  });
  t.after(restore);

  const svc = await setup(t);

  const out = await svc.translate({ text: 'hello', targetLang: 'en', sourceLang: 'en' });

  assert.equal(out.translatedText, 'hello');
  assert.equal(translateCalls, 0,
    'paying a metered call to turn English into English is waste');
});

test('a provider failure is a ValidationError, not a raw throw', async (t) => {
  const restore = withStubbedAxios(async () => { throw new Error('ECONNREFUSED'); });
  t.after(restore);

  const svc = await setup(t);

  await assert.rejects(
    () => svc.translate({ text: 'hello', targetLang: 'es', sourceLang: 'en' }),
    (e) => e.status === 422,
    'an outage must reach the client as something it can show, never a 500',
  );
});

test('empty text is rejected before any provider call', async (t) => {
  let called = false;
  const restore = withStubbedAxios(async () => { called = true; return { data: {} }; });
  t.after(restore);

  const svc = await setup(t);

  await assert.rejects(
    () => svc.translate({ text: '   ', targetLang: 'es' }),
    (e) => e.status === 422,
  );
  assert.equal(called, false);
});

test('a missing target language is rejected', async (t) => {
  const restore = withStubbedAxios(async () => ({ data: {} }));
  t.after(restore);

  const svc = await setup(t);

  await assert.rejects(
    () => svc.translate({ text: 'hello' }),
    (e) => e.status === 422,
  );
});
