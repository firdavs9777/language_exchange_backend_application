/**
 * Notification Batch Service
 *
 * Optimized notification delivery with:
 * - Batching and rate limiting
 * - Deduplication within time windows
 * - Smart scheduling for learning reminders
 * - Efficient FCM multicast
 */

const admin = require('../config/firebase');
const User = require('../models/User');
const cache = require('./redisService');

// Configuration
const CONFIG = {
  // Max notifications to send per second (FCM limit is 500/sec)
  RATE_LIMIT: 400,

  // Batch size for multicast (FCM max is 500)
  BATCH_SIZE: 500,

  // Time window for deduplication (ms)
  DEDUP_WINDOW: 60000, // 1 minute

  // Processing interval (ms)
  PROCESS_INTERVAL: 1000, // 1 second

  // Max queue size before dropping
  MAX_QUEUE_SIZE: 10000
};

// In-memory queue for notifications
const notificationQueue = [];
let isProcessing = false;

// Deduplication map: `${userId}:${type}` -> timestamp
const dedupMap = new Map();

/**
 * Queue a notification for batched delivery
 * @param {Object} notification - { userId, title, body, data, type, imageUrl }
 * @returns {boolean} - Whether notification was queued
 */
const queue = (notification) => {
  // Validate required fields
  if (!notification.userId || !notification.title) {
    console.warn('Invalid notification - missing userId or title');
    return false;
  }

  // Check queue size
  if (notificationQueue.length >= CONFIG.MAX_QUEUE_SIZE) {
    console.warn('Notification queue full, dropping notification');
    return false;
  }

  // Deduplication check
  const dedupKey = `${notification.userId}:${notification.type || 'default'}`;
  const lastSent = dedupMap.get(dedupKey);

  if (lastSent && Date.now() - lastSent < CONFIG.DEDUP_WINDOW) {
    console.log(`Deduplicating notification for ${notification.userId} (${notification.type})`);
    return false;
  }

  // Add to queue
  notificationQueue.push({
    ...notification,
    queuedAt: Date.now()
  });

  // Update dedup map
  dedupMap.set(dedupKey, Date.now());

  // Start processing if not already running
  if (!isProcessing) {
    startProcessing();
  }

  return true;
};

/**
 * Queue notifications for multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Object} notification - { title, body, data, type, imageUrl }
 * @returns {number} - Number of notifications queued
 */
const queueBulk = (userIds, notification) => {
  let queued = 0;

  for (const userId of userIds) {
    if (queue({ ...notification, userId })) {
      queued++;
    }
  }

  return queued;
};

/**
 * Start the batch processing loop
 */
const startProcessing = () => {
  if (isProcessing) return;
  isProcessing = true;

  const processLoop = async () => {
    while (notificationQueue.length > 0 && isProcessing) {
      await processBatch();
      await sleep(CONFIG.PROCESS_INTERVAL);
    }
    isProcessing = false;
  };

  processLoop().catch(err => {
    console.error('Notification batch processing error:', err);
    isProcessing = false;
  });
};

/**
 * Process a batch of notifications
 */
