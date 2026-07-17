const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveReviewQuality } = require('../lib/srsReviewContract');
const { applyReview } = require('../lib/srsEngine');

// ---------------------------------------------------------------------------
// resolveReviewQuality — the H1 contract fix. The shipped app sends
// { correct: bool }; the endpoint used to 400 unless `quality` (0-5) was
// present, so no SRS review ever processed in production. Backend-first
// compat: quality passthrough when present, correct→quality mapping
// otherwise, 400 only when neither exists.
// ---------------------------------------------------------------------------

test('resolveReviewQuality: quality passthrough when present and valid', () => {
  assert.deepEqual(resolveReviewQuality({ quality: 0 }), { quality: 0 });
  assert.deepEqual(resolveReviewQuality({ quality: 3 }), { quality: 3 });
  assert.deepEqual(resolveReviewQuality({ quality: 5 }), { quality: 5 });
});

test('resolveReviewQuality: quality wins over correct when both present', () => {
  assert.deepEqual(resolveReviewQuality({ quality: 2, correct: true }), { quality: 2 });
});

test('resolveReviewQuality: correct:true maps to quality 4', () => {
  assert.deepEqual(resolveReviewQuality({ correct: true }), { quality: 4 });
});

test('resolveReviewQuality: correct:false maps to quality 1 (lapse: <3)', () => {
  assert.deepEqual(resolveReviewQuality({ correct: false }), { quality: 1 });
});

test('resolveReviewQuality: neither field → error (the only remaining 400)', () => {
  assert.ok(resolveReviewQuality({}).error);
  assert.ok(resolveReviewQuality({ responseTime: 900 }).error);
  assert.ok(resolveReviewQuality().error);
});

test('resolveReviewQuality: out-of-range or non-numeric quality → error', () => {
  assert.ok(resolveReviewQuality({ quality: -1 }).error);
  assert.ok(resolveReviewQuality({ quality: 6 }).error);
  assert.ok(resolveReviewQuality({ quality: 'high' }).error);
});

test('resolveReviewQuality: numeric-string quality is coerced (defensive)', () => {
  assert.deepEqual(resolveReviewQuality({ quality: '4' }), { quality: 4 });
});

// ---------------------------------------------------------------------------
// applyReview — pure SM-2 engine extracted from Vocabulary.processReview.
// ---------------------------------------------------------------------------

const freshWord = () => ({
  srsLevel: 0,
  interval: 0,
  easeFactor: 2.5,
  isMastered: false,
  masteredAt: null,
  reviewStats: {},
});

test('applyReview: correct review advances level and schedules future review', () => {
  const r = applyReview(freshWord(), 4);
  assert.equal(r.wasCorrect, true);
  assert.equal(r.srsLevel, 1);
  assert.equal(r.interval, 1);
  assert.ok(r.nextReview.getTime() > Date.now());
  assert.equal(r.reviewStats.totalReviews, 1);
  assert.equal(r.reviewStats.correctReviews, 1);
});

test('applyReview: quality < 3 is a lapse — resets to level 0, due today', () => {
  const word = { ...freshWord(), srsLevel: 4, interval: 14 };
  const r = applyReview(word, 1);
  assert.equal(r.wasCorrect, false);
  assert.equal(r.srsLevel, 0);
  assert.equal(r.interval, 0);
  assert.ok(r.nextReview.getTime() <= Date.now() + 1000);
  assert.equal(r.reviewStats.incorrectReviews, 1);
  assert.equal(r.reviewStats.currentStreak, 0);
});

test('applyReview: ease factor floors at 1.3', () => {
  const word = { ...freshWord(), easeFactor: 1.3 };
  const r = applyReview(word, 0);
  assert.equal(r.easeFactor, 1.3);
});

test('applyReview: justMastered fires exactly once, on the 8→9 transition', () => {
  // The original inline code checked !this.masteredAt AFTER setting
  // masteredAt, so justMastered was ALWAYS false. Regression-lock the fix.
  const word = { ...freshWord(), srsLevel: 8, interval: 240 };
  const r = applyReview(word, 5);
  assert.equal(r.srsLevel, 9);
  assert.equal(r.isMastered, true);
  assert.equal(r.justMastered, true);
  assert.ok(r.masteredAt instanceof Date);

  // Reviewing an already-mastered word again must NOT re-fire.
  const again = applyReview(
    { ...freshWord(), srsLevel: 9, isMastered: true, masteredAt: r.masteredAt },
    5
  );
  assert.equal(again.justMastered, false);
  assert.equal(again.isMastered, true);
  assert.equal(again.masteredAt, r.masteredAt); // original timestamp preserved
});

test('applyReview: justMastered false on ordinary advances', () => {
  assert.equal(applyReview(freshWord(), 5).justMastered, false);
  assert.equal(applyReview({ ...freshWord(), srsLevel: 5, interval: 30 }, 4).justMastered, false);
});

test('applyReview: does not mutate the input object', () => {
  const word = freshWord();
  applyReview(word, 4);
  assert.equal(word.srsLevel, 0);
  assert.equal(word.interval, 0);
  assert.equal(word.isMastered, false);
});
