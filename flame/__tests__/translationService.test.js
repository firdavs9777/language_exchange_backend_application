const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

// s3.js reads these at module load and throws without them; chatService pulls
// it in transitively, so they must be set before any require below.
process.env.FLAME_SPACES_BUCKET = 't';
process.env.SPACES_ENDPOINT = 'e';
process.env.DO_SPACES_KEY = 'k';
process.env.DO_SPACES_SECRET = 's';
process.env.OPENAI_API_KEY = 'sk-test';

const OPENAI = require.resolve('openai');

// Stub the openai package so nothing reaches the network and every request is
// observable. Same client shape BananaTalk's aiProviderService uses.
function withStubbedOpenAI(handler) {
  const real = require.cache[OPENAI];
  class FakeOpenAI {
    constructor(_opts) {
      this.chat = { completions: { create: handler } };
    }
  }
  require.cache[OPENAI] = {
    id: OPENAI, filename: OPENAI, loaded: true,
    exports: FakeOpenAI,
  };
  return () => {
    if (real) require.cache[OPENAI] = real; else delete require.cache[OPENAI];
  };
}

// Builds the response shape openai's SDK returns.
const completion = (text) => ({
  choices: [{ message: { content: text } }],
  usage: { prompt_tokens: 1, completion_tokens: 1 },
});

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

test('translates', async (t) => {
  const calls = [];
  const restore = withStubbedOpenAI(async (opts) => {
    calls.push(opts);
    return completion('hola');
  });
  t.after(restore);

  const svc = await setup(t);
  const out = await svc.translate({ text: 'hello', targetLang: 'es' });

  assert.equal(out.translatedText, 'hola');
  assert.equal(out.cached, false);
  assert.equal(calls.length, 1,
    'one completion, not a detect round trip and then a translate');
  assert.equal(calls[0].model, 'gpt-4o-mini');
  // The text to translate must reach the model.
  assert.match(JSON.stringify(calls[0].messages), /hello/);
});

test('needs no source language', async (t) => {
  const restore = withStubbedOpenAI(async () => completion('hello'));
  t.after(restore);

  const svc = await setup(t);

  // This is why the provider changed. Flame's shipped client sends source_lang
  // as optional, and BananaTalk's enhanced-translation endpoint 400s without
  // it. A model does not need to be told.
  const out = await svc.translate({ text: 'bonjour', targetLang: 'en' });
  assert.equal(out.translatedText, 'hello');
});

test('an explicit source language is honoured but not required', async (t) => {
  const calls = [];
  const restore = withStubbedOpenAI(async (opts) => {
    calls.push(opts);
    return completion('hola');
  });
  t.after(restore);

  const svc = await setup(t);
  await svc.translate({ text: 'hello', targetLang: 'es', sourceLang: 'en' });

  assert.equal(calls.length, 1);
});

test('a repeat request is served from the cache', async (t) => {
  let providerCalls = 0;
  const restore = withStubbedOpenAI(async () => {
    providerCalls += 1;
    return completion('hola');
  });
  t.after(restore);

  const svc = await setup(t);
  const first = await svc.translate({ text: 'hello', targetLang: 'es' });
  const second = await svc.translate({ text: 'hello', targetLang: 'es' });

  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.translatedText, 'hola');
  assert.equal(providerCalls, 1,
    'every completion costs money and a bubble re-translates on rebuild');
});

test('the cache does not care whether a source language was supplied', async (t) => {
  let providerCalls = 0;
  const restore = withStubbedOpenAI(async () => {
    providerCalls += 1;
    return completion('hola');
  });
  t.after(restore);

  const svc = await setup(t);
  await svc.translate({ text: 'hello', targetLang: 'es', sourceLang: 'en' });
  const auto = await svc.translate({ text: 'hello', targetLang: 'es' });

  // The source is a property of the text, so it is not part of the key. Two
  // requests for the same text and target are the same question.
  assert.equal(auto.cached, true);
  assert.equal(providerCalls, 1);
});

test('a provider failure is a ValidationError, not a raw throw', async (t) => {
  const restore = withStubbedOpenAI(async () => { throw new Error('ECONNRESET'); });
  t.after(restore);

  const svc = await setup(t);

  await assert.rejects(
    () => svc.translate({ text: 'hello', targetLang: 'es' }),
    (e) => e.status === 422,
    'an outage must reach the client as something it can show, never a 500',
  );
});

test('a missing API key says so rather than blaming the network', async (t) => {
  const restore = withStubbedOpenAI(async () => {
    const err = new Error('401 Incorrect API key provided');
    err.status = 401;
    throw err;
  });
  t.after(restore);

  const svc = await setup(t);

  await assert.rejects(
    () => svc.translate({ text: 'hello', targetLang: 'es' }),
    (e) => /not configured/i.test(e.message),
    'a misconfigured key never starts working on its own, so "try again" lies',
  );
});

test('an empty completion is a failure, not an empty translation', async (t) => {
  const restore = withStubbedOpenAI(async () => completion('   '));
  t.after(restore);

  const svc = await setup(t);

  await assert.rejects(
    () => svc.translate({ text: 'hello', targetLang: 'es' }),
    (e) => e.status === 422,
    'showing the user a blank translation is worse than showing an error',
  );
});

test('empty text is rejected before any provider call', async (t) => {
  let called = false;
  const restore = withStubbedOpenAI(async () => { called = true; return completion('x'); });
  t.after(restore);

  const svc = await setup(t);

  await assert.rejects(
    () => svc.translate({ text: '   ', targetLang: 'es' }),
    (e) => e.status === 422,
  );
  assert.equal(called, false);
});

test('a missing target language is rejected', async (t) => {
  const restore = withStubbedOpenAI(async () => completion('x'));
  t.after(restore);

  const svc = await setup(t);

  await assert.rejects(
    () => svc.translate({ text: 'hello' }),
    (e) => e.status === 422,
  );
});

test('a provider error logs its detail, not just the status line', async (t) => {
  const logged = [];
  const LOGGER = require.resolve('../utils/logger');
  const realLogger = require.cache[LOGGER];
  require.cache[LOGGER] = {
    id: LOGGER, filename: LOGGER, loaded: true,
    exports: {
      info: () => {},
      warn: (...a) => logged.push(a.join(' ')),
      error: (...a) => logged.push(a.join(' ')),
    },
  };
  t.after(() => {
    if (realLogger) require.cache[LOGGER] = realLogger;
    else delete require.cache[LOGGER];
  });

  const restore = withStubbedOpenAI(async () => {
    const err = new Error('429 Rate limit reached');
    err.status = 429;
    throw err;
  });
  t.after(restore);

  const svc = await setup(t);

  await assert.rejects(
    () => svc.translate({ text: 'hello', targetLang: 'es' }),
    (e) => e.status === 422,
  );

  // The previous provider logged only 'Request failed with status code 400',
  // which made a real production failure undiagnosable.
  const all = logged.join('\n');
  assert.match(all, /429/);
  assert.match(all, /Rate limit/);
});