const processBatch = async () => {
  // Get batch of notifications (up to rate limit)
  const batch = notificationQueue.splice(0, CONFIG.RATE_LIMIT);

  if (batch.length === 0) return;

  console.log(`Processing ${batch.length} notifications`);

  // Group by user to fetch tokens efficiently
  const userIds = [...new Set(batch.map(n => n.userId))];

  // Fetch all users with tokens in one query
  const users = await User.find({
    _id: { $in: userIds },
    'fcmTokens.0': { $exists: true }
  }).select('_id fcmTokens notificationSettings badges').lean();

  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  // Build FCM messages
  const messages = [];
  const tokenUserMap = new Map(); // token -> userId for cleanup

  for (const notification of batch) {
    const user = userMap.get(notification.userId);

    if (!user) continue;

    // Check user preferences
    if (!user.notificationSettings?.enabled) continue;

    // Get active tokens
    const activeTokens = user.fcmTokens.filter(t => t.active);

    for (const tokenData of activeTokens) {
      const message = buildMessage(
        tokenData.token,
        notification,
        tokenData.platform,
        user.badges
      );
      messages.push(message);
      tokenUserMap.set(tokenData.token, notification.userId);
    }
  }

  if (messages.length === 0) return;

  // Send in batches of 500 (FCM limit)
  for (let i = 0; i < messages.length; i += CONFIG.BATCH_SIZE) {
    const chunk = messages.slice(i, i + CONFIG.BATCH_SIZE);

    try {
      const response = await admin.messaging().sendEach(chunk);

      // Handle failures
      if (response.failureCount > 0) {
        await handleFailures(chunk, response.responses, tokenUserMap);
      }

      console.log(`Batch sent: ${response.successCount} success, ${response.failureCount} failed`);
    } catch (error) {
      console.error('FCM batch send error:', error.message);
    }
  }
};

/**
 * Build FCM message
 */
const buildMessage = (token, notification, platform, badges = {}) => {
  const data = notification.data || {};

  // Add type and image to data
  if (notification.type) data.type = notification.type;
  if (notification.imageUrl) data.imageUrl = notification.imageUrl;

  const message = {
    token,
    notification: {
      title: notification.title,
      body: notification.body
    },
    data: sanitizeData(data)
  };

  if (notification.imageUrl) {
    message.notification.imageUrl = notification.imageUrl;
  }

  // Platform-specific config
  if (platform === 'android') {
    message.android = {
      priority: 'high',
      notification: {
        channelId: notification.channel || 'default',
        sound: 'default',
        priority: 'high'
      }
    };
  } else if (platform === 'ios') {
    message.apns = {
      payload: {
        aps: {
          badge: (badges.unreadMessages || 0) + (badges.unreadNotifications || 0),
          sound: 'default',
          'mutable-content': 1
        }
      }
    };
  }

  return message;
};

/**
 * Handle failed token deliveries
 */
const handleFailures = async (messages, responses, tokenUserMap) => {
  const invalidTokens = new Map(); // userId -> [tokens]

  responses.forEach((response, idx) => {
    if (!response.success) {
      const errorCode = response.error?.code;

      if (
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/registration-token-not-registered'
      ) {
        const token = messages[idx].token;
        const userId = tokenUserMap.get(token);

        if (userId) {
          if (!invalidTokens.has(userId)) {
            invalidTokens.set(userId, []);
          }
          invalidTokens.get(userId).push(token);
        }
      }
    }
  });

  // Batch remove invalid tokens
  for (const [userId, tokens] of invalidTokens) {
    try {
      await User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { token: { $in: tokens } } }
      });
      console.log(`Removed ${tokens.length} invalid tokens for user ${userId}`);
    } catch (err) {
      console.error(`Error removing tokens for ${userId}:`, err.message);
    }
  }
};

/**
 * Sanitize data for FCM (all values must be strings)
 */
const sanitizeData = (data) => {
  const sanitized = {};

  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) {
      sanitized[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
  }

  return sanitized;
};

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// LEARNING NOTIFICATION HELPERS
// ============================================

/**
 * Send streak reminder notifications
 * For users who haven't practiced today but have active streaks
 */
