const { test } = require('node:test');
const assert = require('node:assert/strict');
const { excludeReels } = require('../lib/reelsFeed');

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
