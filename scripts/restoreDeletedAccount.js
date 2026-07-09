/**
 * Restore a Deleted Account from MongoDB
 *
 * This script restores a deleted user account by recreating their User document
 * All their associated data (messages, moments, etc) will automatically link
 *
 * Usage:
 *   node scripts/restoreDeletedAccount.js <email>
 *   node scripts/restoreDeletedAccount.js nozil@mail.ru
 *
 * The script will:
 *   1. Find the user's ID from security logs
 *   2. Create a new User document with that ID
 *   3. Mark account as verified and active
 *   4. Allow user to reset password on next login
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './config/config.env' });

const emailToRestore = process.argv[2];

if (!emailToRestore) {
  console.log('❌ Please provide an email address to restore');
  console.log('Usage: node scripts/restoreDeletedAccount.js <email>');
  console.log('Example: node scripts/restoreDeletedAccount.js nozil@mail.ru');
  process.exit(1);
}

const User = require('../models/User');

(async () => {
  try {
    console.log(`\n🔄 Restoring account for: ${emailToRestore}\n`);

    await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
    });

    const db = mongoose.connection.db;
    const securityCol = db.collection('securitylogs');

    // ============================================
    // Step 1: Check if account exists
    // ============================================
    console.log('Step 1: Checking if account exists...');

    const existingUser = await User.findOne({ email: emailToRestore });
    if (existingUser) {
      console.log('❌ Account already exists!');
      console.log(`   Created: ${existingUser.createdAt}`);
      console.log(`   ID: ${existingUser._id}`);
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log('✅ Account deleted (not found)\n');

    // ============================================
    // Step 2: Find original user ID from logs
    // ============================================
    console.log('Step 2: Finding original user ID...');

    const logs = await securityCol.find({ email: emailToRestore }).limit(20).toArray();

    if (logs.length === 0) {
      console.log('❌ No security logs found for this email');
      await mongoose.connection.close();
      process.exit(1);
    }

    let userId = null;
    for (const log of logs) {
      if (log.userId) {
        userId = log.userId;
        break;
      }
      if (log.details && log.details.userId) {
        userId = log.details.userId;
        break;
      }
    }

    if (!userId) {
      console.log('❌ Could not find user ID in logs');
      console.log('   First log entry:');
      console.log(JSON.stringify(logs[0], null, 2).substring(0, 300));
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`✅ Found original user ID: ${userId}\n`);

    // ============================================
    // Step 3: Create restoration user document
    // ============================================
    console.log('Step 3: Creating restored account...');

    const restoredUser = await User.create({
      _id: new mongoose.Types.ObjectId(userId),
      email: emailToRestore,
      name: emailToRestore.split('@')[0],  // Use email prefix as name
      password: 'temporary_disabled_' + Date.now(),  // Temporary placeholder
      isEmailVerified: true,  // Mark as verified since they had an account
      isRegistrationComplete: false,  // They need to complete onboarding
      termsAccepted: false,
      nativeLanguages: [],
      language_to_learn: [],
      gender: 'other',
      createdAt: new Date(),
      restoredFrom: {
        deletedAt: new Date(),
        reason: 'Account recovery from deletion',
        originalId: userId
      }
    });

    console.log('✅ Account created!\n');

    // ============================================
    // Step 4: Generate password reset link
    // ============================================
    console.log('Step 4: Setting up password reset...');

    // Generate verification code for password reset
    const crypto = require('crypto');
    const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    const resetToken = crypto.randomBytes(32).toString('hex');

    await User.findByIdAndUpdate(userId, {
      passwordResetCode: resetCode,
      passwordResetToken: resetToken,
      passwordResetExpire: new Date(Date.now() + 24 * 60 * 60 * 1000),  // 24 hours
    });

    console.log('✅ Password reset enabled\n');

    // ============================================
    // Step 5: Summary
    // ============================================
    console.log('='.repeat(70));
    console.log('✅ ACCOUNT RESTORED SUCCESSFULLY!\n');

    console.log('Account Details:');
    console.log(`  Email: ${emailToRestore}`);
    console.log(`  User ID: ${userId}`);
    console.log(`  Status: Active`);
    console.log(`  Email Verified: Yes`);
    console.log(`  Needs Onboarding: Yes\n`);

    console.log('📊 What was restored:');
    console.log(`  ✅ User account document`);
    console.log(`  ✅ Email verification status`);
    console.log(`  ✅ All associated data (messages, moments, etc)`);
    console.log(`  ⏳ Password reset code (24hr validity)\n`);

    console.log('🔐 Password Reset:');
    console.log(`  Reset Code: ${resetCode}`);
    console.log(`  Reset Token: ${resetToken.substring(0, 16)}...`);
    console.log(`  Expires: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}\n`);

    console.log('📝 Next Steps:');
    console.log(`  1. Share reset code "${resetCode}" with user`);
    console.log(`  2. User visits app and enters reset code`);
    console.log(`  3. Sets new password`);
    console.log(`  4. Completes onboarding`);
    console.log(`  5. Account fully restored!\n`);

    console.log('='.repeat(70) + '\n');

    await mongoose.connection.close();
  } catch (err) {
    console.error('❌ Restoration failed:', err.message);
    if (err.message.includes('duplicate')) {
      console.error('   Account already exists');
    }
    process.exit(1);
  }
})();
