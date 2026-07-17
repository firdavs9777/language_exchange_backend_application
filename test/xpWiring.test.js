const { test } = require('node:test');
const assert = require('node:assert/strict');
const { xpForChip, TUTOR_CHIP_XP, DAILY_PRACTICE_CORRECT_BONUS } = require('../lib/tutorXp');

// ---------------------------------------------------------------------------
// xpForChip — H2 decision table. Session-end paths call
// learningTrackingService.awardXP(userId, xpForChip(...), reason) +
// updateStreak, all fire-and-forget.
// ---------------------------------------------------------------------------

test('xpForChip: every chip has a positive base value', () => {
  for (const chip of ['chat', 'roleplay', 'story', 'photo', 'pronunciation', 'daily_practice']) {
    assert.ok(TUTOR_CHIP_XP[chip] > 0, `${chip} must have base XP`);
  }
});

test('xpForChip: one-shot chips award their base unconditionally', () => {
  assert.equal(xpForChip('story'), TUTOR_CHIP_XP.story);
  assert.equal(xpForChip('photo'), TUTOR_CHIP_XP.photo);
  assert.equal(xpForChip('pronunciation'), TUTOR_CHIP_XP.pronunciation);
});

test('xpForChip: chat/roleplay require at least one user message', () => {
  assert.equal(xpForChip('chat', { userMessages: 0 }), 0);
  assert.equal(xpForChip('chat'), 0);
  assert.equal(xpForChip('chat', { userMessages: 1 }), TUTOR_CHIP_XP.chat);
  assert.equal(xpForChip('roleplay', { userMessages: 0 }), 0);
  assert.equal(xpForChip('roleplay', { userMessages: 5 }), TUTOR_CHIP_XP.roleplay);
});

test('xpForChip: daily practice adds correct-bonus when graded correct', () => {
  assert.equal(xpForChip('daily_practice', { isCorrect: false }), TUTOR_CHIP_XP.daily_practice);
  assert.equal(
    xpForChip('daily_practice', { isCorrect: true }),
    TUTOR_CHIP_XP.daily_practice + DAILY_PRACTICE_CORRECT_BONUS
  );
});

test('xpForChip: unknown chip awards nothing (defensive)', () => {
  assert.equal(xpForChip('unknown'), 0);
  assert.equal(xpForChip(undefined), 0);
  assert.equal(xpForChip(null), 0);
});
