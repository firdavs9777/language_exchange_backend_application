/**
 * Coins v2 earn loop — pure decision unit tests (Task 17a).
 *
 * Covers the pure helpers in lib/coinRewards.js: once-per-day idempotency
 * key construction (daily reward) and the ad-reward daily-cap counting /
 * next-slot logic. Mirrors test/hasActiveStory.test.js's pattern of testing
 * the extracted pure module directly, no DB/mocking needed.
 *
 * The DB-touching handlers (controllers/coins.js claimDailyReward /
 * getDailyRewardStatus / claimAdReward) delegate the actual credit to
 * coinLedger.credit(), whose idempotency guarantees are already covered by
 * test/coinLedger.test.js + test/coinLedger.integration.test.js — not
 * re-tested here.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  formatUtcDate,
  utcDayRange,
  buildDailyRewardKey,
  buildAdRewardKey,
  isAdCapReached,
  nextAdRewardIndex,
} = require('../lib/coinRewards');

// --------------------------------------------------------------- UTC dates

test('formatUtcDate: formats as YYYY-MM-DD in UTC regardless of local offset', () => {
  assert.equal(formatUtcDate(new Date('2026-07-17T23:59:59.000Z')), '2026-07-17');
  assert.equal(formatUtcDate(new Date('2026-07-18T00:00:00.000Z')), '2026-07-18');
  assert.equal(formatUtcDate(new Date('2026-01-01T00:00:00.000Z')), '2026-01-01');
});

test('utcDayRange: [start, end) span exactly 24h and bracket the given instant', () => {
  const { start, end } = utcDayRange(new Date('2026-07-17T15:30:00.000Z'));
  assert.equal(start.toISOString(), '2026-07-17T00:00:00.000Z');
  assert.equal(end.toISOString(), '2026-07-18T00:00:00.000Z');
  assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
});

// ---------------------------------------------------------- daily reward key

test('buildDailyRewardKey: same user + same UTC day -> identical key (idempotent)', () => {
  const a = buildDailyRewardKey('user1', new Date('2026-07-17T01:00:00.000Z'));
  const b = buildDailyRewardKey('user1', new Date('2026-07-17T23:59:00.000Z'));
  assert.equal(a, b);
  assert.equal(a, 'daily-user1-2026-07-17');
});

test('buildDailyRewardKey: different UTC day -> different key (resets)', () => {
  const day1 = buildDailyRewardKey('user1', new Date('2026-07-17T12:00:00.000Z'));
  const day2 = buildDailyRewardKey('user1', new Date('2026-07-18T00:00:01.000Z'));
  assert.notEqual(day1, day2);
});

test('buildDailyRewardKey: different user, same day -> different key', () => {
  const u1 = buildDailyRewardKey('user1', new Date('2026-07-17T12:00:00.000Z'));
  const u2 = buildDailyRewardKey('user2', new Date('2026-07-17T12:00:00.000Z'));
  assert.notEqual(u1, u2);
});

// ------------------------------------------------------------- ad reward cap

test('isAdCapReached: false while under cap, true at and beyond cap', () => {
  const cap = 5;
  assert.equal(isAdCapReached(0, cap), false);
  assert.equal(isAdCapReached(4, cap), false);
  assert.equal(isAdCapReached(5, cap), true);
  assert.equal(isAdCapReached(6, cap), true); // beyond, e.g. a prior race
});

test('nextAdRewardIndex: 1-indexed slot derived from today\'s count', () => {
  assert.equal(nextAdRewardIndex(0), 1);
  assert.equal(nextAdRewardIndex(4), 5);
});

test('buildAdRewardKey: same user/day/slot -> identical key; different slot/day/user -> distinct', () => {
  const date = new Date('2026-07-17T12:00:00.000Z');
  const k1a = buildAdRewardKey('user1', 1, date);
  const k1b = buildAdRewardKey('user1', 1, date);
  assert.equal(k1a, k1b);
  assert.equal(k1a, 'ad-user1-2026-07-17-1');

  const k2 = buildAdRewardKey('user1', 2, date);
  assert.notEqual(k1a, k2);

  const otherDay = buildAdRewardKey('user1', 1, new Date('2026-07-18T12:00:00.000Z'));
  assert.notEqual(k1a, otherDay);

  const otherUser = buildAdRewardKey('user2', 1, date);
  assert.notEqual(k1a, otherUser);
});

test('ad-reward race is bounded: concurrent requests reading the same count compute the same key', () => {
  // Two concurrent requests both read countToday=4 (cap=5) before either
  // credits. Both are allowed (4 < 5) and both compute the SAME next slot,
  // so the SAME idempotency key -- the ledger's unique index then lets
  // only one actually credit (see lib/coinRewards.js doc comment). This
  // test pins that the two independent computations agree, which is the
  // property the cap's race-safety relies on.
  const countToday = 4;
  const cap = 5;
  assert.equal(isAdCapReached(countToday, cap), false);

  const date = new Date('2026-07-17T12:00:00.000Z');
  const nA = nextAdRewardIndex(countToday);
  const nB = nextAdRewardIndex(countToday);
  const keyA = buildAdRewardKey('user1', nA, date);
  const keyB = buildAdRewardKey('user1', nB, date);
  assert.equal(keyA, keyB);
});
