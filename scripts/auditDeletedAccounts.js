/**
 * Show All Deleted Accounts from Audit Log
 *
 * Usage:
 *   node scripts/auditDeletedAccounts.js
 *
 * Shows:
 *   - All accounts deleted (logged in AdminAuditLog)
 *   - Deletion timeline
 *   - Who deleted them (user vs admin)
 *   - Reason for deletion
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './config/config.env' });

(async () => {
  try {
    console.log('\n📋 ACCOUNT DELETION AUDIT LOG\n');

    await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
    });

    const auditCol = mongoose.connection.db.collection('adminauditlogs');
    const securityCol = mongoose.connection.db.collection('securitylogs');

    // ============================================
    // 1. GET ALL DELETION EVENTS
    // ============================================
    console.log('🔍 Finding all deletion events...\n');

    const deletionLogs = await auditCol.find({
      $or: [
        { action: 'USER_SELF_DELETE' },
        { action: 'user_hard_deleted' },
        { action: { $regex: 'DELETE|delete' } }
      ]
    }).sort({ createdAt: -1, timestamp: -1 }).toArray();

    console.log(`Found ${deletionLogs.length} deletion events in audit log\n`);

    if (deletionLogs.length === 0) {
      console.log('No deletion events found in AdminAuditLog');
      console.log('(Accounts may have been deleted before audit logging was enabled)\n');
    } else {
      console.log('LOGGED DELETIONS:');
      console.log('='.repeat(80) + '\n');

      deletionLogs.forEach((log, index) => {
        const timestamp = log.createdAt || log.timestamp || 'unknown';
        const action = log.action || 'unknown';
        const email = log.userEmail || log.email || 'unknown';
        const moderator = log.moderator || 'unknown';
        const isUserDelete = action === 'USER_SELF_DELETE';

        console.log(`${index + 1}. ${email}`);
        console.log(`   Timestamp: ${timestamp}`);
        console.log(`   Action: ${action}`);
        console.log(`   Type: ${isUserDelete ? '👤 User self-deleted' : '🔧 Admin deleted'}`);
        console.log(`   Moderator: ${isUserDelete ? '(self)' : moderator}`);

        if (log.details) {
          if (typeof log.details === 'string') {
            console.log(`   Details: ${log.details}`);
          } else {
            if (log.details.reason) {
              console.log(`   Reason: ${log.details.reason}`);
            }
            if (log.details.cascadeDeleted && Array.isArray(log.details.cascadeDeleted)) {
              console.log(`   Cascade: ${log.details.cascadeDeleted.join(', ')}`);
            }
          }
        }
        console.log();
      });
    }

    // ============================================
    // 2. GET ALL "USER NOT FOUND" EVENTS
    // ============================================
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  SUSPICIOUS DELETIONS (Not in Audit Log)');
    console.log('='.repeat(80) + '\n');

    const notFoundLogs = await securityCol.find({
      $or: [
        { 'details.reason': 'User not found' },
        { reason: 'User not found' }
      ]
    }).toArray();

    // Get unique emails with "User not found" events
    const deletedEmails = new Map();

    notFoundLogs.forEach(log => {
      const email = log.email || (log.details && log.details.email) || 'unknown';
      if (email !== 'unknown' && email !== 'admin@sub2api.local') {
        if (!deletedEmails.has(email)) {
          deletedEmails.set(email, []);
        }
        deletedEmails.get(email).push(log.createdAt || log.timestamp);
      }
    });

    const suspiciousEmails = Array.from(deletedEmails.entries())
      .sort((a, b) => b[1].length - a[1].length);

    console.log(`Found ${suspiciousEmails.length} accounts showing "User not found" errors\n`);

    if (suspiciousEmails.length === 0) {
      console.log('No suspicious deletions found');
    } else {
      console.log('TOP 20 MOST SUSPICIOUS DELETIONS:');
      console.log('(These accounts were deleted but not logged in AdminAuditLog)\n');

      suspiciousEmails.slice(0, 20).forEach((entry, index) => {
        const [email, timestamps] = entry;
        const firstError = timestamps[timestamps.length - 1];
        const lastError = timestamps[0];

        console.log(`${index + 1}. ${email}`);
        console.log(`   First "User not found": ${firstError}`);
        console.log(`   Total errors: ${timestamps.length}`);
        console.log();
      });

      if (suspiciousEmails.length > 20) {
        console.log(`... and ${suspiciousEmails.length - 20} more suspicious deletions\n`);
      }
    }

    // ============================================
    // 3. STATISTICS
    // ============================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 STATISTICS');
    console.log('='.repeat(80) + '\n');

    const userSelfDeletes = deletionLogs.filter(l => l.action === 'USER_SELF_DELETE').length;
    const adminDeletes = deletionLogs.filter(l => l.action === 'user_hard_deleted').length;

    console.log(`Total logged deletions: ${deletionLogs.length}`);
    console.log(`  - User self-deletes: ${userSelfDeletes}`);
    console.log(`  - Admin deletions: ${adminDeletes}`);

    console.log(`\nSuspicious unlogged deletions: ${suspiciousEmails.length}`);
    console.log('  (Accounts deleted, but deletion not in audit log)');

    console.log(`\nTotal suspicious/logged: ${deletionLogs.length + suspiciousEmails.length}`);

    console.log('\n' + '='.repeat(80) + '\n');

    await mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
