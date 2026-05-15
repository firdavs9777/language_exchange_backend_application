/**
 * Email Service
 * Centralized email sending with templates
 */

const sendEmail = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');
const User = require('../models/User');

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
    const template = templates.inactivityReminder(user.name, daysSinceActive, user.language_to_learn);
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
 * Send promotional email
 */
exports.sendPromotionalEmail = async (user, promoData) => {
  try {
    // Skip if user has email notifications disabled
    if (user.privacySettings?.emailNotifications === false) {
      return { success: false, reason: 'notifications_disabled' };
    }

    const template = templates.promotionalEmail(user.name || 'Friend', promoData);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      message: template.text,
      html: template.html
    });
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send promo email to ${user.email}:`, error.message);
    return { success: false, reason: error.message };
  }
};

/**
 * Send new user notification to admin
 */
exports.sendNewUserNotification = async (adminEmail, user) => {
  try {
    // Log user data for debugging
    console.log(`📧 Preparing new user notification for: ${user.email}`);
    console.log(`   - Name: ${user.name}`);
    console.log(`   - Username: @${user.username || 'N/A'}`);
    console.log(`   - Images: ${user.images ? user.images.length : 0} photo(s)`);
    if (user.images && user.images.length > 0) {
      user.images.forEach((img, i) => console.log(`     Photo ${i + 1}: ${img}`));
    }

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

// ===================== SAFETY WAVE (Step 14) =====================
// Per-report admin alerts + reporter confirmation + ban notification.
// APPENDED to the existing exports — do NOT replace module.exports below.

exports.sendAdminReportAlert = async (report) => {
  const adminEmail = process.env.ADMIN_EMAIL || 'bananatalkmain@gmail.com';
  if (!adminEmail) return;
  // Emergency kill switch — set ADMIN_REPORT_ALERTS_ENABLED=false in .env
  // to silence per-report alerts without a code deploy.
  if (process.env.ADMIN_REPORT_ALERTS_ENABLED === 'false') return;
  try {
    const [reporter, reportedUser] = await Promise.all([
      User.findById(report.reportedBy).select('name').lean(),
      User.findById(report.reportedUser).select('name').lean(),
    ]);
    const tpl = templates.adminReportAlert(
      report,
      reporter?.name || 'Unknown',
      reportedUser?.name || 'Unknown'
    );
    await sendEmail({
      email: adminEmail,
      subject: tpl.subject,
      message: tpl.text,
      html: tpl.html,
    });
  } catch (err) {
    console.error('[email] sendAdminReportAlert failed:', err.message);
  }
};

exports.sendReportResolutionToReporter = async (report) => {
  try {
    const reporter = await User.findById(report.reportedBy).select('name email').lean();
    if (!reporter?.email) return;
    const tpl = templates.reportResolutionToReporter(report);
    await sendEmail({
      email: reporter.email,
      subject: tpl.subject,
      message: tpl.text,
      html: tpl.html,
    });
  } catch (err) {
    console.error('[email] sendReportResolutionToReporter failed:', err.message);
  }
};

exports.sendBanNotification = async (userId, reason) => {
  try {
    const user = await User.findById(userId).select('name email').lean();
    if (!user?.email) return;
    const tpl = templates.banNotification(reason);
    await sendEmail({
      email: user.email,
      subject: tpl.subject,
      message: tpl.text,
      html: tpl.html,
    });
  } catch (err) {
    console.error('[email] sendBanNotification failed:', err.message);
  }
};

// Step 15 — restored-account notification. Called from
// services/banService.js#unbanUser fire-and-forget.
exports.sendUnbanNotification = async (userId, reason) => {
  try {
    const user = await User.findById(userId).select('name email').lean();
    if (!user?.email) return;
    const tpl = templates.unbanNotification(reason);
    await sendEmail({
      email: user.email,
      subject: tpl.subject,
      message: tpl.text,
      html: tpl.html,
    });
  } catch (err) {
    console.error('[email] sendUnbanNotification failed:', err.message);
  }
};

module.exports = exports;

