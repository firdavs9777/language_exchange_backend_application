const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  excludeReels,
  buildReelsQuery,
  partitionByLanguage,
  deriveNextCursor,
  getReelsEnabled,
  reelsEnabledGuard,
  resolveIsReel
} = require('../lib/reelsFeed');

// ---------------------------------------------------------------------------
// Task 1 — excludeReels: the pure helper that stamps the FIVE discovery
// feeds (getMoments default/forYou/following, exploreMoments,
// getTrendingMoments) so reels never surface there.
// ---------------------------------------------------------------------------

test('excludeReels: stamps isReel:{$ne:true} onto a flat query', () => {
  const input = { privacy: 'public', isDeleted: { $ne: true } };
  const result = excludeReels(input);
  assert.deepEqual(result, {
    privacy: 'public',
    isDeleted: { $ne: true },
    isReel: { $ne: true }
  });
});

test('excludeReels: does not mutate the input object', () => {
  const input = { privacy: 'public' };
  const result = excludeReels(input);
  assert.equal(input.isReel, undefined);
  assert.notEqual(result, input);
});

test('excludeReels: defaults to {} when called with no argument', () => {
  const result = excludeReels();
  assert.deepEqual(result, { isReel: { $ne: true } });
});

test('excludeReels: preserves other keys already on the query (e.g. user $in for following feed)', () => {
  const input = { user: { $in: ['u1', 'u2'] }, privacy: 'public', isDeleted: { $ne: true } };
  const result = excludeReels(input);
  assert.deepEqual(result.user, { $in: ['u1', 'u2'] });
  assert.deepEqual(result.isReel, { $ne: true });
});

// ---------------------------------------------------------------------------
// Moment schema — isReel / hiddenPendingReview fields + defaults
// (schema.paths inspection, mirrors test/normalizeLocale.test.js's pattern
// of asserting against the on-disk source of truth).
// ---------------------------------------------------------------------------

test('Moment schema: isReel field exists, Boolean, defaults to false', () => {
  const Moment = require('../models/Moment');
  const path = Moment.schema.paths.isReel;
  assert.ok(path, 'isReel path should exist on the Moment schema');
  assert.equal(path.instance, 'Boolean');
  assert.equal(path.defaultValue, false);
});

test('Moment schema: hiddenPendingReview field exists, Boolean, defaults to false', () => {
  const Moment = require('../models/Moment');
  const path = Moment.schema.paths.hiddenPendingReview;
  assert.ok(path, 'hiddenPendingReview path should exist on the Moment schema');
  assert.equal(path.instance, 'Boolean');
  assert.equal(path.defaultValue, false);
});

test('Moment schema: {isReel, privacy, createdAt} compound index exists', () => {
  const Moment = require('../models/Moment');
  const indexes = Moment.schema.indexes().map(([fields]) => fields);
  const hasReelsIndex = indexes.some(fields =>
    fields.isReel === 1 && fields.privacy === 1 && fields.createdAt === -1
  );
  assert.ok(hasReelsIndex, 'expected an {isReel:1, privacy:1, createdAt:-1} index');
});

// ---------------------------------------------------------------------------
// User schema — reelsPolicyAccepted field + default
// ---------------------------------------------------------------------------

test('User schema: reelsPolicyAccepted field exists, Boolean, defaults to false', () => {
  const User = require('../models/User');
  const path = User.schema.paths.reelsPolicyAccepted;
  assert.ok(path, 'reelsPolicyAccepted path should exist on the User schema');
  assert.equal(path.instance, 'Boolean');
  assert.equal(path.defaultValue, false);
});

// ---------------------------------------------------------------------------
// Task 2 — buildReelsQuery: the exact filter for GET /moments/reels
// ---------------------------------------------------------------------------

test('buildReelsQuery: base filter (no cursor, no blocked ids)', () => {
  const query = buildReelsQuery({});
  assert.deepEqual(query, {
    isReel: true,
    privacy: 'public',
    hiddenPendingReview: { $ne: true },
    isDeleted: { $ne: true }
  });
});

test('buildReelsQuery: adds createdAt cursor when `before` is given', () => {
  const before = '2026-07-10T00:00:00.000Z';
  const query = buildReelsQuery({ before });
  assert.deepEqual(query.createdAt, { $lt: new Date(before) });
});

test('buildReelsQuery: omits createdAt when `before` is absent/null', () => {
  const query = buildReelsQuery({ before: null });
  assert.equal(query.createdAt, undefined);
});

