/**
 * Verify FCM Tokens in Database
 * This script checks if FCM tokens are properly stored for users
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: './config/config.env' });

// Connect to database
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', (error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

db.once('open', async () => {
  console.log('✅ Connected to MongoDB\n');

  try {
    const User = require('./models/User');

    // Find users with FCM tokens
    const usersWithTokens = await User.find(
      { 'fcmTokens.0': { $exists: true } },
      {
        name: 1,
        email: 1,
        fcmTokens: 1,
        'notificationSettings.enabled': 1,
        'badges.unreadMessages': 1,
        'badges.unreadNotifications': 1
      }
    );

    console.log('📊 FCM Token Report\n');
    console.log('='.repeat(80));
    console.log(`Total users with FCM tokens: ${usersWithTokens.length}\n`);

    if (usersWithTokens.length === 0) {
      console.log('⚠️  No users have registered FCM tokens yet.');
      console.log('   Users need to login and register their tokens.\n');
    } else {
      usersWithTokens.forEach((user, index) => {
        console.log(`\n${index + 1}. User: ${user.name || 'Unknown'}`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Email: ${user.email || 'N/A'}`);
        console.log(`   Notifications Enabled: ${user.notificationSettings?.enabled !== false ? '✅ Yes' : '❌ No'}`);
        console.log(`   Unread Messages: ${user.badges?.unreadMessages || 0}`);
        console.log(`   Unread Notifications: ${user.badges?.unreadNotifications || 0}`);
        console.log(`   \n   FCM Tokens (${user.fcmTokens.length}):`);
        
        user.fcmTokens.forEach((tokenInfo, idx) => {
          console.log(`   ${idx + 1}. Platform: ${tokenInfo.platform.toUpperCase()}`);
          console.log(`      Device ID: ${tokenInfo.deviceId}`);
          console.log(`      Token: ${tokenInfo.token.substring(0, 50)}...`);
          console.log(`      Active: ${tokenInfo.active ? '✅ Yes' : '❌ No'}`);
          console.log(`      Last Updated: ${new Date(tokenInfo.lastUpdated).toLocaleString()}`);
        });
      });
    }

    console.log('\n' + '='.repeat(80));

    // Check specific user from logs
    const specificUserId = '694358a0b696bd1f501ff051';
    console.log(`\n🔍 Checking specific user: ${specificUserId}\n`);
    
    const specificUser = await User.findById(specificUserId, {
      name: 1,
      email: 1,
      fcmTokens: 1,
      notificationSettings: 1,
      badges: 1
    });

    if (specificUser) {
      console.log(`✅ User Found: ${specificUser.name || 'Unknown'}`);
      console.log(`   Email: ${specificUser.email || 'N/A'}`);
      console.log(`\n   FCM Tokens: ${specificUser.fcmTokens?.length || 0}`);
      
      if (specificUser.fcmTokens && specificUser.fcmTokens.length > 0) {
        specificUser.fcmTokens.forEach((token, idx) => {
          console.log(`\n   Token ${idx + 1}:`);
          console.log(`   - Platform: ${token.platform}`);
          console.log(`   - Device ID: ${token.deviceId}`);
          console.log(`   - Token: ${token.token.substring(0, 60)}...`);
          console.log(`   - Active: ${token.active ? '✅' : '❌'}`);
          console.log(`   - Last Updated: ${new Date(token.lastUpdated).toLocaleString()}`);
        });

        console.log(`\n   Notification Settings:`);
        console.log(`   - Enabled: ${specificUser.notificationSettings?.enabled !== false ? '✅' : '❌'}`);
        console.log(`   - Chat Messages: ${specificUser.notificationSettings?.chatMessages !== false ? '✅' : '❌'}`);
        console.log(`   - Moments: ${specificUser.notificationSettings?.moments !== false ? '✅' : '❌'}`);
        console.log(`   - Friend Requests: ${specificUser.notificationSettings?.friendRequests !== false ? '✅' : '❌'}`);

        console.log(`\n   Badge Counts:`);
        console.log(`   - Unread Messages: ${specificUser.badges?.unreadMessages || 0}`);
        console.log(`   - Unread Notifications: ${specificUser.badges?.unreadNotifications || 0}`);

        console.log('\n✅ This user is ready to receive push notifications!');
      } else {
        console.log('\n❌ No FCM tokens found for this user');
        console.log('   User needs to login and register their token');
      }
    } else {
      console.log(`❌ User not found: ${specificUserId}`);
    }

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
});

