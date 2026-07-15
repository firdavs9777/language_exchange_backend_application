const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isReelOverCap } = require('../lib/reelsFeed');

// ---------------------------------------------------------------------------
// isReelOverCap — pure decision for the reel-specific 180s cap, enforced in
// momentVideoUpload (controllers/moments.js), NOT the upload middleware
// (which only knows the global 600s cap and has no `isReel` context).
// ---------------------------------------------------------------------------

test('isReelOverCap: true when the moment is a reel and duration exceeds 180s', () => {
  assert.equal(isReelOverCap({ isReel: true }, 181), true);
  assert.equal(isReelOverCap({ isReel: true }, 600), true);
});

test('isReelOverCap: false when the moment is a reel but duration is exactly 180s (inclusive cap)', () => {
  assert.equal(isReelOverCap({ isReel: true }, 180), false);
});

test('isReelOverCap: false when the moment is a reel and duration is under 180s', () => {
  assert.equal(isReelOverCap({ isReel: true }, 30), false);
});

test('isReelOverCap: false for a non-reel moment even if duration exceeds 180s (the 600s global cap applies instead, enforced elsewhere)', () => {
  assert.equal(isReelOverCap({ isReel: false }, 400), false);
  assert.equal(isReelOverCap({}, 400), false);
});

test('isReelOverCap: false for missing/non-numeric duration (defensive — middleware always provides one)', () => {
  assert.equal(isReelOverCap({ isReel: true }, undefined), false);
  assert.equal(isReelOverCap({ isReel: true }, NaN), false);
  assert.equal(isReelOverCap({ isReel: true }, '200'), false);
});

test('isReelOverCap: false when moment is null/undefined (defensive)', () => {
  assert.equal(isReelOverCap(null, 400), false);
  assert.equal(isReelOverCap(undefined, 400), false);
});
