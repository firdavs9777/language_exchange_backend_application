const admin = require('../config/firebase');
const User = require('../models/User');

/**
 * FCM Service
 * Handles Firebase Cloud Messaging operations
 */

/**
 * Send notification to a single user (all their devices)
 * @param {String} userId - User ID
 * @param {Object} notification - { title, body, imageUrl }
 * @param {Object} data - Custom payload data
 * @returns {Object} - { success, delivered, failed }
 */
const sendToUser = async (userId, notification, data = {}) => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      console.error(`❌ User ${userId} not found`);
      return { success: false, error: 'User not found' };
    }

    // Get active FCM tokens
    const activeTokens = user.fcmTokens.filter(t => t.active);
    
    if (activeTokens.length === 0) {
      console.log(`ℹ️ No active FCM tokens for user ${userId}`);
      return { success: true, delivered: 0, failed: 0, reason: 'No active tokens' };
    }

    const messages = activeTokens.map(tokenData => 
      _buildMessage(tokenData.token, notification, data, tokenData.platform, user.badges)
    );

    // Send notifications
    const response = await admin.messaging().sendEach(messages);
    
    // Handle failed tokens
    if (response.failureCount > 0) {
      await _handleFailedTokens(userId, activeTokens, response.responses);
    }

    console.log(`✅ Sent notification to user ${userId}: ${response.successCount} delivered, ${response.failureCount} failed`);
    
    return {
      success: true,
      delivered: response.successCount,
      failed: response.failureCount
    };
  } catch (error) {
    console.error(`❌ Error sending notification to user ${userId}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to multiple users
 * @param {Array} userIds - Array of user IDs
 * @param {Object} notification - { title, body, imageUrl }
 * @param {Object} data - Custom payload data
 * @returns {Object} - Summary of results
 */
const sendToUsers = async (userIds, notification, data = {}) => {
  try {
    const results = await Promise.allSettled(
      userIds.map(userId => sendToUser(userId, notification, data))
    );

    const summary = results.reduce((acc, result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        acc.successful++;
        acc.delivered += result.value.delivered || 0;
        acc.failed += result.value.failed || 0;
      } else {
        acc.errored++;
      }
      return acc;
    }, { successful: 0, errored: 0, delivered: 0, failed: 0 });

    console.log(`✅ Batch send complete: ${summary.successful} users notified, ${summary.delivered} devices reached`);
    
    return { success: true, ...summary };
  } catch (error) {
    console.error('❌ Error in batch send:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to a topic
 * @param {String} topic - Topic name
 * @param {Object} notification - { title, body, imageUrl }
 * @param {Object} data - Custom payload data
 * @returns {Object} - FCM response
 */
const sendToTopic = async (topic, notification, data = {}) => {
  try {
    const message = {
      topic: topic,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: _sanitizeData(data),
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
          priority: 'high'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    if (notification.imageUrl) {
      message.notification.imageUrl = notification.imageUrl;
    }

    const response = await admin.messaging().send(message);
    console.log(`✅ Sent notification to topic ${topic}:`, response);
    
    return { success: true, messageId: response };
  } catch (error) {
    console.error(`❌ Error sending to topic ${topic}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe user to a topic
 * @param {String} userId - User ID
 * @param {String} topic - Topic name
 * @returns {Object} - Result
 */
const subscribeToTopic = async (userId, topic) => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const tokens = user.fcmTokens.filter(t => t.active).map(t => t.token);
    
    if (tokens.length === 0) {
      return { success: false, error: 'No active tokens' };
    }

    const response = await admin.messaging().subscribeToTopic(tokens, topic);
    console.log(`✅ Subscribed user ${userId} to topic ${topic}:`, response.successCount, 'tokens');
    
    return { success: true, subscribedCount: response.successCount };
  } catch (error) {
    console.error(`❌ Error subscribing to topic ${topic}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Unsubscribe user from a topic
 * @param {String} userId - User ID
 * @param {String} topic - Topic name
 * @returns {Object} - Result
 */
const unsubscribeFromTopic = async (userId, topic) => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const tokens = user.fcmTokens.filter(t => t.active).map(t => t.token);
    
    if (tokens.length === 0) {
      return { success: false, error: 'No active tokens' };
    }

    const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
    console.log(`✅ Unsubscribed user ${userId} from topic ${topic}:`, response.successCount, 'tokens');
    
    return { success: true, unsubscribedCount: response.successCount };
  } catch (error) {
    console.error(`❌ Error unsubscribing from topic ${topic}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Build platform-specific FCM message
 * @private
 */
const _buildMessage = (token, notification, data, platform, badges = {}) => {
  const message = {
    token: token,
    notification: {
      title: notification.title,
      body: notification.body
    },
    data: _sanitizeData(data)
  };

  // Add image if provided
  if (notification.imageUrl) {
    message.notification.imageUrl = notification.imageUrl;
  }

  // Platform-specific configurations
  if (platform === 'android') {
    message.android = {
      priority: 'high',
      notification: {
        channelId: 'default',
        sound: 'default',
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true,
        icon: 'ic_notification'
      }
    };
  } else if (platform === 'ios') {
    message.apns = {
      payload: {
        aps: {
          alert: {
            title: notification.title,
            body: notification.body
          },
          badge: badges.unreadMessages || 0,
          sound: 'default',
          category: data.type || 'default',
          'mutable-content': 1
        }
      }
    };
  }

  return message;
};

/**
 * Handle failed token deliveries
 * @private
 */
const _handleFailedTokens = async (userId, tokens, responses) => {
  try {
    const tokensToRemove = [];
    
    responses.forEach((response, idx) => {
      if (!response.success) {
        const errorCode = response.error?.code;
        
        // Remove invalid, unregistered, or expired tokens
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-argument'
        ) {
          tokensToRemove.push(tokens[idx].token);
          console.log(`🗑️ Removing invalid token for user ${userId}`);
        }
      }
    });

    if (tokensToRemove.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: {
          fcmTokens: { token: { $in: tokensToRemove } }
        }
      });
      console.log(`✅ Removed ${tokensToRemove.length} invalid tokens for user ${userId}`);
    }
  } catch (error) {
    console.error('❌ Error handling failed tokens:', error);
  }
};

/**
 * Sanitize data object for FCM (all values must be strings)
 * @private
 */
const _sanitizeData = (data) => {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) {
      sanitized[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
  }
  
  return sanitized;
};

module.exports = {
  sendToUser,
  sendToUsers,
  sendToTopic,
  subscribeToTopic,
  unsubscribeFromTopic
};

