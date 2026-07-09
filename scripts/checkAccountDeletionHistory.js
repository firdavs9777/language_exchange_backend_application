/**
 * Account Deletion History Checker
 *
 * Usage:
 *   node scripts/checkAccountDeletionHistory.js <email>
 *   node scripts/checkAccountDeletionHistory.js nozil@mail.ru
 *
 * Shows:
 *   - When account was deleted
 *   - Who deleted it (user vs admin)
 *   - Why it was deleted
 *   - What data was removed
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './config/config.env' });

const emailToCheck = process.argv[2];

if (!emailToCheck) {
  console.log('❌ Please provide an email address to check');
  console.log('Usage: node scripts/checkAccountDeletionHistory.js <email>');
  console.log('Example: node scripts/checkAccountDeletionHistory.js nozil@mail.ru');
  process.exit(1);
}

(async () => {
  try {
    console.log(`\n🔍 Checking deletion history for: ${emailToCheck}\n`);

    await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
    });

    const auditCol = mongoose.connection.db.collection('adminauditlogs');
    const securityCol = mongoose.connection.db.collection('securitylogs');
    const userCol = mongoose.connection.db.collection('users');

    // ============================================
    // 1. CHECK IF USER STILL EXISTS
    // ============================================
    const userExists = await userCol.findOne({ email: emailToCheck });

    console.log('📊 ACCOUNT STATUS:');
    if (userExists) {
      console.log(`  ✅ Account EXISTS (not deleted)`);
      console.log(`  Created: ${userExists.createdAt}`);
      console.log(`  Email Verified: ${userExists.isEmailVerified}`);
      console.log(`  Registration Complete: ${userExists.isRegistrationComplete}`);
    } else {
      console.log(`  ❌ Account DELETED (not found in Users collection)`);
    }

    // ============================================
    // 2. CHECK AUDIT LOG FOR DELETION RECORDS
    // ============================================
    console.log('\n📋 AUDIT LOG ENTRIES:\n');

    const auditLogs = await auditCol.find({
      $or: [
        { userEmail: emailToCheck },
        { email: emailToCheck },
        { targetEmail: emailToCheck },
        { 'details.email': emailToCheck }
      ]
    }).sort({ createdAt: -1, timestamp: -1 }).toArray();

    if (auditLogs.length === 0) {
      console.log('  No audit log entries found');
    } else {
      auditLogs.forEach((log, index) => {
        const timestamp = log.createdAt || log.timestamp || 'unknown';
        const action = log.action || log.actionType || 'unknown';

        console.log(`${index + 1}. [${action}]`);
        console.log(`   Timestamp: ${timestamp}`);
        console.log(`   Moderator: ${log.moderator || log.admin || 'N/A'}`);
        console.log(`   Target User: ${log.targetUser || 'N/A'}`);

        if (log.details) {
          console.log(`   Details:`);
          if (typeof log.details === 'string') {
            console.log(`     ${log.details}`);
          } else {
            Object.entries(log.details).forEach(([key, value]) => {
              const val = Array.isArray(value) ? value.join(', ') : value;
              console.log(`     ${key}: ${val}`);
            });
          }
        }

        console.log();
      });
    }

    // ============================================
    // 3. CHECK SECURITY LOG FOR LOGIN FAILURES
    // ============================================
    console.log('🔐 SECURITY LOG (Login Attempts on Missing Account):\n');

    const securityLogs = await securityCol.find({
      $or: [
        { email: emailToCheck },
        { 'details.email': emailToCheck },
        { 'details.reason': 'User not found' }
      ]
    }).sort({ createdAt: -1 }).limit(20).toArray();

    const notFoundLogs = securityLogs.filter(log =>
      log.details &&
      (typeof log.details === 'string' ? log.details.includes('User not found') :
       log.details.reason === 'User not found')
    );

    if (notFoundLogs.length === 0) {
      console.log('  No "User not found" errors logged');
    } else {
      console.log(`  Found ${notFoundLogs.length} "User not found" events:\n`);
      notFoundLogs.slice(0, 5).forEach((log, index) => {
        console.log(`${index + 1}. ${log.createdAt || log.timestamp}`);
        console.log(`   IP: ${log.ipAddress || log.ip || 'unknown'}`);
        console.log();
      });

      if (notFoundLogs.length > 5) {
        console.log(`  ... and ${notFoundLogs.length - 5} more events`);
      }
    }

    // ============================================
    // 4. SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('📈 SUMMARY:\n');

    const deletionLogs = auditLogs.filter(log =>
      log.action && (
        log.action.includes('DELETE') ||
        log.action.includes('delete') ||
        log.action.includes('HARD_DELETE')
      )
    );

    if (deletionLogs.length > 0) {
      console.log(`✅ DELETION FOUND:`);
      const latestDeletion = deletionLogs[0];
      console.log(`   When: ${latestDeletion.createdAt || latestDeletion.timestamp}`);
      console.log(`   Action: ${latestDeletion.action}`);
      console.log(`   By: ${latestDeletion.moderator === emailToCheck ? 'USER (self-deleted)' : 'ADMIN'}`);
      if (latestDeletion.details) {
        console.log(`   Reason: ${latestDeletion.details.reason || latestDeletion.details || 'not specified'}`);
      }
    } else if (notFoundLogs.length > 0) {
      console.log(`⚠️  ACCOUNT DELETED BUT NOT LOGGED`);
      console.log(`   First "User not found" error: ${notFoundLogs[notFoundLogs.length - 1].createdAt}`);
      console.log(`   Unknown deletion mechanism`);
    } else {
      console.log(`✅ ACCOUNT NOT DELETED (still active)`);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    await mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
