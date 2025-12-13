/**
 * Inactivity Email Job
 * 
 * This job runs periodically to send emails to inactive users:
 * - 7 days inactive: Friendly reminder
 * - 14 days inactive: Second reminder
 * - 21 days inactive: Warning about account deactivation
 * - 28 days inactive: Final warning (7 days until deactivation)
 * 
 * Run this job daily via cron or PM2
 */

const User = require('../models/User');
const emailService = require('../services/emailService');

// Thresholds for inactivity emails (in days)
const INACTIVITY_THRESHOLDS = {
  FIRST_REMINDER: 7,      // First friendly reminder
  SECOND_REMINDER: 14,    // Second reminder
  WARNING: 21,            // Warning about deactivation
  FINAL_WARNING: 28,      // Final warning (7 days left)
  DEACTIVATION: 35        // Account deactivation (optional)
};

/**
 * Calculate days since last activity
 */
const getDaysSinceActivity = (lastActiveDate) => {
  if (!lastActiveDate) return Infinity;
  const now = new Date();
  const lastActive = new Date(lastActiveDate);
  const diffTime = Math.abs(now - lastActive);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Run the inactivity check and send emails
 */
const runInactivityCheck = async () => {
  console.log('🔍 Starting inactivity email job...');
  
  const stats = {
    checked: 0,
    firstReminder: 0,
    secondReminder: 0,
    warning: 0,
    finalWarning: 0,
    errors: 0
  };
  
  try {
    // Find all active users who haven't opted out of emails
    const users = await User.find({
      isRegistrationComplete: true,
      'privacySettings.emailNotifications': { $ne: false }
    }).select('name email lastActivityAt inactivityEmailsSent privacySettings');
    
    console.log(`📊 Checking ${users.length} users for inactivity...`);
    
    for (const user of users) {
      stats.checked++;
      
      // Skip if no last activity date (new users)
      if (!user.lastActivityAt) continue;
      
      const daysSinceActive = getDaysSinceActivity(user.lastActivityAt);
      const emailsSent = user.inactivityEmailsSent || [];
      
      try {
        // Check each threshold
        if (daysSinceActive >= INACTIVITY_THRESHOLDS.FINAL_WARNING && !emailsSent.includes('final_warning')) {
          // Final warning - 7 days until deactivation
          await emailService.sendDeactivationWarning(user, 7);
          await User.findByIdAndUpdate(user._id, {
            $push: { inactivityEmailsSent: 'final_warning' },
            lastInactivityEmailAt: new Date()
          });
          stats.finalWarning++;
          
        } else if (daysSinceActive >= INACTIVITY_THRESHOLDS.WARNING && !emailsSent.includes('warning')) {
          // Warning about upcoming deactivation
          await emailService.sendDeactivationWarning(user, 14);
          await User.findByIdAndUpdate(user._id, {
            $push: { inactivityEmailsSent: 'warning' },
            lastInactivityEmailAt: new Date()
          });
          stats.warning++;
          
        } else if (daysSinceActive >= INACTIVITY_THRESHOLDS.SECOND_REMINDER && !emailsSent.includes('second_reminder')) {
          // Second reminder
          await emailService.sendInactivityReminder(user, daysSinceActive);
          await User.findByIdAndUpdate(user._id, {
            $push: { inactivityEmailsSent: 'second_reminder' },
            lastInactivityEmailAt: new Date()
          });
          stats.secondReminder++;
          
        } else if (daysSinceActive >= INACTIVITY_THRESHOLDS.FIRST_REMINDER && !emailsSent.includes('first_reminder')) {
          // First reminder
          await emailService.sendInactivityReminder(user, daysSinceActive);
          await User.findByIdAndUpdate(user._id, {
            $push: { inactivityEmailsSent: 'first_reminder' },
            lastInactivityEmailAt: new Date()
          });
          stats.firstReminder++;
        }
        
      } catch (emailError) {
        console.error(`❌ Error sending email to ${user.email}:`, emailError);
        stats.errors++;
      }
    }
    
    console.log('✅ Inactivity email job completed!');
    console.log(`📊 Stats:
    - Users checked: ${stats.checked}
    - First reminders sent: ${stats.firstReminder}
    - Second reminders sent: ${stats.secondReminder}
    - Warnings sent: ${stats.warning}
    - Final warnings sent: ${stats.finalWarning}
    - Errors: ${stats.errors}`);
    
    return stats;
    
  } catch (error) {
    console.error('❌ Inactivity email job failed:', error);
    throw error;
  }
};

/**
 * Reset inactivity emails when user becomes active
 * Call this when user logs in or performs an action
 */
const resetInactivityStatus = async (userId) => {
  try {
    await User.findByIdAndUpdate(userId, {
      lastActivityAt: new Date(),
      inactivityEmailsSent: []  // Clear sent emails
    });
  } catch (error) {
    console.error('Error resetting inactivity status:', error);
  }
};

/**
 * Update last activity timestamp
 * Call this frequently when user is active
 */
const updateLastActivity = async (userId) => {
  try {
    await User.findByIdAndUpdate(userId, {
      lastActivityAt: new Date()
    });
  } catch (error) {
    console.error('Error updating last activity:', error);
  }
};

module.exports = {
  runInactivityCheck,
  resetInactivityStatus,
  updateLastActivity,
  INACTIVITY_THRESHOLDS
};

