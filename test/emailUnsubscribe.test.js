const test = require('node:test');
const assert = require('node:assert/strict');

// Ensure a JWT_SECRET is present for the module under test (mirrors other
// tests' reliance on config/config.env, but we don't want a DB/env
// dependency here — just set a deterministic secret before requiring).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-emailUnsubscribe';

const {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  emailTypeToPrivacyField,
} = require('../controllers/emailUnsubscribe');

test('makeUnsubscribeToken/verifyUnsubscribeToken: valid round-trip returns userId + emailType', () => {
  const userId = '64b8f1f2a1b2c3d4e5f60789';
  const token = makeUnsubscribeToken(userId, 'promotional');

  const result = verifyUnsubscribeToken(token);
  assert.ok(result);
  assert.equal(result.userId, userId);
  assert.equal(result.emailType, 'promotional');
});

test('verifyUnsubscribeToken: round-trip works for digest emailType too', () => {
  const userId = '64b8f1f2a1b2c3d4e5f60ABC';
  const token = makeUnsubscribeToken(userId, 'digest');

  const result = verifyUnsubscribeToken(token);
  assert.equal(result.userId, userId);
  assert.equal(result.emailType, 'digest');
});

test('verifyUnsubscribeToken: tampered token (wrong signature) is rejected', () => {
  const userId = '64b8f1f2a1b2c3d4e5f60789';
  const token = makeUnsubscribeToken(userId, 'promotional');

  // Flip a character in the signature portion to simulate tampering.
  const tampered = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');

  assert.equal(verifyUnsubscribeToken(tampered), null);
});

test('verifyUnsubscribeToken: tampered payload (different userId, same-looking token) is rejected', () => {
  const token = makeUnsubscribeToken('64b8f1f2a1b2c3d4e5f60789', 'promotional');
  const [payload, sig] = token.split('.');
  // Substitute a different userId into the payload but keep the old signature.
  const forgedPayload = Buffer.from('64b8f1f2a1b2c3d4e5f6ffff:promotional', 'utf8').toString('base64url');
  const forged = `${forgedPayload}.${sig}`;

  assert.equal(verifyUnsubscribeToken(forged), null);
});

test('verifyUnsubscribeToken: garbage input is rejected, not thrown', () => {
  assert.equal(verifyUnsubscribeToken('not-a-real-token'), null);
  assert.equal(verifyUnsubscribeToken(''), null);
  assert.equal(verifyUnsubscribeToken(undefined), null);
  assert.equal(verifyUnsubscribeToken(null), null);
});

test('makeUnsubscribeToken: has no embedded expiry (works from an "old" instant)', () => {
  // No expiry claim — token must still verify long after issuance. We can't
  // travel through time, but we can assert the payload doesn't carry any
  // `exp`/timestamp field that verify depends on beyond userId:emailType.
  const userId = '64b8f1f2a1b2c3d4e5f60789';
  const token = makeUnsubscribeToken(userId, 'digest');
  const [payload] = token.split('.');
  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  assert.equal(decoded, `${userId}:digest`);
});

test('emailTypeToPrivacyField: promotional maps to privacySettings.emailNotifications', () => {
  assert.equal(emailTypeToPrivacyField('promotional'), 'privacySettings.emailNotifications');
});

test('emailTypeToPrivacyField: digest maps to privacySettings.weeklyDigest', () => {
  assert.equal(emailTypeToPrivacyField('digest'), 'privacySettings.weeklyDigest');
});

test('emailTypeToPrivacyField: unknown type maps to null (caller should 400)', () => {
  assert.equal(emailTypeToPrivacyField('bogus'), null);
  assert.equal(emailTypeToPrivacyField(''), null);
  assert.equal(emailTypeToPrivacyField(undefined), null);
});
