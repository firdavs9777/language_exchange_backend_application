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

    // `targetEmail` is the canonical field; the others are legacy shapes kept
    // so historical rows still turn up. If the user record still exists we
    // also match on its _id, since older entries carry no email at all.
    const auditOr = [
      { targetEmail: emailToCheck },
      { userEmail: emailToCheck },
      { email: emailToCheck },
      { 'details.email': emailToCheck }
    ];
    if (userExists) {
      auditOr.push({ target: userExists._id }, { targetUser: userExists._id }, { moderator: userExists._id });
    }
    const auditLogs = await auditCol.find({ $or: auditOr })
      .sort({ timestamp: -1 }).toArray();

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

    // NB: this collection stamps `timestamp`, not `createdAt` — sorting by
    // createdAt silently ordered by a field that is null on every document.
    // The old query also had a bare { 'details.reason': 'User not found' }
    // clause with no email filter, so it pulled in other users' failures and
    // reported them as this account's history.
    const securityLogs = await securityCol.find({
      $or: [
        { email: emailToCheck },
        { 'details.email': emailToCheck }
      ]
    }).sort({ timestamp: -1 }).limit(200).toArray();

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
        console.log(`${index + 1}. ${log.timestamp || log.createdAt}`);
        console.log(`   IP: ${(log.details && log.details.ipAddress) || log.ipAddress || log.ip || 'unknown'}`);
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

    // Distinct user ids this email has logged in under. More than one means
    // the account was destroyed and re-created at least that many times.
    const incarnations = [...new Set(
      securityLogs.map(l => l.details && l.details.userId).filter(Boolean).map(String)
    )];

    if (deletionLogs.length > 0) {
      console.log(`✅ DELETION FOUND:`);
      const latestDeletion = deletionLogs[0];
      console.log(`   When: ${latestDeletion.timestamp || latestDeletion.createdAt}`);
      console.log(`   Action: ${latestDeletion.action}`);
      console.log(`   By moderator id: ${latestDeletion.moderator || 'n/a'}`);
      console.log(`   Target: ${latestDeletion.target || latestDeletion.targetUser || 'n/a'}`);
      console.log(`   Self-deleted: ${String(latestDeletion.moderator) === String(latestDeletion.target)}`);
      if (latestDeletion.reason) console.log(`   Reason: ${latestDeletion.reason}`);
    }

    // The account's CURRENT state is what decides this — the old code jumped
    // straight to "deleted" off unrelated login failures and reported an
    // account that plainly exists as gone.
    if (userExists) {
      console.log(`\n✅ ACCOUNT CURRENTLY EXISTS (id ${userExists._id}, created ${userExists.createdAt})`);
      if (incarnations.length > 1) {
        console.log(`⚠️  BUT it has been re-created ${incarnations.length - 1} time(s) —`);
        console.log(`   this email has logged in under ${incarnations.length} different user ids:`);
        incarnations.forEach(id => console.log(`     ${id}${String(id) === String(userExists._id) ? '  <- current' : ''}`));
        if (deletionLogs.length === 0) {
          console.log(`   No deletion was ever logged, so the earlier records were`);
          console.log(`   removed outside the application (check TTL indexes and direct DB access).`);
        }
      }
    } else {
      console.log(`\n❌ ACCOUNT IS DELETED (no user document for this email)`);
      if (deletionLogs.length === 0) {
        console.log(`   No audit entry explains it — deletion did not go through app code.`);
      }
      if (incarnations.length) {
        console.log(`   Previous user id(s) for recovery: ${incarnations.join(', ')}`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    await mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
