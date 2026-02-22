/**
 * Email Service
 * Centralized email sending with templates
 */

const sendEmail = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');

/**
 * Send welcome email after registration
 */
exports.sendWelcomeEmail = async (user) => {
  try {
    const template = templates.welcomeEmail(user.name);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    console.log(`✅ Welcome email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${user.email}:`, error);
    return false;
  }
};

/**
 * Send password changed notification
 */
exports.sendPasswordChangedEmail = async (user, deviceInfo = {}) => {
  try {
    const template = templates.passwordChangedEmail(user.name, deviceInfo);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    console.log(`✅ Password change email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send password change email to ${user.email}:`, error);
    return false;
  }
};

/**
 * Send new login notification
 */
exports.sendNewLoginEmail = async (user, deviceInfo = {}) => {
  try {
    const template = templates.newLoginEmail(user.name, deviceInfo);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    console.log(`✅ New login email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send new login email to ${user.email}:`, error);
    return false;
  }
};

/**
 * Send inactivity reminder
 */
exports.sendInactivityReminder = async (user, daysSinceActive) => {
  try {
    const template = templates.inactivityReminder(user.name, daysSinceActive);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    console.log(`✅ Inactivity reminder sent to ${user.email} (${daysSinceActive} days)`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send inactivity reminder to ${user.email}:`, error);
    return false;
  }
};

/**
 * Send account deactivation warning
 */
exports.sendDeactivationWarning = async (user, daysRemaining) => {
  try {
    const template = templates.accountDeactivationWarning(user.name, daysRemaining);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    console.log(`✅ Deactivation warning sent to ${user.email} (${daysRemaining} days remaining)`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send deactivation warning to ${user.email}:`, error);
    return false;
  }
};

/**
 * Send weekly digest
 */
exports.sendWeeklyDigest = async (user, stats) => {
  try {
    const template = templates.weeklyDigest(user.name, stats);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    console.log(`✅ Weekly digest sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send weekly digest to ${user.email}:`, error);
    return false;
  }
};

/**
 * Send new follower notification
 */
exports.sendNewFollowerEmail = async (user, followerName, followerImage) => {
  try {
    // Check if user has email notifications enabled
    if (user.privacySettings?.emailNotifications === false) {
      return false;
    }
    
    const template = templates.newFollowerEmail(user.name, followerName, followerImage);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    console.log(`✅ New follower email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send new follower email to ${user.email}:`, error);
    return false;
  }
};

/**
 * Send new message notification (for inactive users)
 */
exports.sendNewMessageEmail = async (user, senderName, messagePreview) => {
  try {
    // Check if user has email notifications enabled
    if (user.privacySettings?.emailNotifications === false) {
      return false;
    }
    
    const template = templates.newMessageEmail(user.name, senderName, messagePreview);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    console.log(`✅ New message email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send new message email to ${user.email}:`, error);
    return false;
  }
};

/**
 * Send correction notification
 */
exports.sendCorrectionEmail = async (user, correctorName, originalText, correctedText) => {
  try {
    if (user.privacySettings?.emailNotifications === false) {
      return false;
    }
    
    const template = templates.correctionReceivedEmail(user.name, correctorName, originalText, correctedText);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    console.log(`✅ Correction email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send correction email to ${user.email}:`, error);
    return false;
  }
};

/**
 * Send VIP subscription confirmation
 */
exports.sendVipSubscriptionEmail = async (user, plan, endDate) => {
  try {
    const template = templates.vipSubscriptionEmail(user.name, plan, endDate);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    console.log(`✅ VIP subscription email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send VIP subscription email to ${user.email}:`, error);
    return false;
  }
};

/**
 * Send daily admin report
 */
exports.sendAdminDailyReport = async (adminEmail, stats) => {
  try {
    const template = templates.adminDailyReportEmail(stats);
    await sendEmail({
      email: adminEmail,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    console.log(`✅ Daily admin report sent to ${adminEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send daily admin report to ${adminEmail}:`, error);
    return false;
  }
};

/**
 * Send new user notification to admin
 */
exports.sendNewUserNotification = async (adminEmail, user) => {
  try {
    const template = templates.newUserNotificationEmail(user);
    await sendEmail({
      email: adminEmail,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    console.log(`✅ New user notification sent to ${adminEmail} for user ${user.email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send new user notification to ${adminEmail}:`, error);
    return false;
  }
};

module.exports = exports;

