const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  decayWeakAreas,
  promptableWeakAreas,
  DECAY_WINDOW_DAYS,
  RESOLVE_SUCCESS_N,
} = require('../lib/tutorMemoryDecay');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-16T00:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY_MS);

// ---------------------------------------------------------------------------
// decayWeakAreas — H6 decay job core. Halve when unseen > 14d (idempotent
// per window via lastDecayedAt); resolve at 3 successful exercises;
// resolved areas are frozen forever.
// ---------------------------------------------------------------------------

test('decay: recent areas untouched', () => {
  const r = decayWeakAreas([{ topic: 'past tense', frequency: 4, lastSeen: daysAgo(3) }], NOW);
  assert.equal(r.changed, false);
  assert.equal(r.weakAreas[0].frequency, 4);
});

test('decay: frequency halves when lastSeen > 14 days', () => {
  const r = decayWeakAreas([{ topic: 'articles', frequency: 5, lastSeen: daysAgo(15) }], NOW);
  assert.equal(r.changed, true);
  assert.equal(r.decayed, 1);
  assert.equal(r.weakAreas[0].frequency, 2); // floor(5/2)
  assert.deepEqual(r.weakAreas[0].lastDecayedAt, NOW);
});

test('decay: idempotent — a second run in the same window is a no-op', () => {
  const first = decayWeakAreas([{ topic: 'articles', frequency: 5, lastSeen: daysAgo(20) }], NOW);
  const second = decayWeakAreas(first.weakAreas, new Date(NOW.getTime() + DAY_MS)); // next day
  assert.equal(second.changed, false);
  assert.equal(second.weakAreas[0].frequency, 2);
});

test('decay: halves again once a NEW full window passes since last decay', () => {
  const first = decayWeakAreas([{ topic: 'articles', frequency: 8, lastSeen: daysAgo(20) }], NOW);
  const later = new Date(NOW.getTime() + (DECAY_WINDOW_DAYS + 1) * DAY_MS);
  const second = decayWeakAreas(first.weakAreas, later);
  assert.equal(second.weakAreas[0].frequency, 2); // 8 → 4 → 2
});

test('decay: frequency floors at 0 and stays there', () => {
  const r1 = decayWeakAreas([{ topic: 'x', frequency: 1, lastSeen: daysAgo(15) }], NOW);
  assert.equal(r1.weakAreas[0].frequency, 0);
  const later = new Date(NOW.getTime() + (DECAY_WINDOW_DAYS + 1) * DAY_MS);
  const r2 = decayWeakAreas(r1.weakAreas, later);
  assert.equal(r2.changed, false); // 0-frequency areas skip decay
});

test('resolve: successCount >= N sets resolvedAt', () => {
  const r = decayWeakAreas(
    [{ topic: 'plurals', frequency: 3, lastSeen: daysAgo(1), successCount: RESOLVE_SUCCESS_N }],
    NOW
  );
  assert.equal(r.resolved, 1);
  assert.deepEqual(r.weakAreas[0].resolvedAt, NOW);
});

test('resolve: below N stays unresolved', () => {
  const r = decayWeakAreas(
    [{ topic: 'plurals', frequency: 3, lastSeen: daysAgo(1), successCount: RESOLVE_SUCCESS_N - 1 }],
    NOW
  );
  assert.equal(r.resolved, 0);
  assert.equal(r.weakAreas[0].resolvedAt, undefined);
});

test('resolved areas are frozen — never decayed, never resurrected', () => {
  const resolvedAt = daysAgo(30);
  const r = decayWeakAreas(
    [{ topic: 'done', frequency: 4, lastSeen: daysAgo(60), successCount: 5, resolvedAt }],
    NOW
  );
  assert.equal(r.changed, false);
  assert.equal(r.weakAreas[0].frequency, 4);
  assert.equal(r.weakAreas[0].resolvedAt, resolvedAt);
});

test('decayWeakAreas: does not mutate input, tolerates junk', () => {
  const input = [{ topic: 'a', frequency: 6, lastSeen: daysAgo(20) }];
  decayWeakAreas(input, NOW);
  assert.equal(input[0].frequency, 6);
  assert.deepEqual(decayWeakAreas(null, NOW).weakAreas, []);
  assert.equal(decayWeakAreas([null, {}], NOW).changed, false);
});

// ---------------------------------------------------------------------------
// promptableWeakAreas — what the prompt builder is allowed to see.
// ---------------------------------------------------------------------------

test('promptable: excludes resolved and zero-frequency areas', () => {
  const areas = [
    { topic: 'live', frequency: 3, lastSeen: daysAgo(1) },
    { topic: 'resolved', frequency: 5, lastSeen: daysAgo(1), resolvedAt: daysAgo(2) },
    { topic: 'decayed-out', frequency: 0, lastSeen: daysAgo(40) },
  ];
  const out = promptableWeakAreas(areas, 3);
  assert.deepEqual(out.map(w => w.topic), ['live']);
});

test('promptable: sorts by frequency desc and caps at limit', () => {
  const areas = [
    { topic: 'c', frequency: 1 },
    { topic: 'a', frequency: 9 },
    { topic: 'b', frequency: 4 },
    { topic: 'd', frequency: 2 },
  ];
  assert.deepEqual(promptableWeakAreas(areas, 2).map(w => w.topic), ['a', 'b']);
});
