/**
 * Weekly Digest Email Job
 * 
 * Send weekly activity summaries to users who have opted in.
 * Run this every Sunday at 10:00 AM.
 */

const User = require('../models/User');
const Moment = require('../models/Moment');
const Message = require('../models/Message');
const emailService = require('../services/emailService');

/**
 * Get user's weekly stats
 */
const getUserWeeklyStats = async (userId) => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  try {
    // Count messages sent
    const messagesSent = await Message.countDocuments({
      sender: userId,
      createdAt: { $gte: oneWeekAgo }
    });
    
    // Count likes received on moments
    const userMoments = await Moment.find({ user: userId });
    const momentIds = userMoments.map(m => m._id);
    
    // This is a simplified version - you might need to adjust based on your schema
    let momentLikes = 0;
    for (const moment of userMoments) {
      const likesThisWeek = moment.likes?.filter(like => 
        new Date(like.likedAt || like.createdAt) >= oneWeekAgo
      ).length || 0;
      momentLikes += likesThisWeek;
    }
    
    // Count new followers
    const user = await User.findById(userId);
    // This assumes you track when follows happened - adjust as needed
    const newFollowers = 0; // Placeholder - implement based on your follow tracking
    
    // Count corrections received (if you have this feature)
    const correctionsReceived = 0; // Placeholder
    
    return {
      messagesSent,
      momentLikes,
      newFollowers,
      correctionsReceived
    };
  } catch (error) {
    console.error(`Error getting stats for user ${userId}:`, error);
    return {
      messagesSent: 0,
      momentLikes: 0,
      newFollowers: 0,
      correctionsReceived: 0
    };
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
        const hasActivity = userStats.messagesSent > 0 || 
                           userStats.momentLikes > 0 || 
                           userStats.newFollowers > 0;
        
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