test('buildReelsQuery: ignores an unparseable `before` value rather than injecting Invalid Date', () => {
  const query = buildReelsQuery({ before: 'not-a-date' });
  assert.equal(query.createdAt, undefined);
});

test('buildReelsQuery: adds blocked-user $nin only when blockedIds is non-empty', () => {
  const withBlocked = buildReelsQuery({ blockedIds: ['u1', 'u2'] });
  assert.deepEqual(withBlocked.user, { $nin: ['u1', 'u2'] });

  const withoutBlocked = buildReelsQuery({ blockedIds: [] });
  assert.equal(withoutBlocked.user, undefined);
});

// ---------------------------------------------------------------------------
// Task 2 — partitionByLanguage: two-bucket soft language ranking
// ---------------------------------------------------------------------------

test('partitionByLanguage: bucket A (relevant language) comes before bucket B, each preserving recency order', () => {
  // Raw window already sorted createdAt desc (newest first).
  const reels = [
    { id: 'r1', language: 'fr', createdAt: 10 }, // B
    { id: 'r2', language: 'ko', createdAt: 9 },  // A
    { id: 'r3', language: 'de', createdAt: 8 },  // B
    { id: 'r4', language: 'ko', createdAt: 7 },  // A
  ];
  const result = partitionByLanguage(reels, ['ko', 'en']);
  assert.deepEqual(result.map(r => r.id), ['r2', 'r4', 'r1', 'r3']);
});

test('partitionByLanguage: empty relevantLanguages puts everything in bucket B (plain recency order preserved)', () => {
  const reels = [
    { id: 'r1', language: 'fr', createdAt: 10 },
    { id: 'r2', language: 'ko', createdAt: 9 },
  ];
  const result = partitionByLanguage(reels, []);
  assert.deepEqual(result.map(r => r.id), ['r1', 'r2']);
});

test('partitionByLanguage: is a soft boost, not a hard filter — bucket B items are still present', () => {
  const reels = [
    { id: 'r1', language: 'fr', createdAt: 10 },
    { id: 'r2', language: 'de', createdAt: 9 },
  ];
  const result = partitionByLanguage(reels, ['ko']);
  assert.equal(result.length, 2);
});

// ---------------------------------------------------------------------------
// Task 2 — deriveNextCursor: MUST use the raw pre-partition window, not the
// reordered/concatenated one (plan-review I2 — the dup/skip regression).
// ---------------------------------------------------------------------------

test('deriveNextCursor: equals the min createdAt of the RAW window (not the reordered tail)', () => {
  // Same raw window as the partition test above: after partitionByLanguage
  // with relevant=['ko'], the concatenated order is [r2(9), r4(7), r1(10), r3(8)]
  // whose tail is r3 with createdAt=8 — but the true minimum of the RAW
  // window is r4 at createdAt=7. Using the reordered tail (8) as the cursor
  // would refetch r4 (createdAt=7 < 8) on the next page — a duplicate.
  const rawWindow = [
    { id: 'r1', language: 'fr', createdAt: 10 },
    { id: 'r2', language: 'ko', createdAt: 9 },
    { id: 'r3', language: 'de', createdAt: 8 },
    { id: 'r4', language: 'ko', createdAt: 7 },
  ];
  const cursor = deriveNextCursor(rawWindow, 4);
  assert.equal(cursor, new Date(7).toISOString());
  assert.notEqual(cursor, new Date(8).toISOString());
});

test('deriveNextCursor: returns null for an empty window', () => {
  assert.equal(deriveNextCursor([], 10), null);
});

test('deriveNextCursor: returns null when the window is shorter than the requested limit (no next page)', () => {
  const rawWindow = [
    { createdAt: 10 },
    { createdAt: 9 }
  ];
  assert.equal(deriveNextCursor(rawWindow, 10), null);
});

test('deriveNextCursor: returns a cursor when the window is exactly full (more pages may exist)', () => {
  const rawWindow = [
    { createdAt: 10 },
    { createdAt: 9 }
  ];
  assert.equal(deriveNextCursor(rawWindow, 2), new Date(9).toISOString());
});

// ---------------------------------------------------------------------------
// Task 2 — REELS_ENABLED kill switch (mirrors ROOMS_ENABLED's test pattern
// in test/rooms.controller.test.js)
// ---------------------------------------------------------------------------

