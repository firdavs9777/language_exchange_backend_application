const { isConfigured } = require('../utils/sendEmail');
const logger = require('../utils/logger');

// Flame email scheduler. Mirrors the setTimeout/getMillisecondsUntil pattern
// used by the BananaTalk `jobs/scheduler.js` (recursive setTimeout, reschedule
// on completion) but scoped down to flame's own email needs. NOT wired into
// server.js yet — startEmailScheduler() must be called explicitly by whatever
// boot path opts in later.

/**
 * Milliseconds until the next occurrence of `hour:minute` in local time.
 * Pure + deterministic: pass `now` explicitly for tests. Always returns a
 * value > 0 and <= 24h (86_400_000ms) — if that time already passed today,
 * rolls forward to tomorrow.
 */
function msUntil(hour, minute, now = new Date()) {
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

/**
 * Starts the flame email scheduler. Fully inert when Mailgun isn't
 * configured — returns immediately without scheduling any timers, so
 * calling this in tests/boot never leaves the process hanging on a
 * pending setTimeout.
 *
 * When configured, schedules a placeholder daily digest job (structure
 * only — no-op body for now) using the recursive-setTimeout pattern.
 */
function startEmailScheduler() {
  if (!isConfigured()) {
    logger.info('email not configured, scheduler inert');
    return;
  }

  const runDigestJob = () => {
    logger.info('email digest job tick (placeholder, no-op)');
    setTimeout(runDigestJob, 24 * 60 * 60 * 1000);
  };

  setTimeout(runDigestJob, msUntil(9, 0));
  logger.info('email scheduler started (daily digest at 9:00)');
}

module.exports = { msUntil, startEmailScheduler };
