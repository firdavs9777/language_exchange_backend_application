/**
 * Diagnostic Script: User Counting Issues
 *
 * Run this script to diagnose why users might not be counted as "new today"
 *
 * Usage: node scripts/diagnose-user-counts.js
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};

const getTodayBoundaries = () => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  return { startOfDay, endOfDay, now };
};

const diagnose = async () => {
  try {
    await connectDB();

    const { startOfDay, endOfDay, now } = getTodayBoundaries();

    console.log('\n========================================');
    console.log('📊 USER COUNTING DIAGNOSTIC REPORT');
    console.log('========================================');
    console.log(`Server Time: ${now.toISOString()}`);
    console.log(`Server Timezone Offset: ${now.getTimezoneOffset()} minutes`);
    console.log(`Today's Start: ${startOfDay.toISOString()}`);
    console.log(`Today's End: ${endOfDay.toISOString()}`);

    // 1. Count new users today (as admin report does)
    const newUsersToday = await User.countDocuments({
      isRegistrationComplete: true,
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });
    console.log(`\n✅ New Users Today (isRegistrationComplete=true): ${newUsersToday}`);

    // 2. Count ALL users created today regardless of registration status
    const allCreatedToday = await User.countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });
    console.log(`📝 ALL Users Created Today (any status): ${allCreatedToday}`);

    // 3. Check for partial registrations (created but not complete)
    const partialRegistrations = await User.find({
      createdAt: { $gte: startOfDay, $lt: endOfDay },
      isRegistrationComplete: { $ne: true }
    }).select('email createdAt isRegistrationComplete isEmailVerified googleId appleId facebookId').lean();

    console.log(`\n⚠️ Partial Registrations Today (created but NOT complete): ${partialRegistrations.length}`);
    if (partialRegistrations.length > 0) {
      console.log('   Details:');
      partialRegistrations.forEach(u => {
        const authMethod = u.googleId ? 'Google' : u.appleId ? 'Apple' : u.facebookId ? 'Facebook' : 'Email';
        console.log(`   - ${u.email || 'no-email'} | Auth: ${authMethod} | Created: ${u.createdAt} | RegComplete: ${u.isRegistrationComplete} | EmailVerified: ${u.isEmailVerified}`);
      });
    }

    // 4. Check for users with Gmail that were LINKED (have googleId but old createdAt)
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const linkedGoogleUsersRecently = await User.find({
      googleId: { $exists: true, $ne: null },
      createdAt: { $lt: startOfDay }, // Created before today
      updatedAt: { $gte: last24Hours } // But updated recently
    }).select('email createdAt updatedAt isRegistrationComplete').lean();

    console.log(`\n🔗 Google Users LINKED (not new) in last 24h: ${linkedGoogleUsersRecently.length}`);
    if (linkedGoogleUsersRecently.length > 0) {
      console.log('   These users existed before but logged in via Google - NOT counted as new:');
      linkedGoogleUsersRecently.slice(0, 10).forEach(u => {
        console.log(`   - ${u.email} | Originally created: ${u.createdAt} | Updated: ${u.updatedAt}`);
      });
      if (linkedGoogleUsersRecently.length > 10) {
        console.log(`   ... and ${linkedGoogleUsersRecently.length - 10} more`);
      }
    }

    // 5. Check for partial email registrations (emails started but not completed)
    const pendingEmailRegistrations = await User.find({
      googleId: { $exists: false },
      appleId: { $exists: false },
      facebookId: { $exists: false },
      isRegistrationComplete: { $ne: true }
    }).select('email createdAt isEmailVerified').sort({ createdAt: -1 }).limit(20).lean();

    console.log(`\n📧 Pending Email Registrations (never completed): ${pendingEmailRegistrations.length > 20 ? '20+' : pendingEmailRegistrations.length}`);
    if (pendingEmailRegistrations.length > 0) {
      console.log('   These users started email registration but never completed:');
      pendingEmailRegistrations.forEach(u => {
        const isGmail = u.email?.includes('gmail.com');
        console.log(`   - ${u.email || 'no-email'} | Gmail: ${isGmail ? 'YES' : 'no'} | Created: ${u.createdAt} | EmailVerified: ${u.isEmailVerified}`);
      });
    }

    // 6. Check OAuth provider breakdown for today
    const oauthBreakdown = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lt: endOfDay },
          isRegistrationComplete: true
        }
      },
      {
        $group: {
          _id: {
            $cond: [{ $ne: ['$googleId', null] }, 'Google',
              { $cond: [{ $ne: ['$appleId', null] }, 'Apple',
                { $cond: [{ $ne: ['$facebookId', null] }, 'Facebook', 'Email'] }
              ] }
            ]
          },
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📱 New Users Today by Auth Method:');
    oauthBreakdown.forEach(item => {
      console.log(`   - ${item._id}: ${item.count}`);
    });
    if (oauthBreakdown.length === 0) {
      console.log('   (none)');
    }

    // 7. Check Gmail-specific stats
    const gmailUsersToday = await User.countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay },
      isRegistrationComplete: true,
      email: { $regex: /gmail\.com$/i }
    });
    console.log(`\n📬 Gmail Users Created Today (complete): ${gmailUsersToday}`);

    // 8. Check for any users with isRegistrationComplete=false but have googleId
    const incompleteGoogleUsers = await User.find({
      googleId: { $exists: true, $ne: null },
      isRegistrationComplete: { $ne: true }
    }).select('email createdAt isRegistrationComplete').lean();

    console.log(`\n🚨 Google OAuth Users with isRegistrationComplete != true: ${incompleteGoogleUsers.length}`);
    if (incompleteGoogleUsers.length > 0) {
      console.log('   THIS IS A BUG - Google OAuth should always set isRegistrationComplete=true:');
      incompleteGoogleUsers.slice(0, 10).forEach(u => {
        console.log(`   - ${u.email} | Created: ${u.createdAt} | isRegistrationComplete: ${u.isRegistrationComplete}`);
      });
    }

    console.log('\n========================================');
    console.log('END OF DIAGNOSTIC REPORT');
    console.log('========================================\n');

  } catch (error) {
    console.error('Diagnostic error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

diagnose();