async function withReelsEnabledEnv(value, fn) {
  const original = process.env.REELS_ENABLED;
  try {
    if (value === undefined) delete process.env.REELS_ENABLED;
    else process.env.REELS_ENABLED = value;
    delete require.cache[require.resolve('../config/limitations')];
    return await fn();
  } finally {
    if (original === undefined) delete process.env.REELS_ENABLED;
    else process.env.REELS_ENABLED = original;
    delete require.cache[require.resolve('../config/limitations')];
  }
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  return res;
}

test('config/limitations.js: REELS_ENABLED defaults to true when unset', async () => {
  await withReelsEnabledEnv(undefined, () => {
    const { REELS_ENABLED } = require('../config/limitations');
    assert.equal(REELS_ENABLED, true);
  });
});

test('config/limitations.js: REELS_ENABLED is false when process.env.REELS_ENABLED=false', async () => {
  await withReelsEnabledEnv('false', () => {
    const { REELS_ENABLED } = require('../config/limitations');
    assert.equal(REELS_ENABLED, false);
  });
});

test('getReelsEnabled: reads config/limitations.js REELS_ENABLED live (default-true)', async () => {
  await withReelsEnabledEnv(undefined, () => {
    delete require.cache[require.resolve('../lib/reelsFeed')];
    const { getReelsEnabled } = require('../lib/reelsFeed');
    assert.equal(getReelsEnabled(), true);
  });
});

test('reelsEnabledGuard: calls next() when REELS_ENABLED is true', async () => {
  await withReelsEnabledEnv('true', () => {
    delete require.cache[require.resolve('../lib/reelsFeed')];
    const { reelsEnabledGuard: guard } = require('../lib/reelsFeed');
    const res = mockRes();
    let nextCalled = false;
    guard({}, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
  });
});

test('reelsEnabledGuard: short-circuits to 404 when REELS_ENABLED is false', async () => {
  await withReelsEnabledEnv('false', () => {
    delete require.cache[require.resolve('../lib/reelsFeed')];
    const { reelsEnabledGuard: guard } = require('../lib/reelsFeed');
    const res = mockRes();
    let nextCalled = false;
    guard({}, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
  });
});

// ---------------------------------------------------------------------------
// Task 2 — appConfig.reelsEnabled (mirrors roomsEnabled's test pattern)
// ---------------------------------------------------------------------------

test('appConfig: reelsEnabled reflects true when REELS_ENABLED is on', async () => {
  await withReelsEnabledEnv('true', async () => {
    delete require.cache[require.resolve('../controllers/appConfig')];
    const { getAppConfig } = require('../controllers/appConfig');
    const res = mockRes();
    await getAppConfig({ query: {} }, res, () => {});
    assert.equal(res.body.data.reelsEnabled, true);
  });
});

test('appConfig: reelsEnabled reflects false when REELS_ENABLED is off (kill switch)', async () => {
  await withReelsEnabledEnv('false', async () => {
    delete require.cache[require.resolve('../controllers/appConfig')];
    const { getAppConfig } = require('../controllers/appConfig');
    const res = mockRes();
    await getAppConfig({ query: {} }, res, () => {});
    assert.equal(res.body.data.reelsEnabled, false);
  });
});

// ---------------------------------------------------------------------------
// Task 2 (cross-track fix) — resolveIsReel: createMoment's pass-through
// decision for the reels create flow. Strict boolean — a truthy string
// ('false', '0', 'no') from a misbehaving client must NOT flip this on/off.
// ---------------------------------------------------------------------------

test('resolveIsReel: true only for the literal boolean true', () => {
  assert.equal(resolveIsReel(true), true);
});

test('resolveIsReel: false for undefined (field absent — the default, regular-moment path)', () => {
  assert.equal(resolveIsReel(undefined), false);
});

test('resolveIsReel: false for the literal boolean false', () => {
  assert.equal(resolveIsReel(false), false);
});

test('resolveIsReel: false for truthy strings — never trust a stringly-typed boolean', () => {
  assert.equal(resolveIsReel('true'), false);
  assert.equal(resolveIsReel('false'), false);
  assert.equal(resolveIsReel('1'), false);
});

test('resolveIsReel: false for other truthy values (1, {}, [])', () => {
  assert.equal(resolveIsReel(1), false);
  assert.equal(resolveIsReel({}), false);
  assert.equal(resolveIsReel([]), false);
});
