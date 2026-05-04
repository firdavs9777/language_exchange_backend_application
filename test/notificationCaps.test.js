const test = require('node:test');
const assert = require('node:assert/strict');
const { isCapped } = require('../services/fcmService');

const userWithCounts = (daily = {}, weekly = {}) => ({
  _id: 'u1',
  notificationCounters: {
    daily: new Map(Object.entries(daily)),
    weekly: new Map(Object.entries(weekly)),
  },
});

test('not capped under daily limit', () => {
  const u = userWithCounts({ moment_like: 4 });
  assert.equal(isCapped(u, 'moment_like'), false);
});

test('capped at daily limit', () => {
  const u = userWithCounts({ moment_like: 5 });
  assert.equal(isCapped(u, 'moment_like'), true);
});

test('weekly limit applies for re_engagement', () => {
  const u = userWithCounts({}, { re_engagement: 1 });
  assert.equal(isCapped(u, 're_engagement'), true);
});

test('unknown type is never capped', () => {
  const u = userWithCounts({});
  assert.equal(isCapped(u, 'system'), false);
});

test('user without counters is not capped', () => {
  assert.equal(isCapped({ _id: 'x' }, 'moment_like'), false);
});