const sendStreakReminders = async () => {
  const LearningProgress = require('../models/LearningProgress');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find users with active streaks who haven't practiced today
  const atRiskUsers = await LearningProgress.aggregate([
    {
      $match: {
        currentStreak: { $gt: 0 },
        lastActivityDate: { $lt: today }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $match: {
        'userInfo.notificationSettings.enabled': true,
        'userInfo.notificationSettings.streakReminders': true,
        'userInfo.fcmTokens.0': { $exists: true }
      }
    },
    {
      $project: {
        userId: '$user',
        currentStreak: 1,
        name: '$userInfo.name'
      }
    },
    { $limit: 1000 } // Process 1000 at a time
  ]);

  let queued = 0;

  for (const user of atRiskUsers) {
    const streakDays = user.currentStreak;

    queued += queue({
      userId: user.userId.toString(),
      title: `Don't lose your ${streakDays}-day streak!`,
      body: streakDays >= 7
        ? `You've been on fire for ${streakDays} days. Keep it going!`
        : 'Practice today to keep your streak alive.',
      type: 'streak_reminder',
      channel: 'learning',
      data: { screen: 'learning' }
    }) ? 1 : 0;
  }

  console.log(`Queued ${queued} streak reminders`);
  return queued;
};

/**
 * Send daily learning reminders
 * Based on user's preferred reminder time
 */
const sendDailyReminders = async (targetHour) => {
  const LearningProgress = require('../models/LearningProgress');

  // Find users with reminders enabled for this hour
  const reminderTime = `${String(targetHour).padStart(2, '0')}:00`;

  const users = await LearningProgress.aggregate([
    {
      $match: {
        'preferences.reminderEnabled': true,
        'preferences.reminderTime': reminderTime
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $match: {
        'userInfo.notificationSettings.enabled': true,
        'userInfo.notificationSettings.learningReminders': true,
        'userInfo.fcmTokens.0': { $exists: true }
      }
    },
    {
      $project: {
        userId: '$user',
        dailyGoal: 1,
        dailyGoalProgress: 1,
        name: '$userInfo.name'
      }
    }
  ]);

  const messages = [
    "Time to practice! Your language learning journey awaits.",
    "Ready to level up? Start your daily practice now.",
    "Your brain is ready for some language learning!",
    "Small daily steps lead to big language gains.",
    "Let's make today count! Time for your language practice."
  ];

  let queued = 0;

  for (const user of users) {
    queued += queue({
      userId: user.userId.toString(),
      title: 'Time to Practice!',
      body: messages[Math.floor(Math.random() * messages.length)],
      type: 'daily_reminder',
      channel: 'learning',
      data: { screen: 'learning' }
    }) ? 1 : 0;
  }

  console.log(`Queued ${queued} daily reminders for ${reminderTime}`);
  return queued;
};

/**
 * Send level up notifications
 * @param {string} userId - User ID
 * @param {number} newLevel - New level achieved
 */
const sendLevelUp = async (userId, newLevel) => {
  return queue({
    userId,
    title: 'Level Up!',
    body: `Congratulations! You've reached level ${newLevel}!`,
    type: 'level_up',
    channel: 'achievements',
    data: {
      screen: 'profile',
      level: String(newLevel)
    }
  });
};

/**
 * Send achievement notification
 * @param {string} userId - User ID
 * @param {string} achievementName - Achievement name
 * @param {string} description - Achievement description
 */
const sendAchievement = async (userId, achievementName, description) => {
  return queue({
    userId,
    title: `Achievement Unlocked!`,
    body: `${achievementName}: ${description}`,
    type: 'achievement',
    channel: 'achievements',
    data: {
      screen: 'achievements',
      achievement: achievementName
    }
  });
};

// ============================================
// CLEANUP
// ============================================

/**
 * Clean up old dedup entries
 */
const cleanupDedupMap = () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, timestamp] of dedupMap) {
    if (now - timestamp > CONFIG.DEDUP_WINDOW * 2) {
      dedupMap.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`Cleaned ${cleaned} dedup entries`);
  }
};

// Run cleanup every minute
setInterval(cleanupDedupMap, 60000);

/**
 * Get queue stats
 */
const getStats = () => ({
  queueSize: notificationQueue.length,
  isProcessing,
  dedupMapSize: dedupMap.size
});

/**
 * Stop processing (for graceful shutdown)
 */
const stop = () => {
  isProcessing = false;
};

module.exports = {
  queue,
  queueBulk,
  startProcessing,
  stop,
  getStats,

  // Learning helpers
  sendStreakReminders,
  sendDailyReminders,
  sendLevelUp,
  sendAchievement
};
