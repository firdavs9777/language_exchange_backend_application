const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FlameError, AuthError, NotFoundError, ValidationError,
} = require('../utils/errors');

test('FlameError carries code, message, status', () => {
  const e = new FlameError('X', 'm', 418);
  assert.equal(e.code, 'X');
  assert.equal(e.message, 'm');
  assert.equal(e.status, 418);
  assert.ok(e instanceof Error);
});

test('AuthError defaults to 401', () => {
  const e = new AuthError('INVALID', 'bad token');
  assert.equal(e.status, 401);
  assert.equal(e.code, 'INVALID');
});

test('NotFoundError defaults to 404 NOT_FOUND', () => {
  const e = new NotFoundError();
  assert.equal(e.status, 404);
  assert.equal(e.code, 'NOT_FOUND');
});

test('ValidationError defaults to 422 VALIDATION', () => {
  const e = new ValidationError('bad input');
  assert.equal(e.status, 422);
  assert.equal(e.code, 'VALIDATION');
});
