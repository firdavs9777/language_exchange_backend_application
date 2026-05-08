/**
 * Wave Daily Summary Job
 *
 * Fires once per day at 9:00 AM UTC. For each user who has unread waves
 * in the last 24 hours (and has not already received a summary within the
 * last 23 hours), sends a single FCM push notification summarising the count.
 *
 * Scheduling: uses setInterval at a 1-hour tick, gated by UTC hour check —
 * consistent with the voiceRoomCleanupJob / dailyCounterResetJob patterns.
 */

const Wave = require('../models/Wave');
const User = require('../models/User');
const { shouldNotify } = require('../services/notificationService');
const fcmService = require('../services/fcmService');

const SUMMARY_HOUR_UTC = 9;
const SKIP_WINDOW_MS = 23 * 60 * 60 * 1000; // don't double-fire within 23h
const LOOKBACK_MS = 24 * 60 * 60 * 1000;    // look back 24h for unread waves
const TICK_MS = 60 * 60 * 1000;             // check every hour

let _intervalHandle = null;
let _running = false;

async function runOnce() {
  if (_running) return;
  _running = true;
  try {
    const now = new Date();
    if (now.getUTCHours() !== SUMMARY_HOUR_UTC) return;

    const since = new Date(Date.now() - LOOKBACK_MS);
    const skipBefore = new Date(Date.now() - SKIP_WINDOW_MS);

    // Aggregate unread waves per recipient in the last 24h
    const candidates = await Wave.aggregate([
      { $match: { isRead: false, createdAt: { $gte: since } } },
      { $group: { _id: '$to', count: { $sum: 1 } } },
    ]);

    let sent = 0;
    for (const { _id: userId, count } of candidates) {
      try {
        const user = await User.findById(userId).select(
          'notificationPreferences lastDailySummaryAt fcmTokens'
        );
        if (!user) continue;
        if (!shouldNotify(user, 'wave')) continue;
        if (user.lastDailySummaryAt && user.lastDailySummaryAt > skipBefore) continue;
        // fcmService.sendToUser checks active tokens internally; skip if none
        const hasActiveToken = Array.isArray(user.fcmTokens) &&
          user.fcmTokens.some(t => t.active);
        if (!hasActiveToken) continue;

        await fcmService.sendToUser(
          userId,
          {
            title: 'New waves waiting',
            body: count === 1
              ? '1 person waved at you'
              : `${count} people waved at you`,
          },
          {
            type: 'wave_daily_summary',
            route: '/community?tab=waves',
          }
        );

        await User.updateOne(
          { _id: userId },
          { lastDailySummaryAt: new Date() }
        );
        sent++;
      } catch (err) {
        console.error('[waveDailySummary] per-user error:', userId, err.message);
      }
    }

    if (sent > 0) {
      console.log(`[waveDailySummary] sent ${sent} summaries at UTC hour ${SUMMARY_HOUR_UTC}`);
    }
  } catch (err) {
    console.error('[waveDailySummary] runOnce error:', err);
  } finally {
    _running = false;
  }
}

function start() {
  if (_intervalHandle) return;
  _intervalHandle = setInterval(runOnce, TICK_MS);
  console.log(`[waveDailySummary] started — fires daily at UTC hour ${SUMMARY_HOUR_UTC}`);
}

function stop() {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}

module.exports = { start, stop, runOnce };

// CLI test trigger: node jobs/waveDailySummaryJob.js --run-once
if (require.main === module && process.argv.includes('--run-once')) {
  require('mongoose').connect(process.env.MONGO_URI).then(() => {
    return runOnce();
  }).then(() => {
    console.log('done');
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
