/**
 * Notification Background Jobs
 * Scheduled tasks for notification system maintenance and engagement
 */

const User = require('../models/User');
const fcmService = require('../services/fcmService');
const templates = require('../utils/notificationTemplates');
const notificationService = require('../services/notificationService');

/**
 * Clean up inactive FCM tokens
 * Remove tokens that haven't been updated in 90 days
 */
const cleanupInactiveTokens = async () => {
  try {
    console.log('\n🧹 Starting FCM token cleanup...');
    
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    const result = await User.updateMany(
      {},
      {
        $pull: {
          fcmTokens: { lastUpdated: { $lt: ninetyDaysAgo } }
        }
      }
    );

    console.log(`✅ Token cleanup complete: ${result.modifiedCount} users updated`);
    
    return {
      success: true,
      usersUpdated: result.modifiedCount
    };
  } catch (error) {
    console.error('❌ Token cleanup failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Test and clean invalid FCM tokens
 * Sends a dry-run notification to verify token validity
 */
const testAndCleanTokens = async () => {
  try {
    console.log('\n🔍 Testing FCM tokens...');
    
    // Get users with tokens (sample for testing)
    const users = await User.find({
      'fcmTokens.0': { $exists: true }
    }).limit(100); // Test 100 users at a time
    
    let totalTested = 0;
    let totalRemoved = 0;
    
    for (const user of users) {
      const activeTokens = user.fcmTokens.filter(t => t.active);
      
      for (const tokenData of activeTokens) {
        try {
          // Send a silent test notification
          const admin = require('../config/firebase');
          await admin.messaging().send({
            token: tokenData.token,
            data: { test: 'true' },
            android: { priority: 'normal' },
            apns: {
              headers: { 'apns-priority': '5' },
              payload: { aps: { 'content-available': 1 } }
            }
          }, true); // dryRun = true
          
          totalTested++;
        } catch (error) {
          // Token is invalid, remove it
          await User.findByIdAndUpdate(user._id, {
            $pull: { fcmTokens: { token: tokenData.token } }
          });
          totalRemoved++;
          console.log(`🗑️ Removed invalid token for user ${user._id}`);
        }
      }
    }
    
    console.log(`✅ Token testing complete: ${totalTested} tested, ${totalRemoved} removed`);
    
    return {
      success: true,
      tested: totalTested,
      removed: totalRemoved
    };
  } catch (error) {
    console.error('❌ Token testing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send re-engagement notifications to inactive users
 * Targets users who haven't been active for 7+ days
 */
const sendReengagementNotifications = async () => {
  try {
    console.log('\n💌 Sending re-engagement notifications...');
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Find inactive users who have marketing notifications enabled
    const inactiveUsers = await User.find({
      lastActivityAt: { $lt: sevenDaysAgo },
      'notificationSettings.enabled': true,
      'notificationSettings.marketing': true,
      'fcmTokens.0': { $exists: true } // Has at least one token
    }).limit(500); // Process 500 users per run
    
    let sent = 0;
    let failed = 0;
    
    for (const user of inactiveUsers) {
      const notification = templates.getReengagementTemplate();
      
      const result = await notificationService.send(
        user._id,
        'system',
        notification
      );
      
      if (result.success && !result.skipped) {
        sent++;
      } else {
        failed++;
      }
    }
    
    console.log(`✅ Re-engagement complete: ${sent} sent, ${failed} failed`);
    
    return {
      success: true,
      sent,
      failed
    };
  } catch (error) {
    console.error('❌ Re-engagement notifications failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send VIP subscription expiring reminders
 * Notifies VIP users 3 days before their subscription expires
 */
const sendSubscriptionReminders = async () => {
  try {
    console.log('\n⏰ Sending subscription reminders...');
    
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const fourDaysLater = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    
    // Find VIP users with subscriptions expiring in 3 days
    const expiringUsers = await User.find({
      'vipSubscription.isActive': true,
      'vipSubscription.endDate': {
        $gte: threeDaysLater,
        $lt: fourDaysLater
      },
      'notificationSettings.enabled': true,
      'fcmTokens.0': { $exists: true }
    });
    
    let sent = 0;
    let failed = 0;
    
    for (const user of expiringUsers) {
      const daysLeft = Math.ceil(
        (user.vipSubscription.endDate - now) / (1000 * 60 * 60 * 24)
      );
      
      const notification = templates.getSubscriptionExpiringTemplate(daysLeft);
      
      const result = await notificationService.send(
        user._id,
        'system',
        notification
      );
      
      if (result.success && !result.skipped) {
        sent++;
      } else {
        failed++;
      }
    }
    
    console.log(`✅ Subscription reminders complete: ${sent} sent, ${failed} failed`);
    
    return {
      success: true,
      sent,
      failed
    };
  } catch (error) {
    console.error('❌ Subscription reminders failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Clean up old notification history
 * This is a backup cleanup in case TTL index doesn't work as expected
 */
const cleanupOldNotifications = async () => {
  try {
    console.log('\n🗑️ Cleaning up old notifications...');
    
    const Notification = require('../models/Notification');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const result = await Notification.deleteMany({
      sentAt: { $lt: thirtyDaysAgo }
    });
    
    console.log(`✅ Notification cleanup complete: ${result.deletedCount} deleted`);
    
    return {
      success: true,
      deleted: result.deletedCount
    };
  } catch (error) {
    console.error('❌ Notification cleanup failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  cleanupInactiveTokens,
  testAndCleanTokens,
  sendReengagementNotifications,
  sendSubscriptionReminders,
  cleanupOldNotifications
};

