/**
 * Broadcast Notification Script
 *
 * Send an announcement/news notification to all active users
 *
 * Usage:
 *   node scripts/broadcastNotification.js "Feature Title" "Feature Description"
 *   Example:
 *   node scripts/broadcastNotification.js "New Vocabulary Quiz" "Try our new AI-powered vocabulary quizzes!"
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const fcmService = require('../services/fcmService');

async function broadcastNotification() {
  try {
    // Get command line arguments
    const title = process.argv[2] || 'New Feature Available';
    const body = process.argv[3] || 'Check out our latest update!';

    console.log('🔄 Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // Get all users with active FCM tokens
    const users = await User.find({
      'fcmTokens': { $exists: true, $ne: [] },
      'fcmTokens.active': true
    }).select('_id email fcmTokens').lean();

    const activeUsers = users.filter(u => u.fcmTokens.some(t => t.active));

    console.log(`📢 Broadcasting to ${activeUsers.length} users\n`);
    console.log(`Title: "${title}"`);
    console.log(`Body: "${body}"\n`);

    // Send to all users
    const notification = {
      title: title,
      body: body
    };

    const data = {
      type: 'system',
      timestamp: new Date().toISOString()
    };

    const startTime = Date.now();
    const result = await fcmService.sendToUsers(
      activeUsers.map(u => u._id),
      notification,
      data
    );
    const duration = (Date.now() - startTime) / 1000;

    console.log(`\n✅ Broadcast Complete!\n`);
    console.log(`📊 Results:`);
    console.log(`  Users targeted: ${activeUsers.length}`);
    console.log(`  Successfully sent: ${result.successful}`);
    console.log(`  Devices reached: ${result.delivered}`);
    console.log(`  Failed: ${result.failed}`);
    console.log(`  Errors: ${result.errored}`);
    console.log(`  Time taken: ${duration.toFixed(2)}s\n`);

    const successRate = result.successful > 0
      ? ((result.delivered / (result.delivered + result.failed)) * 100).toFixed(1)
      : '0';

    console.log(`📈 Success rate: ${successRate}%\n`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

broadcastNotification();
