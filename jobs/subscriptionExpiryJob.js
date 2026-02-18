/**
 * Subscription Expiry Job
 *
 * Checks for expired VIP subscriptions and deactivates them.
 * Also handles:
 * - Sending expiry warning notifications (3 days, 1 day before)
 * - Sending expired notifications
 * - Grace period handling
 *
 * Runs every hour to catch expirations promptly.
 */

const User = require('../models/User');
const { logSecurityEvent } = require('../utils/securityLogger');

// Try to import notification service (may not exist)
let sendPushNotification;
try {
  const notificationService = require('../services/notificationService');
  sendPushNotification = notificationService.sendPushNotification;
} catch (e) {
  sendPushNotification = async () => {
    console.log('📱 Push notification service not available');
  };
}

/**
 * Grace period in hours after subscription expires
 * Users still have access during this period
 */
const GRACE_PERIOD_HOURS = 24;

/**
 * Check and handle expired subscriptions
 */
async function checkExpiredSubscriptions() {
  const now = new Date();
  console.log(`\n💳 Checking subscription expirations at ${now.toISOString()}`);

  try {
    // Find users with expired VIP subscriptions
    // vipSubscription.isActive = true AND vipSubscription.endDate < now
    const expiredUsers = await User.find({
      userMode: 'vip',
      'vipSubscription.isActive': true,
      'vipSubscription.endDate': { $lt: now }
    }).select('_id email name vipSubscription userMode');

    console.log(`   Found ${expiredUsers.length} expired subscriptions`);

    let deactivatedCount = 0;
    let graceCount = 0;

    for (const user of expiredUsers) {
      const endDate = new Date(user.vipSubscription.endDate);
      const hoursSinceExpiry = (now - endDate) / (1000 * 60 * 60);

      // Check if still in grace period
      if (hoursSinceExpiry < GRACE_PERIOD_HOURS) {
        graceCount++;
        console.log(`   ⏳ User ${user._id}: in grace period (${Math.round(hoursSinceExpiry)}h since expiry)`);

        // Send grace period warning if not already sent
        if (!user.vipSubscription.gracePeriodNotified) {
          await sendGracePeriodNotification(user);
          user.vipSubscription.gracePeriodNotified = true;
          await user.save();
        }
        continue;
      }

      // Grace period expired - deactivate VIP
      console.log(`   ❌ Deactivating VIP for user ${user._id} (expired ${Math.round(hoursSinceExpiry)}h ago)`);

      // Use the model's deactivateVIP method
      await user.deactivateVIP('Subscription expired');

      // Log the event
      logSecurityEvent('SUBSCRIPTION_AUTO_DEACTIVATED', {
        userId: user._id,
        email: user.email,
        plan: user.vipSubscription.plan,
        expiredAt: endDate,
        deactivatedAt: now
      });

      // Send expiration notification
      await sendExpirationNotification(user);

      deactivatedCount++;
    }

    console.log(`   ✅ Deactivated: ${deactivatedCount}, In grace period: ${graceCount}`);
    return { deactivatedCount, graceCount, totalChecked: expiredUsers.length };

  } catch (error) {
    console.error('❌ Error checking expired subscriptions:', error);
    logSecurityEvent('SUBSCRIPTION_EXPIRY_JOB_ERROR', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Send expiry warning notifications
 * Runs daily to notify users before their subscription expires
 */
async function sendExpiryWarnings() {
  const now = new Date();
  console.log(`\n📧 Sending subscription expiry warnings at ${now.toISOString()}`);

  try {
    // Warning thresholds in days
    const warningDays = [7, 3, 1];
    let totalSent = 0;

    for (const days of warningDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);

      // Find users expiring on that day (within a 24-hour window)
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const expiringUsers = await User.find({
        userMode: 'vip',
        'vipSubscription.isActive': true,
        'vipSubscription.endDate': { $gte: startOfDay, $lte: endOfDay },
        [`vipSubscription.warnings.${days}day`]: { $ne: true }
      }).select('_id email name vipSubscription fcmTokens');

      console.log(`   ${days}-day warning: ${expiringUsers.length} users`);

      for (const user of expiringUsers) {
        try {
          await sendWarningNotification(user, days);

          // Mark warning as sent
          if (!user.vipSubscription.warnings) {
            user.vipSubscription.warnings = {};
          }
          user.vipSubscription.warnings[`${days}day`] = true;
          await user.save();

          totalSent++;
        } catch (notifyError) {
          console.error(`   Error sending warning to ${user._id}:`, notifyError.message);
        }
      }
    }

    console.log(`   ✅ Sent ${totalSent} expiry warnings`);
    return { totalSent };

  } catch (error) {
    console.error('❌ Error sending expiry warnings:', error);
    throw error;
  }
}

/**
 * Send warning notification to user
 */
async function sendWarningNotification(user, daysRemaining) {
  const title = 'VIP Subscription Expiring Soon';
  const body = daysRemaining === 1
    ? 'Your VIP subscription expires tomorrow! Renew now to keep your benefits.'
    : `Your VIP subscription expires in ${daysRemaining} days. Renew to keep unlimited access.`;

  try {
    await sendPushNotification(user._id, {
      title,
      body,
      data: {
        type: 'subscription_warning',
        daysRemaining: daysRemaining.toString(),
        action: 'open_subscription'
      }
    });
  } catch (error) {
    console.log(`   Could not send push notification: ${error.message}`);
  }
}

/**
 * Send grace period notification
 */
async function sendGracePeriodNotification(user) {
  const title = 'VIP Subscription Expired';
  const body = `Your VIP subscription has expired. You have ${GRACE_PERIOD_HOURS} hours to renew and keep your benefits.`;

  try {
    await sendPushNotification(user._id, {
      title,
      body,
      data: {
        type: 'subscription_grace_period',
        hoursRemaining: GRACE_PERIOD_HOURS.toString(),
        action: 'open_subscription'
      }
    });
  } catch (error) {
    console.log(`   Could not send push notification: ${error.message}`);
  }
}

/**
 * Send expiration notification
 */
async function sendExpirationNotification(user) {
  const title = 'VIP Subscription Ended';
  const body = 'Your VIP subscription has ended. Subscribe again anytime to restore your premium features.';

  try {
    await sendPushNotification(user._id, {
      title,
      body,
      data: {
        type: 'subscription_expired',
        action: 'open_subscription'
      }
    });
  } catch (error) {
    console.log(`   Could not send push notification: ${error.message}`);
  }
}

/**
 * Run full subscription expiry job
 * Combines expiration check and warning notifications
 */
async function runSubscriptionExpiryJob() {
  console.log('\n💳 ======== SUBSCRIPTION EXPIRY JOB ========');

  const results = {
    expiryCheck: null,
    warnings: null
  };

  try {
    // Check and deactivate expired subscriptions
    results.expiryCheck = await checkExpiredSubscriptions();

    // Send warnings for upcoming expirations
    results.warnings = await sendExpiryWarnings();

    console.log('💳 ======== JOB COMPLETED ========\n');
    return results;

  } catch (error) {
    console.error('💳 ======== JOB FAILED ========\n');
    throw error;
  }
}

/**
 * Reset warning flags for a user (e.g., after renewal)
 * Call this when a user renews their subscription
 */
async function resetWarningFlags(userId) {
  try {
    await User.findByIdAndUpdate(userId, {
      $unset: {
        'vipSubscription.warnings': 1,
        'vipSubscription.gracePeriodNotified': 1
      }
    });
  } catch (error) {
    console.error('Error resetting warning flags:', error);
  }
}

module.exports = {
  checkExpiredSubscriptions,
  sendExpiryWarnings,
  runSubscriptionExpiryJob,
  resetWarningFlags,
  GRACE_PERIOD_HOURS
};
