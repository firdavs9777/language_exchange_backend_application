const test = require('node:test');
const assert = require('node:assert/strict');

const ENV_KEYS = [
  'FLAME_GOOGLE_CLIENT_ID',
  'FLAME_APPLE_CLIENT_ID',
  'FLAME_FACEBOOK_APP_ID',
  'FLAME_FACEBOOK_APP_SECRET',
];

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

function loadModule() {
  delete require.cache[require.resolve('../utils/socialVerify')];
  return require('../utils/socialVerify');
}

test('isConfigured is false when provider env vars unset', () => {
  clearEnv();
  const sv = loadModule();
  assert.equal(sv.isConfigured('google'), false);
  assert.equal(sv.isConfigured('apple'), false);
  assert.equal(sv.isConfigured('facebook'), false);
  assert.equal(sv.isConfigured('unknown'), false);
});

test('isConfigured is true when provider env vars set', () => {
  clearEnv();
  const sv = loadModule();
  process.env.FLAME_GOOGLE_CLIENT_ID = 'g-client';
  process.env.FLAME_APPLE_CLIENT_ID = 'a-client';
  process.env.FLAME_FACEBOOK_APP_ID = 'fb-id';
  // facebook needs BOTH id and secret
  assert.equal(sv.isConfigured('facebook'), false);
  process.env.FLAME_FACEBOOK_APP_SECRET = 'fb-secret';
  assert.equal(sv.isConfigured('google'), true);
  assert.equal(sv.isConfigured('apple'), true);
  assert.equal(sv.isConfigured('facebook'), true);
  clearEnv();
});

test('verifyGoogle rejects garbage token with AuthError (no crash)', async () => {
  clearEnv();
  const sv = loadModule();
  process.env.FLAME_GOOGLE_CLIENT_ID = 'x';
  await assert.rejects(
    sv.verifyGoogle('garbage.token.value'),
    (e) => e.name === 'AuthError' && e.code === 'INVALID_SOCIAL_TOKEN',
  );
  clearEnv();
});

test('verifyFacebook rejects garbage token with AuthError (no crash)', async () => {
  clearEnv();
  const sv = loadModule();
  process.env.FLAME_FACEBOOK_APP_ID = 'fb-id';
  process.env.FLAME_FACEBOOK_APP_SECRET = 'fb-secret';
  await assert.rejects(
    sv.verifyFacebook('garbage-access-token'),
    (e) => e.name === 'AuthError' && e.code === 'INVALID_SOCIAL_TOKEN',
  );
  clearEnv();
});
