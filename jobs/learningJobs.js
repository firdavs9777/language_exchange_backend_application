/**
 * Learning Scheduled Jobs
 * Handles daily/weekly resets, challenge generation, streak checks, and stats sync
 */

const LearningProgress = require('../models/LearningProgress');
const Challenge = require('../models/Challenge');
const ChallengeProgress = require('../models/ChallengeProgress');
const User = require('../models/User');
const { calculateLevel } = require('../config/xpRewards');
const learningTrackingService = require('../services/learningTrackingService');

/**
 * Check and reset broken streaks
 * Should run daily at midnight
 */
const checkStreaks = async () => {
  console.log('[LearningJobs] Running streak check...');

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const twoDaysAgo = new Date(yesterday);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);

    // Find users who had activity before yesterday but not yesterday
    // (and haven't been reset yet)
    const usersWithBrokenStreaks = await LearningProgress.find({
      currentStreak: { $gt: 0 },
      lastActivityDate: { $lt: yesterday, $gte: twoDaysAgo }
    });

    console.log(`[LearningJobs] Found ${usersWithBrokenStreaks.length} users with potentially broken streaks`);

    for (const progress of usersWithBrokenStreaks) {
      // Check if they have a streak freeze available
      if (progress.streakFreezes > 0) {
        // Automatically use streak freeze
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lastFreezeDate = progress.streakFreezeUsedAt
          ? new Date(progress.streakFreezeUsedAt).setHours(0, 0, 0, 0)
          : null;

        if (lastFreezeDate !== today.getTime()) {
          progress.streakFreezes -= 1;
          progress.streakFreezeUsedAt = new Date();
          await progress.save();
          console.log(`[LearningJobs] Used streak freeze for user ${progress.user}`);
          continue;
        }
      }

      // Reset streak
      progress.currentStreak = 0;
      await progress.save();
      console.log(`[LearningJobs] Reset streak for user ${progress.user}`);
    }

    console.log('[LearningJobs] Streak check complete');
  } catch (error) {
    console.error('[LearningJobs] Streak check error:', error);
  }
};

/**
 * Reset daily stats for all users
 * Should run daily at midnight
 */
const resetDailyStats = async () => {
  console.log('[LearningJobs] Resetting daily stats...');

  try {
    // Get all learning progress records
    const allProgress = await LearningProgress.find({ dailyXP: { $gt: 0 } });

    for (const progress of allProgress) {
      await progress.resetDaily();
    }

    console.log(`[LearningJobs] Reset daily stats for ${allProgress.length} users`);
  } catch (error) {
    console.error('[LearningJobs] Reset daily stats error:', error);
  }
};

/**
 * Reset weekly stats for all users
 * Should run on Monday at midnight
 */
const resetWeeklyStats = async () => {
  console.log('[LearningJobs] Resetting weekly stats...');

  try {
    await LearningProgress.updateMany(
      {},
      {
        $set: {
          weeklyXP: 0,
          weeklyGoalProgress: 0,
          daysCompletedThisWeek: 0
        }
      }
    );

    console.log('[LearningJobs] Weekly stats reset complete');
  } catch (error) {
    console.error('[LearningJobs] Reset weekly stats error:', error);
  }
};

/**
 * Generate daily challenges
 * Should run daily at 11 PM (for next day)
 */
const generateDailyChallenges = async () => {
  console.log('[LearningJobs] Generating daily challenges...');

  try {
    // Generate 3 new daily challenges
    const challenges = await Challenge.generateDailyChallenges(3);
    console.log(`[LearningJobs] Generated ${challenges.length} daily challenges`);
  } catch (error) {
    console.error('[LearningJobs] Generate daily challenges error:', error);
  }
};

/**
 * Generate weekly challenge
 * Should run on Sunday at 11 PM (for next week)
 */
