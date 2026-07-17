const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

// Set mock env vars to prevent passport strategy errors during require
process.env.FACEBOOK_APP_ID = 'test_fb_id';
process.env.FACEBOOK_APP_SECRET = 'test_fb_secret';
process.env.GOOGLE_CLIENT_ID = 'test_google_id';
process.env.GOOGLE_CLIENT_SECRET = 'test_google_secret';

// resolveRegistrationUsername is the pure decision fn extracted in Step 3.
const { resolveRegistrationUsername } = require('../controllers/auth');

test('blank username falls back to generator', async () => {
  const gen = async () => 'auto_generated_1';
  assert.equal(await resolveRegistrationUsername('', 'Jane', { exists: async () => false, generate: gen }), 'auto_generated_1');
});
test('valid unique username is used (lowercased)', async () => {
  assert.equal(await resolveRegistrationUsername('CoolUser', 'Jane', { exists: async () => false, generate: async () => 'x' }), 'cooluser');
});
test('taken username throws USERNAME_TAKEN', async () => {
  await assert.rejects(
    () => resolveRegistrationUsername('taken', 'Jane', { exists: async () => true, generate: async () => 'x' }),
    (e) => e.code === 'USERNAME_TAKEN'
  );
});
test('invalid username throws USERNAME_INVALID', async () => {
  await assert.rejects(
    () => resolveRegistrationUsername('a b', 'Jane', { exists: async () => false, generate: async () => 'x' }),
    (e) => e.code === 'USERNAME_INVALID'
  );
});
