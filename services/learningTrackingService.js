/**
 * Learning Tracking Service
 * Central service for tracking all learning activities, awarding XP, and updating progress
 */

const LearningProgress = require('../models/LearningProgress');
const ConversationActivity = require('../models/ConversationActivity');
const User = require('../models/User');
const { XP_REWARDS, getStreakMultiplier, calculateLevel } = require('../config/xpRewards');

/**
 * Count words in a message
 * @param {string} text - The message text
 * @returns {number} Word count
 */
const countWords = (text) => {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

/**
 * Check if a language code matches the user's target language
 * @param {string} detectedLang - Detected language code
 * @param {string} targetLang - User's target language
 * @returns {boolean}
 */
const isTargetLanguage = (detectedLang, targetLang) => {
  if (!detectedLang || !targetLang) return false;
  // Normalize both to lowercase and compare first 2 characters (ISO 639-1)
  return detectedLang.toLowerCase().substring(0, 2) === targetLang.toLowerCase().substring(0, 2);
};

/**
 * Track a message sent by user
 * @param {Object} params - Parameters
 * @param {string} params.userId - User who sent the message
 * @param {string} params.conversationId - Conversation ID
 * @param {string} params.messageId - Message ID
 * @param {string} params.partnerId - Partner in conversation
 * @param {string} params.messageText - Message content
 * @param {string} params.detectedLanguage - Detected language of message (optional)
 * @returns {Object} Tracking result with XP awarded
 */
const trackMessage = async ({
  userId,
  conversationId,
  messageId,
  partnerId,
  messageText,
  detectedLanguage
}) => {
  try {
    // Get user's language settings
    const user = await User.findById(userId).select('language_to_learn native_language');
    if (!user) {
      console.error('trackMessage: User not found:', userId);
      return { success: false, error: 'User not found' };
    }

    const targetLang = user.language_to_learn;
    const nativeLang = user.native_language;
    const isTarget = isTargetLanguage(detectedLanguage, targetLang);
    const isNative = isTargetLanguage(detectedLanguage, nativeLang);

    // Calculate XP
    let xpToAward = 0;
    if (isTarget) {
      xpToAward = XP_REWARDS.MESSAGE_TARGET_LANGUAGE;
    }

    // Create activity record
    const activity = await ConversationActivity.create({
      user: userId,
      conversation: conversationId,
      message: messageId,
      activityType: 'message_sent',
      messageLanguage: detectedLanguage,
      detectedLanguage: detectedLanguage,
      isTargetLanguage: isTarget,
      isNativeLanguage: isNative,
      userTargetLanguage: targetLang,
      userNativeLanguage: nativeLang,
      partner: partnerId,
      messageLength: messageText?.length || 0,
      wordCount: countWords(messageText),
      xpAwarded: xpToAward
    });

    // Award XP if any
    let xpResult = null;
    if (xpToAward > 0) {
      xpResult = await awardXP(userId, xpToAward, 'message_target_language', targetLang);
    }

    // Update streak
    const streakResult = await updateStreak(userId);

    return {
      success: true,
      activity: activity._id,
      isTargetLanguage: isTarget,
      xpAwarded: xpToAward,
      xpResult,
      streakResult
    };
  } catch (error) {
    console.error('trackMessage error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Track a correction given by user
 * @param {Object} params - Parameters
 */
const trackCorrectionGiven = async ({
  userId,
  conversationId,
  messageId,
  partnerId,
  originalText,
  correctedText,
  explanation
}) => {
  try {
    const user = await User.findById(userId).select('language_to_learn native_language');
    if (!user) return { success: false, error: 'User not found' };

    // Create activity record
    const activity = await ConversationActivity.create({
      user: userId,
      conversation: conversationId,
      message: messageId,
      activityType: 'correction_given',
      userTargetLanguage: user.language_to_learn,
      userNativeLanguage: user.native_language,
      partner: partnerId,
      correction: {
        originalText,
        correctedText,
        explanation
      },
      xpAwarded: XP_REWARDS.GIVE_CORRECTION
    });

    // Award XP
    const xpResult = await awardXP(userId, XP_REWARDS.GIVE_CORRECTION, 'correction_given');

    // Update stats
    await LearningProgress.updateOne(
      { user: userId },
      { $inc: { 'stats.correctionsGiven': 1 } }
    );

    return {
      success: true,
      activity: activity._id,
      xpAwarded: XP_REWARDS.GIVE_CORRECTION,
      xpResult
    };
  } catch (error) {
    console.error('trackCorrectionGiven error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Track a correction received by user
 * @param {Object} params - Parameters
 */
const trackCorrectionReceived = async ({
  userId,
  conversationId,
  messageId,
  partnerId,
  originalText,
  correctedText,
  explanation
}) => {
  try {
    const user = await User.findById(userId).select('language_to_learn native_language');
    if (!user) return { success: false, error: 'User not found' };

    // Create activity record
    const activity = await ConversationActivity.create({
      user: userId,
      conversation: conversationId,
      message: messageId,
      activityType: 'correction_received',
      userTargetLanguage: user.language_to_learn,
      userNativeLanguage: user.native_language,
      partner: partnerId,
      correction: {
        originalText,
        correctedText,
        explanation
      },
      xpAwarded: XP_REWARDS.RECEIVE_CORRECTION
    });

    // Award small XP for receiving (encourages engagement)
    const xpResult = await awardXP(userId, XP_REWARDS.RECEIVE_CORRECTION, 'correction_received');

    // Update stats
    await LearningProgress.updateOne(
      { user: userId },
      { $inc: { 'stats.correctionsReceived': 1 } }
    );

    return {
      success: true,
      activity: activity._id,
      xpAwarded: XP_REWARDS.RECEIVE_CORRECTION,
      xpResult
    };
  } catch (error) {
    console.error('trackCorrectionReceived error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Track when user accepts a correction
 * @param {Object} params - Parameters
 */
const trackCorrectionAccepted = async ({
  userId,
  conversationId,
  messageId,
  partnerId
}) => {
  try {
    const user = await User.findById(userId).select('language_to_learn native_language');
    if (!user) return { success: false, error: 'User not found' };

    // Create activity record
    const activity = await ConversationActivity.create({
      user: userId,
      conversation: conversationId,
      message: messageId,
      activityType: 'correction_accepted',
      userTargetLanguage: user.language_to_learn,
      userNativeLanguage: user.native_language,
      partner: partnerId,
      xpAwarded: XP_REWARDS.ACCEPT_CORRECTION
    });

    // Award XP
    const xpResult = await awardXP(userId, XP_REWARDS.ACCEPT_CORRECTION, 'correction_accepted');

    // Update stats
    await LearningProgress.updateOne(
      { user: userId },
      { $inc: { 'stats.correctionsAccepted': 1 } }
    );

    return {
      success: true,
      activity: activity._id,
      xpAwarded: XP_REWARDS.ACCEPT_CORRECTION,
      xpResult
    };
  } catch (error) {
    console.error('trackCorrectionAccepted error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Award XP to a user
 * @param {string} userId - User ID
 * @param {number} amount - XP amount
 * @param {string} reason - Reason for XP
 * @param {string} targetLanguage - Target language (optional)
 * @returns {Object} Result with new totals
 */
const awardXP = async (userId, amount, reason = '', targetLanguage = null) => {
  try {
    // Get or create learning progress
    let progress = await LearningProgress.findOne({ user: userId });

    if (!progress) {
      const user = await User.findById(userId).select('language_to_learn');
      progress = await LearningProgress.create({
        user: userId,
        targetLanguage: targetLanguage || user?.language_to_learn || 'en'
      });
    }

    // Apply streak multiplier
    const multiplier = getStreakMultiplier(progress.currentStreak);
    const adjustedAmount = Math.floor(amount * multiplier);

    // Award XP using the model method
    const result = await progress.awardXP(adjustedAmount, reason);

    // Sync to User.learningStats periodically (every 10 XP awards or on level up)
    if (result.leveledUp || Math.random() < 0.1) {
      await syncUserLearningStats(userId);
    }

    return {
      ...result,
      multiplier,
      baseXP: amount
    };
  } catch (error) {
    console.error('awardXP error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update user's streak
 * @param {string} userId - User ID
 * @returns {Object} Streak result
 */
const updateStreak = async (userId) => {
  try {
    const progress = await LearningProgress.findOne({ user: userId });
    if (!progress) return { success: false, error: 'Progress not found' };

    const result = await progress.updateStreak();

    // Check for streak milestones
    if (result.streakUpdated) {
      // Award streak bonus XP
      if (progress.currentStreak === 7) {
        await awardXP(userId, XP_REWARDS.WEEKLY_STREAK_MILESTONE, 'weekly_streak');
      } else if (progress.currentStreak === 30) {
        await awardXP(userId, XP_REWARDS.MONTHLY_STREAK_MILESTONE, 'monthly_streak');
      }
    }

    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('updateStreak error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Sync learning stats to User model for quick access
 * @param {string} userId - User ID
 */
const syncUserLearningStats = async (userId) => {
  try {
    const progress = await LearningProgress.findOne({ user: userId });
    if (!progress) return;

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          'learningStats.currentStreak': progress.currentStreak,
          'learningStats.longestStreak': progress.longestStreak,
          'learningStats.totalXP': progress.totalXP,
          'learningStats.level': calculateLevel(progress.totalXP),
          'learningStats.proficiencyLevel': progress.proficiencyLevel,
          'learningStats.lessonsCompleted': progress.stats.lessonsCompleted,
          'learningStats.vocabularyCount': progress.stats.vocabularyAdded,
          'learningStats.vocabularyMastered': progress.stats.vocabularyMastered,
          'learningStats.achievementsUnlocked': progress.stats.achievementsUnlocked,
          'learningStats.weeklyRank': progress.weeklyRank,
          'learningStats.lastSyncedAt': new Date()
        }
      }
    );
  } catch (error) {
    console.error('syncUserLearningStats error:', error);
  }
};

/**
 * Track lesson completion
 * @param {Object} params - Parameters
 */
const trackLessonCompletion = async ({
  userId,
  lessonId,
  score,
  isPerfect
}) => {
  try {
    let xpToAward = XP_REWARDS.COMPLETE_LESSON;

    if (isPerfect) {
      xpToAward += XP_REWARDS.PERFECT_LESSON_BONUS;
    }

    // Award XP
    const xpResult = await awardXP(userId, xpToAward, 'lesson_completed');

    // Update stats
    await LearningProgress.updateOne(
      { user: userId },
      {
        $inc: {
          'stats.lessonsCompleted': 1,
          ...(isPerfect ? { 'stats.perfectLessons': 1 } : {})
        }
      }
    );

    // Update streak
    const streakResult = await updateStreak(userId);

    return {
      success: true,
      xpAwarded: xpToAward,
      xpResult,
      streakResult
    };
  } catch (error) {
    console.error('trackLessonCompletion error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Track quiz completion
 * @param {Object} params - Parameters
 */
const trackQuizCompletion = async ({
  userId,
  quizId,
  score,
  isPerfect,
  isPlacementTest
}) => {
  try {
    let xpToAward = XP_REWARDS.COMPLETE_QUIZ;

    if (isPerfect) {
      xpToAward += XP_REWARDS.PERFECT_QUIZ_BONUS;
    }

    if (isPlacementTest) {
      xpToAward += XP_REWARDS.PLACEMENT_TEST_BONUS;
    }

    // Award XP
    const xpResult = await awardXP(userId, xpToAward, 'quiz_completed');

    // Update stats
    const progress = await LearningProgress.findOne({ user: userId });
    if (progress) {
      const currentAvg = progress.stats.averageQuizScore;
      const quizCount = progress.stats.quizzesCompleted;
      const newAvg = ((currentAvg * quizCount) + score) / (quizCount + 1);

      await LearningProgress.updateOne(
        { user: userId },
        {
          $inc: { 'stats.quizzesCompleted': 1 },
          $set: { 'stats.averageQuizScore': Math.round(newAvg * 100) / 100 }
        }
      );
    }

    // Update streak
    const streakResult = await updateStreak(userId);

    return {
      success: true,
      xpAwarded: xpToAward,
      xpResult,
      streakResult
    };
  } catch (error) {
    console.error('trackQuizCompletion error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Track vocabulary review
 * @param {Object} params - Parameters
 */
const trackVocabularyReview = async ({
  userId,
  vocabularyId,
  correct,
  isMastered
}) => {
  try {
    let xpToAward = XP_REWARDS.REVIEW_VOCABULARY;

    if (isMastered) {
      xpToAward += XP_REWARDS.MASTER_VOCABULARY;
    }

    // Award XP
    const xpResult = await awardXP(userId, xpToAward, 'vocabulary_review');

    // Update stats
    await LearningProgress.updateOne(
      { user: userId },
      {
        $inc: {
          'stats.vocabularyReviews': 1,
          ...(isMastered ? { 'stats.vocabularyMastered': 1 } : {})
        }
      }
    );

    // Update streak
    const streakResult = await updateStreak(userId);

    return {
      success: true,
      xpAwarded: xpToAward,
      xpResult,
      streakResult
    };
  } catch (error) {
    console.error('trackVocabularyReview error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Track challenge completion
 * @param {Object} params - Parameters
 */
const trackChallengeCompletion = async ({
  userId,
  challengeId,
  challengeType
}) => {
  try {
    let xpToAward;
    let statField;

    switch (challengeType) {
      case 'daily':
        xpToAward = XP_REWARDS.COMPLETE_DAILY_CHALLENGE;
        statField = 'stats.dailyChallengesCompleted';
        break;
      case 'weekly':
        xpToAward = XP_REWARDS.COMPLETE_WEEKLY_CHALLENGE;
        statField = 'stats.weeklyChallengesCompleted';
        break;
      default:
        xpToAward = XP_REWARDS.COMPLETE_SPECIAL_CHALLENGE;
        statField = 'stats.dailyChallengesCompleted';
    }

    // Award XP
    const xpResult = await awardXP(userId, xpToAward, `challenge_${challengeType}`);

    // Update stats
    await LearningProgress.updateOne(
      { user: userId },
      { $inc: { [statField]: 1 } }
    );

    return {
      success: true,
      xpAwarded: xpToAward,
      xpResult
    };
  } catch (error) {
    console.error('trackChallengeCompletion error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user's learning dashboard data
 * @param {string} userId - User ID
 */
const getDashboardData = async (userId) => {
  try {
    const [progress, dailySummary, weeklySummary] = await Promise.all([
      LearningProgress.findOne({ user: userId }),
      ConversationActivity.getDailySummary(userId),
      ConversationActivity.getWeeklySummary(userId)
    ]);

    if (!progress) {
      return { success: false, error: 'No learning progress found' };
    }

    return {
      success: true,
      data: {
        level: progress.level,
        totalXP: progress.totalXP,
        weeklyXP: progress.weeklyXP,
        dailyXP: progress.dailyXP,
        xpToNextLevel: progress.xpToNextLevel,
        levelProgressPercent: progress.levelProgressPercent,
        currentStreak: progress.currentStreak,
        longestStreak: progress.longestStreak,
        dailyGoal: progress.dailyGoal,
        dailyGoalProgress: progress.dailyGoalProgress,
        proficiencyLevel: progress.proficiencyLevel,
        stats: progress.stats,
        dailySummary,
        weeklySummary
      }
    };
  } catch (error) {
    console.error('getDashboardData error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  trackMessage,
  trackCorrectionGiven,
  trackCorrectionReceived,
  trackCorrectionAccepted,
  awardXP,
  updateStreak,
  syncUserLearningStats,
  trackLessonCompletion,
  trackQuizCompletion,
  trackVocabularyReview,
  trackChallengeCompletion,
  getDashboardData,
  countWords,
  isTargetLanguage
};
