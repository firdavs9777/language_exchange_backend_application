'use strict';
const User = require('../models/User');

/**
 * Reset notificationCounters.daily for users whose local time crossed midnight
 * since their last reset. Run hourly; small per-user check keeps load low.
 */
async function run() {
  const users = await User.find(
    { 'quietHours.timezone': { $exists: true } },
    { _id: 1, 'quietHours.timezone': 1, 'notificationCounters.dailyResetAt': 1 },
  );

  const now = new Date();
  let resetCount = 0;

  for (const u of users) {
    const tz = (u.quietHours && u.quietHours.timezone) || 'Asia/Seoul';
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // 'YYYY-MM-DD'
    const lastReset = u.notificationCounters && u.notificationCounters.dailyResetAt;
    const lastDate = lastReset
      ? new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(lastReset)
      : null;

    if (lastDate !== localDate) {
      await User.updateOne(
        { _id: u._id },
        { $set: { 'notificationCounters.daily': {}, 'notificationCounters.dailyResetAt': now } },
      );
      resetCount += 1;
    }
  }

  console.log(`[dailyCounterResetJob] reset ${resetCount} users`);
}

module.exports = { run };
