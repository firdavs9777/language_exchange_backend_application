const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Backfilling quietHours + notificationCounters…');

  const result = await User.updateMany(
    { $or: [{ quietHours: { $exists: false } }, { notificationCounters: { $exists: false } }] },
    {
      $set: {
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'Asia/Seoul',
          allowUrgent: true,
        },
        notificationCounters: {
          daily: {},
          weekly: {},
          dailyResetAt: null,
          weeklyResetAt: null,
        },
      },
    },
    { strict: false },
  );

  console.log(`Updated ${result.modifiedCount} users.`);
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