const generateWeeklyChallenge = async () => {
  console.log('[LearningJobs] Generating weekly challenge...');

  try {
    const challenge = await Challenge.generateWeeklyChallenge();
    if (challenge) {
      console.log('[LearningJobs] Generated weekly challenge:', challenge.title);
    }
  } catch (error) {
    console.error('[LearningJobs] Generate weekly challenge error:', error);
  }
};

/**
 * Clean up expired challenges
 * Should run daily
 */
const cleanupExpiredChallenges = async () => {
  console.log('[LearningJobs] Cleaning up expired challenges...');

  try {
    const now = new Date();

    // Mark expired challenges as inactive
    const result = await Challenge.updateMany(
      {
        endsAt: { $lt: now },
        isActive: true,
        isTemplate: false
      },
      {
        $set: { isActive: false }
      }
    );

    console.log(`[LearningJobs] Deactivated ${result.modifiedCount} expired challenges`);
  } catch (error) {
    console.error('[LearningJobs] Cleanup expired challenges error:', error);
  }
};

/**
 * Sync learning stats to User model for quick access
 * Should run every few hours
 */
const syncUserLearningStats = async () => {
  console.log('[LearningJobs] Syncing user learning stats...');

  try {
    // Get all learning progress records that need syncing
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - 4); // Sync if not synced in 4 hours

    const progressRecords = await LearningProgress.find({
      $or: [
        { 'stats.lastSyncedAt': { $lt: threshold } },
        { 'stats.lastSyncedAt': null }
      ]
    }).limit(100); // Batch process

    for (const progress of progressRecords) {
      await learningTrackingService.syncUserLearningStats(progress.user);
    }

    console.log(`[LearningJobs] Synced stats for ${progressRecords.length} users`);
  } catch (error) {
    console.error('[LearningJobs] Sync user learning stats error:', error);
  }
};

/**
 * Update leaderboard rankings
 * Should run every 4 hours
 */
const updateLeaderboardRankings = async () => {
  console.log('[LearningJobs] Updating leaderboard rankings...');

  try {
    // Get all users sorted by weekly XP
    const weeklyRankings = await LearningProgress.find()
      .sort({ weeklyXP: -1 })
      .select('_id user weeklyXP')
      .lean();

    // Update weekly ranks
    for (let i = 0; i < weeklyRankings.length; i++) {
      await LearningProgress.updateOne(
        { _id: weeklyRankings[i]._id },
        {
          $set: {
            weeklyRank: i + 1,
            lastRankUpdate: new Date()
          }
        }
      );
    }

    // Get all users sorted by total XP
    const allTimeRankings = await LearningProgress.find()
      .sort({ totalXP: -1 })
      .select('_id user totalXP')
      .lean();

    // Update all-time ranks
    for (let i = 0; i < allTimeRankings.length; i++) {
      await LearningProgress.updateOne(
        { _id: allTimeRankings[i]._id },
        { $set: { allTimeRank: i + 1 } }
      );
    }

    console.log(`[LearningJobs] Updated rankings for ${weeklyRankings.length} users`);
  } catch (error) {
    console.error('[LearningJobs] Update leaderboard rankings error:', error);
  }
};

/**
 * Send vocabulary review reminders
 * Should run at 9 AM and 7 PM
 */
const sendReviewReminders = async () => {
  console.log('[LearningJobs] Checking for review reminders...');

  try {
    const Vocabulary = require('../models/Vocabulary');
    const sendPushNotification = require('../utils/sendPushNotification');

    // Find users with words due for review
    const usersWithDueWords = await Vocabulary.aggregate([
      {
        $match: {
          nextReview: { $lte: new Date() },
          isArchived: false
        }
      },
      {
        $group: {
          _id: '$user',
          dueCount: { $sum: 1 }
        }
      },
      {
        $match: { dueCount: { $gte: 5 } } // Only notify if 5+ words due
      }
    ]);

    // Get users who have reminders enabled
    const usersToNotify = await User.find({
      _id: { $in: usersWithDueWords.map(u => u._id) },
      'notificationSettings.vocabularyReviewReminders': true,
      'fcmTokens.0': { $exists: true }
    }).select('_id fcmTokens');

    for (const user of usersToNotify) {
      const dueInfo = usersWithDueWords.find(u => u._id.toString() === user._id.toString());

      await sendPushNotification(
        user._id,
        {
          title: 'Time to Review! 📚',
          body: `You have ${dueInfo.dueCount} words waiting for review`,
          data: { type: 'vocabulary_review', count: dueInfo.dueCount }
        }
      );
    }

    console.log(`[LearningJobs] Sent review reminders to ${usersToNotify.length} users`);
  } catch (error) {
    console.error('[LearningJobs] Send review reminders error:', error);
  }
};

