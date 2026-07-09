const mongoose = require('mongoose');
require('dotenv').config({ path: './config/config.env' });

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
    });

    const email = 'bananatalkmain@gmail.com';
    const userCol = mongoose.connection.db.collection('users');
    const securityCol = mongoose.connection.db.collection('securitylogs');
    const auditCol = mongoose.connection.db.collection('adminauditlogs');

    console.log('\n🚨 ADMIN ACCOUNT DELETION INVESTIGATION\n');
    console.log('='.repeat(80) + '\n');

    // Check if admin exists
    const adminExists = await userCol.findOne({ email });
    console.log(`📊 Current Status: ${adminExists ? '✅ EXISTS' : '❌ DELETED'}\n`);

    // Get security logs
    const securityLogs = await securityCol.find({ email })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    console.log(`🔐 Security Logs (${securityLogs.length} events):\n`);

    if (securityLogs.length > 0) {
      // Timeline
      const firstLog = securityLogs[securityLogs.length - 1];
      const lastLog = securityLogs[0];

      console.log(`Timeline:`);
      console.log(`  First event: ${firstLog.createdAt || 'unknown'}`);
      console.log(`  Last event: ${lastLog.createdAt || 'unknown'}\n`);

      // Event breakdown
      const events = {};
      securityLogs.forEach(log => {
        const action = log.action || log.details?.reason || 'unknown';
        events[action] = (events[action] || 0) + 1;
      });

      console.log(`Events breakdown:`);
      Object.entries(events).forEach(([action, count]) => {
        console.log(`  - ${action}: ${count}x`);
      });

      // Show "User not found" errors
      const notFound = securityLogs.filter(l => 
        (l.details && (typeof l.details === 'string' ? l.details.includes('User not found') : l.details.reason === 'User not found'))
      );

      console.log(`\n⚠️  "User not found" errors: ${notFound.length}\n`);
      notFound.slice(0, 3).forEach((log, i) => {
        console.log(`  ${i+1}. ${log.createdAt}`);
      });
    }

    // Check audit logs for deletion
    console.log(`\n\n📋 Audit Log (AdminAuditLog):\n`);

    const adminLogs = await auditCol.find({
      $or: [
        { userEmail: email },
        { email: email },
        { 'details.email': email }
      ]
    }).sort({ createdAt: -1 }).toArray();

    console.log(`Found ${adminLogs.length} audit entries\n`);

    if (adminLogs.length > 0) {
      adminLogs.slice(0, 5).forEach((log, i) => {
        console.log(`${i+1}. ${log.action || log.actionType}`);
        console.log(`   ${log.createdAt || log.timestamp}`);
        console.log(`   Details: ${JSON.stringify(log.details || {}).substring(0, 100)}\n`);
      });
    }

    // Get user ID from logs
    console.log('\n🔍 Finding Admin User ID:\n');

    let userId = null;
    for (const log of securityLogs) {
      if (log.userId) {
        userId = log.userId;
        break;
      }
      if (log.details && log.details.userId) {
        userId = log.details.userId;
        break;
      }
    }

    if (userId) {
      console.log(`✅ Found User ID: ${userId}`);
    } else {
      console.log(`❌ User ID not found in logs`);
    }

    console.log('\n' + '='.repeat(80) + '\n');

    console.log('🎯 CRITICAL FINDINGS:\n');
    console.log(`1. Admin account status: ${adminExists ? '✅ EXISTS (somehow)' : '❌ DELETED (CRITICAL!)'}`);
    console.log(`2. Security logs show: ${notFound.length} login failures`);
    console.log(`3. Timeline: ${firstLog.createdAt ? 'Account deleted around ' + firstLog.createdAt : 'Unknown'}`);
    console.log(`4. Audit trail: ${adminLogs.length} entries (${adminLogs.length === 0 ? '❌ NONE - no log of deletion!' : '✅ Has history'})\n`);

    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
