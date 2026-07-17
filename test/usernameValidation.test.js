const test = require('node:test');
const assert = require('node:assert/strict');
const { validateUsername, RESERVED_USERNAMES } = require('../utils/usernameValidation');

test('accepts a valid username and lowercases it', () => {
  assert.deepEqual(validateUsername('  CoolUser_1 '), { ok: true, normalized: 'cooluser_1', reason: null });
});
test('rejects too-short / bad chars', () => {
  assert.equal(validateUsername('ab').ok, false);
  assert.equal(validateUsername('ab').reason, 'invalid_format');
  assert.equal(validateUsername('has space').reason, 'invalid_format');
  assert.equal(validateUsername('WAY_too_long_username_here').reason, 'invalid_format');
});
test('rejects reserved names (case-insensitive)', () => {
  assert.equal(validateUsername('Admin').reason, 'reserved');
  assert.ok(RESERVED_USERNAMES.has('bananatalk'));
});
test('empty/blank normalizes to null ok:false invalid_format', () => {
  assert.equal(validateUsername('').reason, 'invalid_format');
});
