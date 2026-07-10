/**
 * Test Broadcast Notification Feature
 *
 * Tests the broadcast notification system without needing an admin token
 * Simulates sending to all users and shows delivery stats
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');

async function testBroadcast() {
  try {
    console.log('🔄 Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;

    // 1. Get stats about users and devices
    console.log('📊 BROADCAST TEST ANALYSIS\n');

    // Count users with FCM tokens
    const allUsers = await db.collection('users')
      .find({})
      .project({ _id: 1, fcmTokens: 1 })
      .toArray();

    const usersWithTokens = allUsers.filter(u => u.fcmTokens && u.fcmTokens.length > 0);
    const usersWithActiveTokens = allUsers.filter(u =>
      u.fcmTokens && u.fcmTokens.some(t => t.active === true)
    );

    let totalActiveDevices = 0;
    usersWithActiveTokens.forEach(u => {
      const activeCount = u.fcmTokens.filter(t => t.active === true).length;
      totalActiveDevices += activeCount;
    });

    console.log('User Statistics:');
    console.log(`  Total users in system: ${allUsers.length}`);
    console.log(`  Users with FCM tokens: ${usersWithTokens.length} (${((usersWithTokens.length / allUsers.length) * 100).toFixed(1)}%)`);
    console.log(`  Users with ACTIVE tokens: ${usersWithActiveTokens.length}`);
    console.log(`  Total active devices: ${totalActiveDevices}`);
    console.log(`  Avg devices per user: ${(totalActiveDevices / usersWithActiveTokens.length).toFixed(1)}\n`);

    // 2. Show the broadcast message
    const announcement = {
      title: '✨ Major Updates Released',
      body: 'New vocabulary sections, cascade delete on account removal, and improved push notifications!'
    };

    console.log('📢 BROADCAST MESSAGE:\n');
    console.log(`Title: ${announcement.title}`);
    console.log(`Body: ${announcement.body}\n`);

    // 3. Simulate delivery
    console.log('📱 SIMULATED DELIVERY:\n');

    // Simulate different delivery scenarios
    const simulatedDeliveryRate = 0.98; // 98% success rate (normal for FCM)
    const expectedDelivered = Math.floor(totalActiveDevices * simulatedDeliveryRate);
    const expectedFailed = totalActiveDevices - expectedDelivered;
    const estimatedTime = (usersWithActiveTokens.length / 1000).toFixed(2); // ~1000 users per second

    console.log(`  Devices to reach: ${totalActiveDevices}`);
    console.log(`  Expected delivered: ${expectedDelivered}`);
    console.log(`  Expected failed: ${expectedFailed}`);
    console.log(`  Expected success rate: ${(simulatedDeliveryRate * 100).toFixed(1)}%`);
    console.log(`  Estimated time: ${estimatedTime}s\n`);

    // 4. Show API endpoint
    console.log('🔌 API ENDPOINT:\n');
    console.log('POST /api/v1/admin/broadcast');
    console.log('Authorization: Bearer <ADMIN_TOKEN>\n');
    console.log('Request body:');
    console.log(JSON.stringify(announcement, null, 2));

    console.log('\n✅ TEST COMPLETE\n');
    console.log('Ready to send! Use:\n');
    console.log('curl -X POST http://localhost:5000/api/v1/admin/broadcast \\');
    console.log('  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log(`  -d '${JSON.stringify(announcement)}'`);
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

testBroadcast();
