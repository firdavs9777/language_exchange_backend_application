const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected. Backfilling quietHours + notificationCounters…');

    // Scoped updates so re-runs cannot clobber already-configured user values.
    const qhResult = await User.updateMany(
      { quietHours: { $exists: false } },
      {
        $set: {
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00',
            timezone: 'Asia/Seoul',
            allowUrgent: true,
          },
        },
      },
    );

    const counterResult = await User.updateMany(
      { notificationCounters: { $exists: false } },
      {
        $set: {
          notificationCounters: {
            daily: {},
            weekly: {},
            dailyResetAt: null,
            weeklyResetAt: null,
          },
        },
      },
    );

    console.log(
      `Updated ${qhResult.modifiedCount} users with quietHours, ` +
        `${counterResult.modifiedCount} users with notificationCounters.`,
    );
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
