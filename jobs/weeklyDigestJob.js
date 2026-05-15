/**
 * Weekly Digest Email Job
 * 
 * Send weekly activity summaries to users who have opted in.
 * Run this every Sunday at 10:00 AM.
 */

const User = require('../models/User');
const Message = require('../models/Message');
const emailService = require('../services/emailService');

/**
 * Get user's weekly stats
 */
const getUserWeeklyStats = async (userId) => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  try {
    const Vocabulary = require('../models/Vocabulary');

    const [wordsReviewed, wordsSaved, messagesSent, correctionsExchanged] = await Promise.all([
      Vocabulary.countDocuments({
        user: userId,
        'reviewStats.lastReviewedAt': { $gte: oneWeekAgo },
      }),
      Vocabulary.countDocuments({
        user: userId,
        createdAt: { $gte: oneWeekAgo },
      }),
      Message.countDocuments({
        sender: userId,
        createdAt: { $gte: oneWeekAgo },
      }),
      Message.countDocuments({
        $or: [{ sender: userId }, { receiver: userId }],
        'corrections.0': { $exists: true },
        updatedAt: { $gte: oneWeekAgo },
      }),
    ]);

    return { wordsReviewed, wordsSaved, messagesSent, correctionsExchanged };
  } catch (error) {
    console.error(`Error getting stats for user ${userId}:`, error);
    return { wordsReviewed: 0, wordsSaved: 0, messagesSent: 0, correctionsExchanged: 0 };
  }
};

/**
 * Run the weekly digest job
 */
const runWeeklyDigest = async () => {
  console.log('📧 Starting weekly digest email job...');
  
  const stats = {
    checked: 0,
    sent: 0,
    skipped: 0,
    errors: 0
  };
  
  try {
    // Find users who have opted in for weekly digest
    const users = await User.find({
      isRegistrationComplete: true,
      'privacySettings.weeklyDigest': { $ne: false },
      'privacySettings.emailNotifications': { $ne: false }
    }).select('name email privacySettings');
    
    console.log(`📊 Processing ${users.length} users for weekly digest...`);
    
    for (const user of users) {
      stats.checked++;
      
      try {
        const userStats = await getUserWeeklyStats(user._id);
        
        // Only send if user had some activity or it's their first digest
        const hasActivity =
          userStats.wordsReviewed > 0 ||
          userStats.wordsSaved > 0 ||
          userStats.messagesSent > 0;
        
        if (hasActivity) {
          await emailService.sendWeeklyDigest(user, userStats);
          stats.sent++;
        } else {
          stats.skipped++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing weekly digest for ${user.email}:`, error);
        stats.errors++;
      }
    }
    
    console.log('✅ Weekly digest job completed!');
    console.log(`📊 Stats:
    - Users checked: ${stats.checked}
    - Digests sent: ${stats.sent}
    - Skipped (no activity): ${stats.skipped}
    - Errors: ${stats.errors}`);
    
    return stats;
    
  } catch (error) {
    console.error('❌ Weekly digest job failed:', error);
    throw error;
  }
};

module.exports = {
  runWeeklyDigest,
  getUserWeeklyStats
};

