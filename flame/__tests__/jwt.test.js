const test = require('node:test');
const assert = require('node:assert/strict');

process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.FLAME_JWT_ACCESS_TTL = '5m';
process.env.FLAME_JWT_REFRESH_TTL = '7d';

const { signAccess, signRefresh, verifyAccess, verifyRefresh } = require('../utils/jwt');
const { AuthError } = require('../utils/errors');

test('access token round-trip', () => {
  const { token } = signAccess({ userId: 'u1' });
  const payload = verifyAccess(token);
  assert.equal(payload.userId, 'u1');
  assert.equal(payload.type, 'access');
  assert.equal(payload.iss, 'flame');
});

test('refresh token includes jti', () => {
  const { token, jti } = signRefresh({ userId: 'u1' });
  assert.ok(jti);
  const payload = verifyRefresh(token);
  assert.equal(payload.jti, jti);
  assert.equal(payload.type, 'refresh');
});

test('verifyAccess rejects refresh token', () => {
  const { token } = signRefresh({ userId: 'u1' });
  assert.throws(() => verifyAccess(token), (e) => e instanceof AuthError);
});

test('verifyAccess rejects tampered token', () => {
  const { token } = signAccess({ userId: 'u1' });
  const tampered = token.slice(0, -2) + 'XX';
  assert.throws(() => verifyAccess(tampered), (e) => e instanceof AuthError);
});
