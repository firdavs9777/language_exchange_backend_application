const test = require('node:test');
const assert = require('node:assert/strict');
const { isInQuietHours } = require('../lib/quietHours');

const userInKST = (over) => ({
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '08:00',
    timezone: 'Asia/Seoul',
    allowUrgent: true,
    ...over,
  },
});

test('returns false when disabled', () => {
  assert.equal(isInQuietHours(userInKST({ enabled: false }), new Date()), false);
});

test('detects overnight window — inside (23:30 KST)', () => {
  const now = new Date('2026-05-04T14:30:00Z');
  assert.equal(isInQuietHours(userInKST(), now), true);
});

test('detects overnight window — outside (10:00 KST)', () => {
  const now = new Date('2026-05-04T01:00:00Z');
  assert.equal(isInQuietHours(userInKST(), now), false);
});

test('detects intra-day window (13:00–15:00 local)', () => {
  const u = userInKST({ start: '13:00', end: '15:00', timezone: 'UTC' });
  assert.equal(isInQuietHours(u, new Date('2026-05-04T14:00:00Z')), true);
  assert.equal(isInQuietHours(u, new Date('2026-05-04T16:00:00Z')), false);
});

test('exact start boundary is inside window', () => {
  const u = userInKST({ start: '22:00', end: '08:00', timezone: 'UTC' });
  assert.equal(isInQuietHours(u, new Date('2026-05-04T22:00:00Z')), true);
});

test('exact end boundary is outside window', () => {
  const u = userInKST({ start: '22:00', end: '08:00', timezone: 'UTC' });
  assert.equal(isInQuietHours(u, new Date('2026-05-04T08:00:00Z')), false);
});
