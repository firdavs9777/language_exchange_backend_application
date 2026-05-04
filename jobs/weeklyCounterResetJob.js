'use strict';
const User = require('../models/User');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function run() {
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
  const result = await User.updateMany(
    {
      $or: [
        { 'notificationCounters.weeklyResetAt': { $lt: cutoff } },
        { 'notificationCounters.weeklyResetAt': null },
        { 'notificationCounters.weeklyResetAt': { $exists: false } },
      ],
    },
    { $set: { 'notificationCounters.weekly': {}, 'notificationCounters.weeklyResetAt': new Date() } },
  );
  console.log(`[weeklyCounterResetJob] reset ${result.modifiedCount} users`);
}

module.exports = { run };
