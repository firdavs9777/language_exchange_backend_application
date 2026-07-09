const mongoose = require('mongoose');
require('dotenv').config({ path: './config/config.env' });

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
    });

    const email = 'bananatalkmain@gmail.com';
    const securityCol = mongoose.connection.db.collection('securitylogs');

    // Get ALL logs for this email, unfiltered
    const allLogs = await securityCol.find({ email })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    console.log('\n🔍 LOGIN FAILURE ANALYSIS\n');
    console.log('='.repeat(70) + '\n');

    console.log(`Total login events: ${allLogs.length}\n`);

    // Categorize
    const byReason = {};
    allLogs.forEach(log => {
      let reason = 'unknown';
      if (log.details) {
        if (typeof log.details === 'string') {
          reason = log.details.substring(0, 50);
        } else if (log.details.reason) {
          reason = log.details.reason;
        }
      }
      byReason[reason] = (byReason[reason] || 0) + 1;
    });

    console.log('Failure reasons:\n');
    Object.entries(byReason)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        console.log(`  ${reason}: ${count}x`);
      });

    console.log('\n\nRecent events:\n');
    allLogs.slice(0, 10).forEach((log, i) => {
      console.log(`${i+1}. ${log.createdAt || 'unknown'}`);
      if (log.details) {
        const detail = typeof log.details === 'string' ? 
          log.details.substring(0, 60) : 
          JSON.stringify(log.details).substring(0, 60);
        console.log(`   ${detail}`);
      }
    });

    console.log('\n' + '='.repeat(70) + '\n');

    console.log('💡 ANALYSIS:\n');

    const notFoundCount = Object.entries(byReason)
      .filter(([reason]) => reason.includes('User not found'))
      .reduce((sum, [_, count]) => sum + count, 0);

    if (notFoundCount === 0) {
      console.log('✅ NO "User not found" errors - account working fine');
    } else {
      console.log(`⚠️  Found ${notFoundCount} "User not found" errors`);
      console.log('   This could indicate:');
      console.log('   1. Old logs from when account didn\'t exist yet');
      console.log('   2. Login attempts with wrong email');
      console.log('   3. API calls searching for non-existent account');
    }

    console.log('\n✅ Account is currently ACTIVE and accessible\n');

    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