/**
 * Send streak reminder notifications
 * Should run at 8 PM
 */
const sendStreakReminders = async () => {
  console.log('[LearningJobs] Checking for streak reminders...');

  try {
    const sendPushNotification = require('../utils/sendPushNotification');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find users who haven't been active today but have a streak
    const usersAtRisk = await LearningProgress.find({
      currentStreak: { $gt: 0 },
      $or: [
        { lastActivityDate: { $lt: today } },
        { lastActivityDate: null }
      ]
    }).select('user currentStreak');

    // Get users who have streak reminders enabled
    const usersToNotify = await User.find({
      _id: { $in: usersAtRisk.map(u => u.user) },
      'notificationSettings.streakReminders': true,
      'fcmTokens.0': { $exists: true }
    }).select('_id fcmTokens');

    for (const user of usersToNotify) {
      const progressInfo = usersAtRisk.find(u => u.user.toString() === user._id.toString());

      await sendPushNotification(
        user._id,
        {
          title: `Don't lose your ${progressInfo.currentStreak}-day streak! 🔥`,
          body: 'Complete any learning activity today to keep your streak alive',
          data: { type: 'streak_reminder', currentStreak: progressInfo.currentStreak }
        }
      );
    }

    console.log(`[LearningJobs] Sent streak reminders to ${usersToNotify.length} users`);
  } catch (error) {
    console.error('[LearningJobs] Send streak reminders error:', error);
  }
};

/**
 * Schedule helper function
 */
const scheduleJob = (name, intervalMs, jobFn) => {
  console.log(`[LearningJobs] Scheduling ${name} every ${intervalMs / 1000 / 60} minutes`);

  // Run immediately
  setTimeout(() => {
    jobFn().catch(err => console.error(`[LearningJobs] ${name} error:`, err));
  }, 5000); // 5 second delay

  // Then schedule recurring
  setInterval(() => {
    jobFn().catch(err => console.error(`[LearningJobs] ${name} error:`, err));
  }, intervalMs);
};

/**
 * Start all learning jobs
 */
const startLearningJobs = () => {
  console.log('[LearningJobs] Starting learning scheduled jobs...');

  // Check streaks - every hour
  scheduleJob('streakCheck', 60 * 60 * 1000, checkStreaks);

  // Cleanup expired challenges - every 6 hours
  scheduleJob('cleanupChallenges', 6 * 60 * 60 * 1000, cleanupExpiredChallenges);

  // Update leaderboard rankings - every 4 hours
  scheduleJob('updateRankings', 4 * 60 * 60 * 1000, updateLeaderboardRankings);

  // Sync user stats - every 2 hours
  scheduleJob('syncStats', 2 * 60 * 60 * 1000, syncUserLearningStats);

  // Note: Daily/weekly resets and challenge generation should be scheduled
  // using a more precise scheduler (like node-cron) in production

  console.log('[LearningJobs] Learning jobs started');
};

module.exports = {
  checkStreaks,
  resetDailyStats,
  resetWeeklyStats,
  generateDailyChallenges,
  generateWeeklyChallenge,
  cleanupExpiredChallenges,
  syncUserLearningStats,
  updateLeaderboardRankings,
  sendReviewReminders,
  sendStreakReminders,
  startLearningJobs
};
