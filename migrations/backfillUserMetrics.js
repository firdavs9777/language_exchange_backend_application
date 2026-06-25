/**
 * Migration: Backfill user metrics (lastLogin, lastActivityAt)
 * This script populates missing user activity data from loginHistory
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');

async function backfillUserMetrics() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
      maxPoolSize: 10,
    });

    console.log('✅ Connected to MongoDB');

    const db = conn.connection.db;

    // Get total user count
    const totalUsers = await db.collection('users').countDocuments();
    console.log(`📊 Total users: ${totalUsers}`);

    // Find users without lastLogin
    const usersWithoutLastLogin = await db.collection('users').countDocuments({
      lastLogin: { $exists: false }
    });
    console.log(`👤 Users without lastLogin: ${usersWithoutLastLogin}`);

    // Find users without lastActivityAt
    const usersWithoutLastActivity = await db.collection('users').countDocuments({
      lastActivityAt: { $exists: false }
    });
    console.log(`👤 Users without lastActivityAt: ${usersWithoutLastActivity}`);

    // Backfill lastLogin from loginHistory
    console.log('\n🔧 Backfilling lastLogin from loginHistory...');
    let updated = 0;

    const users = await db.collection('users')
      .find({})
      .project({ email: 1, loginHistory: 1, lastLogin: 1, lastActivityAt: 1, createdAt: 1 })
      .toArray();

    for (const user of users) {
      const updateData = {};
      let needsUpdate = false;

      // Get lastLogin from most recent successful login in history
      if (!user.lastLogin && user.loginHistory && user.loginHistory.length > 0) {
        const successfulLogins = user.loginHistory.filter(l => l.success === true);
        if (successfulLogins.length > 0) {
          const lastSuccessfulLogin = successfulLogins[successfulLogins.length - 1];
          updateData.lastLogin = lastSuccessfulLogin.loginAt;
          needsUpdate = true;
        }
      }

      // Get lastActivityAt - use the most recent of loginHistory, createdAt, or lastActivityAt
      if (!user.lastActivityAt || user.lastActivityAt < user.createdAt) {
        if (user.loginHistory && user.loginHistory.length > 0) {
          const mostRecentLogin = user.loginHistory[user.loginHistory.length - 1];
          updateData.lastActivityAt = mostRecentLogin.loginAt;
        } else {
          updateData.lastActivityAt = user.createdAt || new Date();
        }
        needsUpdate = true;
      }

      if (needsUpdate) {
        await db.collection('users').findOneAndUpdate(
          { _id: user._id },
          { $set: updateData }
        );
        updated++;
      }
    }

    console.log(`✅ Updated ${updated} users with lastLogin/lastActivityAt`);

    // Now check language fields
    console.log('\n🔧 Checking language fields...');
    const usersWithoutLanguages = await db.collection('users').countDocuments({
      $or: [
        { native_language: { $exists: false } },
        { native_language: '' },
        { language_to_learn: { $exists: false } },
        { language_to_learn: '' }
      ]
    });

    console.log(`👤 Users without proper language fields: ${usersWithoutLanguages}`);
    console.log('⚠️  These users need to complete their profile. They will be prompted on next login.');

    // Calculate DAU/MAU
    console.log('\n📈 Calculating engagement metrics...');
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dau = await db.collection('users').countDocuments({
      lastLogin: { $gte: sevenDaysAgo, $exists: true }
    });

    const mau = await db.collection('users').countDocuments({
      lastLogin: { $gte: thirtyDaysAgo, $exists: true }
    });

    console.log(`📊 Daily Active Users (7 days): ${dau} (${((dau / totalUsers) * 100).toFixed(1)}%)`);
    console.log(`📊 Monthly Active Users (30 days): ${mau} (${((mau / totalUsers) * 100).toFixed(1)}%)`);

    // Users who never logged in
    const neverLoggedIn = await db.collection('users').countDocuments({
      lastLogin: { $exists: false }
    });
    console.log(`👤 Users who never logged in: ${neverLoggedIn} (${((neverLoggedIn / totalUsers) * 100).toFixed(1)}%)`);

    console.log('\n✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Users without language fields should complete their profile');
    console.log('2. Run user_report.js again to verify metrics are now accurate');
    console.log('3. Monitor the /health endpoint for DAU/MAU metrics');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

backfillUserMetrics();
