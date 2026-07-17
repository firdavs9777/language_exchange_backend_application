/**
 * Task 3 — persistent coinBonus pool honored at all three enforcement sites.
 *
 * Two layers (reviewer NEW-C1):
 *   1. Pure decision logic for the free-vs-pool-vs-deny bucket choice, tested
 *      on in-memory (unsaved) User docs via canTranslate()/canCreateMoment().
 *   2. Concurrency integration tests against a real Mongo (single-node
 *      replica set via mongodb-memory-server) proving the atomic free-then-
 *      pool consume can't double-spend the pool or be clobbered by a save():
 *      "free cap exhausted, coinBonus[key]=1, two concurrent consume calls →
 *      pool ends at exactly 0 and exactly ONE call is allowed". Plus:
 *      free-cap-available uses the free path (pool untouched), the pool
 *      persists across a daily reset, and the VIP fast-path is unchanged.
 *
 * Run: ~/.nvm/versions/node/v24.18.0/bin/node \
 *        --experimental-test-module-mocks --test test/coinBonus.enforcement.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const User = require('../models/User');

let replset;

test.before(async () => {
  replset = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replset.getUri(), { dbName: 'coinbonus_test' });
});

test.after(async () => {
  await mongoose.disconnect();
  await replset.stop();
});

const REGULAR_TRANSLATION_CAP = 5; // LIMITS.regular.translationsPerDay
const REGULAR_MOMENT_CAP = 10; // LIMITS.regular.momentsPerDay

function baseFields(overrides = {}) {
  return {
    name: 'Coin Bonus User',
    email: `coinbonus-${new mongoose.Types.ObjectId()}@example.com`,
    password: 'hashed-password-placeholder',
    birth_year: '2000',
    birth_month: '1',
    birth_day: '1',
    gender: 'other',
    native_language: 'English',
    language_to_learn: 'Spanish',
    userMode: 'regular',
    ...overrides,
  };
}

async function makeUser(overrides = {}) {
  return User.create(baseFields(overrides));
}

// ---------------------------------------------------------------------------
// 1. Pure decision logic (no DB writes) — the free/pool/deny bucket choice
// ---------------------------------------------------------------------------

test('decision: free cap available → allowed via free, pool untouched (translation)', () => {
  const u = new User(baseFields({
    regularUserLimitations: { translationsToday: 0, lastTranslationReset: new Date() },
    coinBonus: { translation: 0 },
  }));
  const r = u.canTranslate();
  assert.equal(r.allowed, true);
  assert.equal(r.remaining, REGULAR_TRANSLATION_CAP);
});

test('decision: free cap exhausted, no pool → denied (translation)', () => {
  const u = new User(baseFields({
    regularUserLimitations: {
      translationsToday: REGULAR_TRANSLATION_CAP,
      lastTranslationReset: new Date(),
    },
    coinBonus: {},
  }));
  const r = u.canTranslate();
  assert.equal(r.allowed, false);
  assert.equal(r.remaining, 0);
});

test('decision: free cap exhausted but pool > 0 → allowed via pool (translation)', () => {
  const u = new User(baseFields({
    regularUserLimitations: {
      translationsToday: REGULAR_TRANSLATION_CAP,
      lastTranslationReset: new Date(),
    },
    coinBonus: { translation: 2 },
  }));
  const r = u.canTranslate();
  assert.equal(r.allowed, true);
  assert.equal(r.remaining, 0);
  assert.equal(r.bonusRemaining, 2);
});

test('decision: moment free exhausted, no pool → denied; with pool → allowed', () => {
  const exhausted = new User(baseFields({
    regularUserLimitations: {
      momentsCreatedToday: REGULAR_MOMENT_CAP,
      lastMomentReset: new Date(),
    },
    coinBonus: {},
  }));
  assert.equal(exhausted.canCreateMoment(), false);

  const withPool = new User(baseFields({
    regularUserLimitations: {
      momentsCreatedToday: REGULAR_MOMENT_CAP,
      lastMomentReset: new Date(),
    },
    coinBonus: { moment: 1 },
  }));
  assert.equal(withPool.canCreateMoment(), true);
});

test('decision: VIP is always allowed and never consults the pool', () => {
  const u = new User(baseFields({ userMode: 'vip' }));
  assert.equal(u.canTranslate().allowed, true);
  assert.equal(u.canTranslate().remaining, -1);
  assert.equal(u.canCreateMoment(), true);
});

// ---------------------------------------------------------------------------
// 2a. Concurrency — TRANSLATION: no double-spend, no save()-overwrite
// ---------------------------------------------------------------------------

test('translation: free cap exhausted, pool=1, two concurrent consumes → exactly one allowed, pool ends at 0', async () => {
  const user = await makeUser({
    regularUserLimitations: {
      translationsToday: REGULAR_TRANSLATION_CAP,
      lastTranslationReset: new Date(),
    },
    coinBonus: { translation: 1 },
  });

  const [a, b] = await Promise.all([
    user.incrementTranslationCount(),
    user.incrementTranslationCount(),
  ]);

  const allowed = [a, b].filter((r) => r.allowed);
  const denied = [a, b].filter((r) => !r.allowed);
  assert.equal(allowed.length, 1, 'exactly one consume allowed');
  assert.equal(denied.length, 1, 'exactly one consume denied');
  assert.equal(allowed[0].via, 'pool');

  const fresh = await User.findById(user._id);
  assert.equal(fresh.coinBonus.get('translation'), 0, 'pool drained to exactly 0');
  // Free counter must NOT have been bumped past cap by the pool consume.
  assert.equal(fresh.regularUserLimitations.translationsToday, REGULAR_TRANSLATION_CAP);
});

test('translation: free cap available → consumes free, pool untouched', async () => {
  const user = await makeUser({
    regularUserLimitations: { translationsToday: 0, lastTranslationReset: new Date() },
    coinBonus: { translation: 2 },
  });

  const r = await user.incrementTranslationCount();
  assert.equal(r.allowed, true);
  assert.equal(r.via, 'free');

  const fresh = await User.findById(user._id);
  assert.equal(fresh.regularUserLimitations.translationsToday, 1);
  assert.equal(fresh.coinBonus.get('translation'), 2, 'pool untouched when free used');
});

test('translation: pool persists across a daily reset (reset does NOT zero the pool)', async () => {
  const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const user = await makeUser({
    regularUserLimitations: {
      translationsToday: REGULAR_TRANSLATION_CAP, // was exhausted yesterday
      lastTranslationReset: yesterday,
    },
    coinBonus: { translation: 3 },
  });

  const r = await user.incrementTranslationCount();
  assert.equal(r.allowed, true);
  assert.equal(r.via, 'free', 'new day → free counter reset, free path used');

  const fresh = await User.findById(user._id);
  assert.equal(fresh.regularUserLimitations.translationsToday, 1, 'counter reset to 1');
  assert.equal(fresh.coinBonus.get('translation'), 3, 'pool survived the daily reset');
});

test('translation: VIP fast-path unchanged — allowed, no counter/pool mutation', async () => {
  const user = await makeUser({
    userMode: 'vip',
    vipSubscription: { isActive: true, endDate: new Date(Date.now() + 1e9) },
    regularUserLimitations: { translationsToday: 0, lastTranslationReset: new Date() },
    coinBonus: { translation: 5 },
  });

  const r = await user.incrementTranslationCount();
  assert.equal(r.allowed, true);
  assert.equal(r.via, 'vip');

  const fresh = await User.findById(user._id);
  assert.equal(fresh.regularUserLimitations.translationsToday, 0, 'no free counter write for VIP');
  assert.equal(fresh.coinBonus.get('translation'), 5, 'pool untouched for VIP');
});

// ---------------------------------------------------------------------------
// 2b. Concurrency — MOMENT: no double-spend, no save()-overwrite
// ---------------------------------------------------------------------------

test('moment: free cap exhausted, pool=1, two concurrent consumes → exactly one allowed, pool ends at 0', async () => {
  const user = await makeUser({
    regularUserLimitations: {
      momentsCreatedToday: REGULAR_MOMENT_CAP,
      lastMomentReset: new Date(),
    },
    coinBonus: { moment: 1 },
  });

  const [a, b] = await Promise.all([
    user.incrementMomentCount(),
    user.incrementMomentCount(),
  ]);

  const allowed = [a, b].filter((r) => r.allowed);
  assert.equal(allowed.length, 1, 'exactly one consume allowed');
  assert.equal([a, b].filter((r) => !r.allowed).length, 1, 'exactly one denied');
  assert.equal(allowed[0].via, 'pool');

  const fresh = await User.findById(user._id);
  assert.equal(fresh.coinBonus.get('moment'), 0, 'pool drained to exactly 0');
  assert.equal(fresh.regularUserLimitations.momentsCreatedToday, REGULAR_MOMENT_CAP);
});

test('moment: free cap available → consumes free, pool untouched', async () => {
  const user = await makeUser({
    regularUserLimitations: { momentsCreatedToday: 0, lastMomentReset: new Date() },
    coinBonus: { moment: 4 },
  });

  const r = await user.incrementMomentCount();
  assert.equal(r.allowed, true);
  assert.equal(r.via, 'free');

  const fresh = await User.findById(user._id);
  assert.equal(fresh.regularUserLimitations.momentsCreatedToday, 1);
  assert.equal(fresh.coinBonus.get('moment'), 4, 'pool untouched when free used');
});

// ---------------------------------------------------------------------------
// 2c. Concurrency — TUTOR (consumeQuota): pool honored after free cap
// ---------------------------------------------------------------------------

test('tutor (consumeQuota): free cap exhausted, pool=1, two concurrent consumes → exactly one allowed, pool ends at 0', async () => {
  // Regular tutor cap is 5/chip. Exhaust the free counter for 'roleplay'.
  const user = await makeUser({
    regularUserLimitations: {
      roleplaySessionsToday: 5,
      lastRoleplaySessionReset: new Date(),
    },
    coinBonus: { roleplay: 1 },
  });

  const [a, b] = await Promise.all([
    User.consumeQuota(user._id, 'roleplay'),
    User.consumeQuota(user._id, 'roleplay'),
  ]);

  const allowed = [a, b].filter((r) => r.allowed);
  assert.equal(allowed.length, 1, 'exactly one consume allowed');
  assert.equal(allowed[0].via, 'pool');

  const fresh = await User.findById(user._id);
  assert.equal(fresh.coinBonus.get('roleplay'), 0, 'pool drained to exactly 0');
});

test('tutor (consumeQuota): free cap available → uses free, pool untouched', async () => {
  const user = await makeUser({
    regularUserLimitations: {
      roleplaySessionsToday: 0,
      lastRoleplaySessionReset: new Date(),
    },
    coinBonus: { roleplay: 2 },
  });

  const r = await User.consumeQuota(user._id, 'roleplay');
  assert.equal(r.allowed, true);
  assert.notEqual(r.via, 'pool');

  const fresh = await User.findById(user._id);
  assert.equal(fresh.regularUserLimitations.roleplaySessionsToday, 1);
  assert.equal(fresh.coinBonus.get('roleplay'), 2, 'pool untouched when free used');
});
