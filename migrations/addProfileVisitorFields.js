/**
 * Migration Script: Add Profile Visitor & Follower Notification Fields
 * 
 * This script adds:
 * 1. profileStats fields to User model
 * 2. followerMoments notification setting
 * 
 * Run: npm run migrate:profile-visitors
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: './config/config.env' });

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const runMigration = async () => {
  try {
    console.log('\n🚀 Starting migration: Add Profile Visitor & Follower Notification Fields\n');
    console.log('='.repeat(80));

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Count users before migration
    const totalUsers = await usersCollection.countDocuments();
    console.log(`\n📊 Total users in database: ${totalUsers}`);

    // Show example user before update
    const exampleUserBefore = await usersCollection.findOne({});
    if (exampleUserBefore) {
      console.log('\n📋 Example user structure BEFORE migration:');
      console.log('  - Has profileStats:', !!exampleUserBefore.profileStats);
      console.log('  - Has followerMoments setting:', !!exampleUserBefore.notificationSettings?.followerMoments);
    }

    // Update users with new fields
    console.log('\n📝 Updating users...');

    const updateResult = await usersCollection.updateMany(
      {
        $or: [
          { profileStats: { $exists: false } },
          { 'notificationSettings.followerMoments': { $exists: false } }
        ]
      },
      {
        $set: {
          'profileStats.totalVisits': 0,
          'profileStats.uniqueVisitors': 0,
          'profileStats.lastVisitorUpdate': null,
          'notificationSettings.followerMoments': true
        }
      }
    );

    console.log(`✅ Successfully updated: ${updateResult.modifiedCount} users`);

    // Verification
    console.log('\n🔍 Verifying updates...');

    const usersWithProfileStats = await usersCollection.countDocuments({
      'profileStats': { $exists: true }
    });

    const usersWithFollowerMoments = await usersCollection.countDocuments({
      'notificationSettings.followerMoments': { $exists: true }
    });

    console.log('\n📊 Verification Results:');
    console.log(`  - Users with profileStats: ${usersWithProfileStats}/${totalUsers}`);
    console.log(`  - Users with followerMoments setting: ${usersWithFollowerMoments}/${totalUsers}`);

    // Show example user after update
    const exampleUserAfter = await usersCollection.findOne({});
    if (exampleUserAfter) {
      console.log('\n📋 Example user structure AFTER migration:');
      console.log('  profileStats:', JSON.stringify(exampleUserAfter.profileStats, null, 2));
      console.log('  followerMoments:', exampleUserAfter.notificationSettings?.followerMoments);
    }

    // Create indexes for ProfileVisit collection
    console.log('\n📑 Creating indexes for ProfileVisit collection...');

    const profileVisitsCollection = db.collection('profilevisits');
    
    await profileVisitsCollection.createIndex({ profileOwner: 1, visitedAt: -1 });
    await profileVisitsCollection.createIndex({ profileOwner: 1, visitor: 1, visitedAt: -1 });
    await profileVisitsCollection.createIndex({ visitor: 1, visitedAt: -1 });
    await profileVisitsCollection.createIndex({ visitedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

    console.log('✅ ProfileVisit indexes created');

    // Summary
    console.log('\n' + '='.repeat(80));

    if (usersWithProfileStats === totalUsers && usersWithFollowerMoments === totalUsers) {
      console.log('✅ Migration verified successfully!');
      console.log('🎉 All users have the new fields!');
    } else {
      console.log('⚠️ Some users may not have been updated properly');
      console.log(`Missing profileStats: ${totalUsers - usersWithProfileStats}`);
      console.log(`Missing followerMoments: ${totalUsers - usersWithFollowerMoments}`);
    }

    console.log('\n📝 Migration Summary:');
    console.log(`  - Total users: ${totalUsers}`);
    console.log(`  - Users updated: ${updateResult.modifiedCount}`);
    console.log(`  - Users with profileStats: ${usersWithProfileStats}`);
    console.log(`  - Users with followerMoments: ${usersWithFollowerMoments}`);
    console.log(`  - ProfileVisit indexes created: 4`);

    if (usersWithProfileStats === totalUsers && usersWithFollowerMoments === totalUsers) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️ Migration completed with warnings');
    }

    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Migration error:', error);
    throw error;
  }
};

// Run migration
(async () => {
  try {
    await connectDB();
    await runMigration();
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
})();

