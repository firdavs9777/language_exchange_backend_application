const test = require('node:test');
const assert = require('node:assert/strict');

const DAY_MS = 24 * 60 * 60 * 1000;

test('msUntil: target later today (10:00 -> 11:00) is ~1h, >0 and <=24h', () => {
  const { msUntil } = require('../services/emailScheduler');
  const now = new Date(2026, 6, 27, 10, 0, 0, 0); // local time, deterministic
  const ms = msUntil(11, 0, now);

  assert.ok(ms > 0);
  assert.ok(ms <= DAY_MS);
  assert.equal(ms, 60 * 60 * 1000); // exactly 1h
});

test('msUntil: target earlier today (10:00 -> 9:00) rolls to tomorrow, ~23h', () => {
  const { msUntil } = require('../services/emailScheduler');
  const now = new Date(2026, 6, 27, 10, 0, 0, 0);
  const ms = msUntil(9, 0, now);

  assert.ok(ms > 0);
  assert.ok(ms <= DAY_MS);
  assert.equal(ms, 23 * 60 * 60 * 1000); // exactly 23h
});

test('msUntil: target exactly now rolls forward a full day (still >0, <=24h)', () => {
  const { msUntil } = require('../services/emailScheduler');
  const now = new Date(2026, 6, 27, 10, 0, 0, 0);
  const ms = msUntil(10, 0, now);

  assert.ok(ms > 0);
  assert.ok(ms <= DAY_MS);
  assert.equal(ms, DAY_MS);
});

test('msUntil: is always positive and within 24h across several cases', () => {
  const { msUntil } = require('../services/emailScheduler');
  const cases = [
    [0, 0, new Date(2026, 6, 27, 23, 59, 0, 0)],
    [23, 59, new Date(2026, 6, 27, 0, 0, 0, 0)],
    [12, 30, new Date(2026, 6, 27, 12, 29, 0, 0)],
    [12, 30, new Date(2026, 6, 27, 12, 31, 0, 0)],
  ];
  for (const [hour, minute, now] of cases) {
    const ms = msUntil(hour, minute, now);
    assert.ok(ms > 0, `expected >0 for ${hour}:${minute} from ${now}`);
    assert.ok(ms <= DAY_MS, `expected <=24h for ${hour}:${minute} from ${now}`);
  }
});

test('startEmailScheduler(): inert (no throw, no pending timers) when email unconfigured', () => {
  delete process.env.FLAME_MAILGUN_API_KEY;
  delete process.env.FLAME_MAILGUN_DOMAIN;
  // Force a fresh require so isConfigured() re-reads current env.
  delete require.cache[require.resolve('../services/emailScheduler')];
  delete require.cache[require.resolve('../utils/sendEmail')];
  const { startEmailScheduler } = require('../services/emailScheduler');

  assert.doesNotThrow(() => startEmailScheduler());
  // No assertion needed beyond this: if startEmailScheduler scheduled a
  // setTimeout, node:test's process would hang open past this test file's
  // completion. Reaching here with the process able to exit cleanly is the
  // proof there's no pending timer.
});
