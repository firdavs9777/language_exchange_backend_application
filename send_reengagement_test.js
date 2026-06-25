require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');

async function sendReengagement() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, { useUnifiedTopology: true });

    const db = mongoose.connection.db;

    // Find user
    const user = await db.collection('users').findOne({ email: 'bananatalkmain@gmail.com' });
    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }

    console.log(`\n✅ Found user: ${user.name}`);
    console.log(`📱 FCM Tokens: ${user.fcmTokens?.length}`);

    if (!user.fcmTokens || user.fcmTokens.length === 0) {
      console.error('❌ No FCM tokens! Open the app to register.');
      process.exit(1);
    }

    // Try to send using FCM
    try {
      const fcmService = require('./services/fcmService');
      
      const messages = [
        {
          title: `Still working on ${user.language_to_learn}?`,
          body: 'Your study deck and practice partners are waiting on BananaTalk',
        },
        {
          title: 'Quick practice session?',
          body: `5 minutes with the AI Tutor is enough to keep your ${user.language_to_learn} moving`,
        },
        {
          title: 'Vocabulary fades without review',
          body: 'Your saved words are ready — open BananaTalk to keep them fresh',
        },
      ];

      const notification = messages[Math.floor(Math.random() * messages.length)];

      console.log('\n📤 Sending re-engagement notification...');
      console.log(`   Title: "${notification.title}"`);
      console.log(`   Body: "${notification.body}"`);

      const result = await fcmService.sendToUser(
        user._id,
        { 
          title: notification.title, 
          body: notification.body
        },
        { type: 'reengagement', route: '/home' }
      );

      if (result.success) {
        console.log('\n🎉 NOTIFICATION SENT SUCCESSFULLY!');
        console.log(`✅ Delivered to ${result.delivered} device(s)`);
        console.log(`❌ Failed on ${result.failed} device(s)`);
        console.log('\n📲 Check your phone NOW! Notification arriving in 1-5 seconds...');

        // Update timestamp
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { lastReengagementAt: new Date() } }
        );
      } else {
        console.log('\n⚠️  Notification failed:', result.error);
      }

    } catch (fcmError) {
      console.error('\n❌ FCM Error:', fcmError.message);
      if (fcmError.message.includes('serviceAccountKey')) {
        console.log('\n💡 Missing Firebase credentials (serviceAccountKey.json)');
        console.log('The notification system is ready but needs the backend credentials.');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

sendReengagement();
