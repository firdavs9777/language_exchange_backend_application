/**
 * Migration Script: Add Notification Fields to Existing Users
 * 
 * This script adds the new notification-related fields to all existing users
 * in the database with proper default values.
 * 
 * Run this script once after deploying the notification system:
 * node migrations/addNotificationFields.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const colors = require('colors');

// Load environment variables
dotenv.config({ path: './config/config.env' });

// Connect to database
const connectDb = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline.bold);
  } catch (error) {
    console.error(`Error: ${error.message}`.red.bold);
    process.exit(1);
  }
};

// Migration function using direct MongoDB operations
const migrateUsers = async () => {
  try {
    console.log('\n🔄 Starting migration...'.yellow.bold);
    
    const User = require('../models/User');
    
    // Use MongoDB native operations for more reliable updates
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Find users missing any of the new fields
    const usersToUpdate = await usersCollection.find({
      $or: [
        { fcmTokens: { $exists: false } },
        { notificationSettings: { $exists: false } },
        { badges: { $exists: false } }
      ]
    }).toArray();
    
    console.log(`\n📊 Found ${usersToUpdate.length} users to update`.cyan);
    
    if (usersToUpdate.length === 0) {
      console.log('\n✅ All users already have notification fields!'.green.bold);
      return;
    }
    
    let updated = 0;
    let failed = 0;
    
    // Show first user as example
    if (usersToUpdate.length > 0) {
      const firstUser = usersToUpdate[0];
      console.log('\n🔍 Example user to update:'.yellow);
      console.log(`   ID: ${firstUser._id}`.gray);
      console.log(`   Has fcmTokens: ${!!firstUser.fcmTokens}`.gray);
      console.log(`   Has notificationSettings: ${!!firstUser.notificationSettings}`.gray);
      console.log(`   Has badges: ${!!firstUser.badges}`.gray);
    }
    
    // Process each user
    for (const user of usersToUpdate) {
      try {
        const updateOps = {};
        
        // Check and set missing fields
        if (!user.fcmTokens) {
          updateOps.fcmTokens = [];
        }
        
        if (!user.notificationSettings) {
          updateOps.notificationSettings = {
            enabled: true,
            chatMessages: true,
            moments: true,
            friendRequests: true,
            profileVisits: true,
            marketing: false,
            sound: true,
            vibration: true,
            showPreview: true,
            mutedChats: []
          };
        }
        
        if (!user.badges) {
          updateOps.badges = {
            unreadMessages: 0,
            unreadNotifications: 0
          };
        }
        
        // Perform the update
        if (Object.keys(updateOps).length > 0) {
          const result = await usersCollection.updateOne(
            { _id: user._id },
            { $set: updateOps }
          );
          
          if (result.modifiedCount > 0) {
            updated++;
            
            if (updated % 100 === 0) {
              console.log(`   ⏳ Updated ${updated}/${usersToUpdate.length} users...`.gray);
            }
          } else {
            console.log(`   ⚠️  User ${user._id} update returned 0 modified count`.yellow);
          }
        }
      } catch (error) {
        console.error(`   ❌ Failed to update user ${user._id}: ${error.message}`.red);
        console.error(`      Stack: ${error.stack}`.red);
        failed++;
      }
    }
    
    console.log('\n📈 Migration Summary:'.cyan.bold);
    console.log(`   ✅ Successfully updated: ${updated}`.green);
    if (failed > 0) {
      console.log(`   ❌ Failed: ${failed}`.red);
    }
    console.log(`   📊 Total processed: ${usersToUpdate.length}`.cyan);
    
  } catch (error) {
    console.error(`\n❌ Migration failed: ${error.message}`.red.bold);
    console.error(`   Stack: ${error.stack}`.red);
    throw error;
  }
};

// Create indexes
const createIndexes = async () => {
  try {
    console.log('\n🔍 Creating indexes...'.yellow.bold);
    
    const User = require('../models/User');
    
    // Create indexes for FCM tokens
    await User.collection.createIndex({ 'fcmTokens.token': 1 });
    await User.collection.createIndex({ 'fcmTokens.deviceId': 1 });
    
    console.log('   ✅ User model indexes created'.green);
    
    // Create indexes for Notification model
    const Notification = require('../models/Notification');
    
    await Notification.collection.createIndex({ userId: 1, sentAt: -1 });
    await Notification.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    
    console.log('   ✅ Notification model indexes created'.green);
    
  } catch (error) {
    console.error(`   ❌ Index creation failed: ${error.message}`.red);
    // Don't throw - indexes might already exist
  }
};

// Verify migration
const verifyMigration = async () => {
  try {
    console.log('\n🔎 Verifying migration...'.yellow.bold);
    
    const User = require('../models/User');
    
    // Get fresh count after updates
    const totalUsers = await User.countDocuments();
    
    // Check for existence of the fields using $type operator
    const usersWithFcmTokens = await User.countDocuments({ 
      fcmTokens: { $exists: true, $type: 'array' } 
    });
    const usersWithSettings = await User.countDocuments({ 
      notificationSettings: { $exists: true, $type: 'object' } 
    });
    const usersWithBadges = await User.countDocuments({ 
      badges: { $exists: true, $type: 'object' } 
    });
    
    // Also check for properly structured fields
    const usersWithProperSettings = await User.countDocuments({
      'notificationSettings.enabled': { $exists: true }
    });
    const usersWithProperBadges = await User.countDocuments({
      'badges.unreadMessages': { $exists: true }
    });
    
    console.log(`   📊 Total users: ${totalUsers}`.cyan);
    console.log(`   ✅ Users with fcmTokens array: ${usersWithFcmTokens}`.green);
    console.log(`   ✅ Users with notificationSettings: ${usersWithSettings}`.green);
    console.log(`   ✅ Users with proper settings structure: ${usersWithProperSettings}`.green);
    console.log(`   ✅ Users with badges: ${usersWithBadges}`.green);
    console.log(`   ✅ Users with proper badge structure: ${usersWithProperBadges}`.green);
    
    // Sample a user to show the structure
    const sampleUser = await User.findOne().select('fcmTokens notificationSettings badges name email').lean();
    if (sampleUser) {
      console.log('\n📋 Sample user structure:'.cyan);
      console.log(`   User: ${sampleUser.name} (${sampleUser.email})`.gray);
      console.log(`   fcmTokens: ${JSON.stringify(sampleUser.fcmTokens || 'missing')}`.gray);
      if (sampleUser.notificationSettings) {
        console.log(`   notificationSettings: ${JSON.stringify(sampleUser.notificationSettings)}`.gray);
      } else {
        console.log(`   notificationSettings: missing`.gray);
      }
      if (sampleUser.badges) {
        console.log(`   badges: ${JSON.stringify(sampleUser.badges)}`.gray);
      } else {
        console.log(`   badges: missing`.gray);
      }
    }
    
    if (usersWithFcmTokens === totalUsers && 
        usersWithSettings === totalUsers && 
        usersWithBadges === totalUsers) {
      console.log('\n✅ Migration verified successfully!'.green.bold);
      return true;
    } else {
      console.log('\n⚠️  Some users may not have been updated properly'.yellow.bold);
      console.log(`   Expected: ${totalUsers}, Got: fcmTokens=${usersWithFcmTokens}, settings=${usersWithSettings}, badges=${usersWithBadges}`.yellow);
      return false;
    }
  } catch (error) {
    console.error(`\n❌ Verification failed: ${error.message}`.red.bold);
    return false;
  }
};

// Main execution
const runMigration = async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════╗'.cyan.bold);
    console.log('║  Push Notification Fields Migration Script    ║'.cyan.bold);
    console.log('╚════════════════════════════════════════════════╝'.cyan.bold);
    
    // Connect to database
    await connectDb();
    
    // Run migration
    await migrateUsers();
    
    // Create indexes
    await createIndexes();
    
    // Verify migration
    const verified = await verifyMigration();
    
    if (verified) {
      console.log('\n🎉 Migration completed successfully!'.green.bold);
    } else {
      console.log('\n⚠️  Migration completed with warnings'.yellow.bold);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`\n💥 Migration failed: ${error.message}`.red.bold);
    process.exit(1);
  }
};

// Run the migration
runMigration();

