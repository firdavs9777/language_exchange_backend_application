/**
 * Email Templates for BananaTalk
 * Beautiful, consistent email templates for all occasions
 */

const APP_NAME = 'BananaTalk';
const SUPPORT_EMAIL = 'support@banatalk.com';
const YEAR = new Date().getFullYear();

// Base template wrapper
const baseTemplate = (content, accentColor = '#667eea') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f6f6f6; font-family: 'Segoe UI', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f6f6; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          ${content}
          <tr>
            <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: ${accentColor}; text-decoration: none;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                © ${YEAR} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ===================== AUTHENTICATION EMAILS =====================

/**
 * Welcome email after first registration
 */
exports.welcomeEmail = (userName) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 36px; font-weight: bold;">Welcome to ${APP_NAME}! 🎉</h1>
        <p style="color: rgba(255,255,255,0.9); font-size: 18px; margin: 15px 0 0 0;">We're thrilled to have you join our community</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 18px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>! 👋
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          Congratulations on joining ${APP_NAME}! You've taken the first step towards connecting with language learners from around the world.
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9ff; border-radius: 12px; padding: 25px; margin: 25px 0;">
          <tr>
            <td>
              <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 18px;">🚀 Here's what you can do:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #555555; line-height: 2;">
                <li>Share moments and practice writing in your target language</li>
                <li>Connect with native speakers through chat</li>
                <li>Get corrections on your messages from the community</li>
                <li>Watch stories from learners worldwide</li>
                <li>Earn badges and track your progress</li>
              </ul>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="https://banatalk.com/explore" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                Start Exploring 🌍
              </a>
            </td>
          </tr>
        </table>
        
        <p style="font-size: 14px; color: #888888; text-align: center; margin: 25px 0 0 0;">
          Happy learning! 📚✨
        </p>
      </td>
    </tr>
  `;
  
  return {
    subject: `Welcome to ${APP_NAME}, ${userName}! 🎉`,
    html: baseTemplate(content),
    text: `Welcome to ${APP_NAME}, ${userName}! We're thrilled to have you join our community of language learners.`
  };
};

/**
 * Password changed confirmation email
 */
exports.passwordChangedEmail = (userName, deviceInfo = {}) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">Password Updated ✅</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>,
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          Your password was successfully changed on <strong>${new Date().toLocaleString()}</strong>.
        </p>
        
        ${deviceInfo.device ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fff4; border: 1px solid #38ef7d; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                <strong>📱 Device:</strong> ${deviceInfo.device || 'Unknown'}
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                <strong>🌐 IP Address:</strong> ${deviceInfo.ipAddress || 'Unknown'}
              </p>
              <p style="margin: 0; font-size: 14px; color: #666666;">
                <strong>📍 Location:</strong> ${deviceInfo.location || 'Unknown'}
              </p>
            </td>
          </tr>
        </table>
        ` : ''}
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                ⚠️ <strong>Wasn't you?</strong> If you didn't change your password, please <a href="https://banatalk.com/forgot-password" style="color: #856404; font-weight: bold;">reset it immediately</a> and contact our support team.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  
  return {
    subject: `🔐 Password Changed - ${APP_NAME}`,
    html: baseTemplate(content, '#11998e'),
    text: `Your ${APP_NAME} password was successfully changed. If this wasn't you, please reset your password immediately.`
  };
};

/**
 * Login from new device notification
 */
exports.newLoginEmail = (userName, deviceInfo = {}) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">New Sign-in Detected 📱</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>,
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          We noticed a new sign-in to your ${APP_NAME} account.
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e3f2fd; border: 1px solid #4facfe; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;">
                <strong>🕐 Time:</strong> ${new Date().toLocaleString()}
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;">
                <strong>📱 Device:</strong> ${deviceInfo.device || 'Unknown Device'}
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;">
                <strong>🌐 IP Address:</strong> ${deviceInfo.ipAddress || 'Unknown'}
              </p>
              <p style="margin: 0; font-size: 14px; color: #333333;">
                <strong>📍 Location:</strong> ${deviceInfo.location || 'Unknown Location'}
              </p>
            </td>
          </tr>
        </table>
        
        <p style="font-size: 14px; color: #666666; line-height: 1.6; margin: 0 0 25px 0;">
          If this was you, you can safely ignore this email.
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                🚨 <strong>Suspicious activity?</strong> If you didn't sign in, <a href="https://banatalk.com/forgot-password" style="color: #856404; font-weight: bold;">secure your account now</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  
  return {
    subject: `🔔 New Sign-in to Your ${APP_NAME} Account`,
    html: baseTemplate(content, '#4facfe'),
    text: `New sign-in detected on your ${APP_NAME} account from ${deviceInfo.device || 'unknown device'}. If this wasn't you, please secure your account immediately.`
  };
};

/**
 * Account deactivation warning (before deletion)
 */
exports.accountDeactivationWarning = (userName, daysRemaining = 30) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">We Miss You! 😢</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>,
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          We noticed you haven't been active on ${APP_NAME} for a while. We miss having you in our community! 
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff5f5; border: 2px solid #ff6b6b; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 16px; color: #c92a2a;">
                ⚠️ Your account will be deactivated in <strong>${daysRemaining} days</strong> due to inactivity.
              </p>
            </td>
          </tr>
        </table>
        
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          To keep your account active, simply log in before the deactivation date.
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="https://banatalk.com/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                Come Back & Say Hi! 👋
              </a>
            </td>
          </tr>
        </table>
        
        <p style="font-size: 14px; color: #888888; text-align: center; margin: 25px 0 0 0;">
          Your language learning journey is waiting for you! 🌍📚
        </p>
      </td>
    </tr>
  `;
  
  return {
    subject: `😢 We Miss You, ${userName}! Your ${APP_NAME} Account`,
    html: baseTemplate(content, '#ff6b6b'),
    text: `Hi ${userName}, we noticed you haven't been active on ${APP_NAME}. Your account will be deactivated in ${daysRemaining} days. Log in to keep your account active!`
  };
};

// ===================== ENGAGEMENT EMAILS =====================

/**
 * Inactivity reminder (friendly nudge)
 */
exports.inactivityReminder = (userName, daysSinceActive = 7) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">Hey ${userName}! 👋</h1>
        <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0 0;">It's been a while...</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          We haven't seen you on ${APP_NAME} for <strong>${daysSinceActive} days</strong>. The community misses you! 
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef9ff; border-radius: 12px; padding: 25px; margin: 25px 0;">
          <tr>
            <td>
              <h3 style="color: #f5576c; margin: 0 0 15px 0; font-size: 18px;">🔥 Here's what you missed:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #555555; line-height: 2;">
                <li>New moments from people you follow</li>
                <li>Unread messages waiting for you</li>
                <li>New features we've added</li>
                <li>Language learning tips from the community</li>
              </ul>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="https://banatalk.com/feed" style="display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                See What's New ✨
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  
  return {
    subject: `👋 ${userName}, we miss you on ${APP_NAME}!`,
    html: baseTemplate(content, '#f5576c'),
    text: `Hi ${userName}, we haven't seen you on ${APP_NAME} for ${daysSinceActive} days. Come back and see what you've missed!`
  };
};

/**
 * Weekly digest email
 */
exports.weeklyDigest = (userName, stats = {}) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); padding: 40px; text-align: center;">
        <h1 style="color: #333333; margin: 0; font-size: 32px; font-weight: bold;">Your Weekly Recap 📊</h1>
        <p style="color: #555555; font-size: 16px; margin: 10px 0 0 0;">Week of ${new Date().toLocaleDateString()}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 25px 0;">
          Hi <strong>${userName}</strong>! Here's your weekly activity summary:
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
          <tr>
            <td width="33%" align="center" style="padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 25px;">
                <p style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff;">${stats.messagesSent || 0}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">Messages Sent</p>
              </div>
            </td>
            <td width="33%" align="center" style="padding: 20px;">
              <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); border-radius: 12px; padding: 25px;">
                <p style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff;">${stats.momentLikes || 0}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">Likes Received</p>
              </div>
            </td>
            <td width="33%" align="center" style="padding: 20px;">
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; padding: 25px;">
                <p style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff;">${stats.newFollowers || 0}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">New Followers</p>
              </div>
            </td>
          </tr>
        </table>
        
        ${stats.correctionsReceived > 0 ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8f5e9; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0; font-size: 16px; color: #2e7d32;">
                📝 <strong>Great job!</strong> You received ${stats.correctionsReceived} language corrections this week. Keep practicing!
              </p>
            </td>
          </tr>
        </table>
        ` : ''}
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="https://banatalk.com/profile/stats" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                View Full Stats 📈
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  
  return {
    subject: `📊 Your Weekly ${APP_NAME} Recap`,
    html: baseTemplate(content, '#667eea'),
    text: `Hi ${userName}! Here's your weekly recap: ${stats.messagesSent || 0} messages sent, ${stats.momentLikes || 0} likes received, ${stats.newFollowers || 0} new followers.`
  };
};

// ===================== NOTIFICATION EMAILS =====================

/**
 * New follower notification
 */
exports.newFollowerEmail = (userName, followerName, followerImage) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">New Follower! 🎉</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px; text-align: center;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 25px 0;">
          Hi <strong>${userName}</strong>!
        </p>
        
        ${followerImage ? `
        <img src="${followerImage}" alt="${followerName}" style="width: 80px; height: 80px; border-radius: 50%; margin: 20px 0; border: 4px solid #667eea;">
        ` : ''}
        
        <p style="font-size: 20px; color: #333333; margin: 20px 0;">
          <strong>${followerName}</strong> started following you!
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="https://banatalk.com/messages/new/${followerName}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                Say Hello! 👋
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  
  return {
    subject: `🎉 ${followerName} started following you on ${APP_NAME}!`,
    html: baseTemplate(content),
    text: `${followerName} started following you on ${APP_NAME}! Say hello and start a conversation.`
  };
};

/**
 * New message notification (for users not actively using the app)
 */
exports.newMessageEmail = (userName, senderName, messagePreview) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">New Message 💬</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>,
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          You have a new message from <strong>${senderName}</strong>:
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9ff; border-left: 4px solid #4facfe; padding: 20px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0; font-size: 16px; color: #333333; font-style: italic;">
                "${messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview}"
              </p>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="https://banatalk.com/messages" style="display: inline-block; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                Reply Now 💬
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  
  return {
    subject: `💬 New message from ${senderName} on ${APP_NAME}`,
    html: baseTemplate(content, '#4facfe'),
    text: `You have a new message from ${senderName}: "${messagePreview}"`
  };
};

/**
 * Correction received notification (HelloTalk style)
 */
exports.correctionReceivedEmail = (userName, correctorName, originalText, correctedText) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">Language Correction 📝</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>,
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          <strong>${correctorName}</strong> helped you with a language correction!
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
          <tr>
            <td style="background-color: #ffebee; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
              <p style="margin: 0 0 5px 0; font-size: 12px; color: #c62828; text-transform: uppercase;">Original:</p>
              <p style="margin: 0; font-size: 16px; color: #c62828; text-decoration: line-through;">${originalText}</p>
            </td>
          </tr>
          <tr><td style="height: 10px;"></td></tr>
          <tr>
            <td style="background-color: #e8f5e9; border-radius: 8px; padding: 15px;">
              <p style="margin: 0 0 5px 0; font-size: 12px; color: #2e7d32; text-transform: uppercase;">Corrected:</p>
              <p style="margin: 0; font-size: 16px; color: #2e7d32; font-weight: bold;">${correctedText}</p>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="https://banatalk.com/messages" style="display: inline-block; background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                View & Learn 📚
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  
  return {
    subject: `📝 ${correctorName} helped correct your message on ${APP_NAME}`,
    html: baseTemplate(content, '#fa709a'),
    text: `${correctorName} corrected your message. Original: "${originalText}" → Corrected: "${correctedText}"`
  };
};

// ===================== TRANSACTIONAL EMAILS =====================

/**
 * VIP subscription confirmation
 */
exports.vipSubscriptionEmail = (userName, plan, endDate) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">Welcome to VIP! 👑</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Congratulations <strong>${userName}</strong>! 🎉
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          You're now a ${APP_NAME} VIP member with the <strong>${plan}</strong> plan!
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-radius: 12px; padding: 25px; margin: 25px 0;">
          <tr>
            <td>
              <h3 style="color: #f7971e; margin: 0 0 15px 0; font-size: 18px;">👑 Your VIP Benefits:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #555555; line-height: 2;">
                <li>✅ Unlimited messages per day</li>
                <li>✅ No ads</li>
                <li>✅ Priority support</li>
                <li>✅ Custom VIP badge</li>
                <li>✅ Advanced search filters</li>
                <li>✅ Message translations</li>
              </ul>
            </td>
          </tr>
        </table>
        
        <p style="font-size: 14px; color: #666666; text-align: center;">
          Your subscription is active until: <strong>${new Date(endDate).toLocaleDateString()}</strong>
        </p>
      </td>
    </tr>
  `;
  
  return {
    subject: `👑 Welcome to ${APP_NAME} VIP, ${userName}!`,
    html: baseTemplate(content, '#f7971e'),
    text: `Congratulations ${userName}! You're now a ${APP_NAME} VIP member with the ${plan} plan. Your subscription is active until ${new Date(endDate).toLocaleDateString()}.`
  };
};

// ===================== ADMIN EMAILS =====================

/**
 * Daily admin report email
 */
exports.adminDailyReportEmail = (stats) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">Daily Admin Report</h1>
        <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0 0;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="color: #1e3c72; margin: 0 0 25px 0; font-size: 22px;">User Statistics</h2>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
          <tr>
            <td width="50%" style="padding: 10px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 25px; text-align: center;">
                <p style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff;">${stats.totalUsers || 0}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">Total Users</p>
              </div>
            </td>
            <td width="50%" style="padding: 10px;">
              <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); border-radius: 12px; padding: 25px; text-align: center;">
                <p style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff;">${stats.newUsersToday || 0}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">New Users Today</p>
              </div>
            </td>
          </tr>
          <tr>
            <td width="50%" style="padding: 10px;">
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; padding: 25px; text-align: center;">
                <p style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff;">${stats.newUsersThisWeek || 0}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">New Users This Week</p>
              </div>
            </td>
            <td width="50%" style="padding: 10px;">
              <div style="background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%); border-radius: 12px; padding: 25px; text-align: center;">
                <p style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff;">${stats.activeUsersToday || 0}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">Active Users Today</p>
              </div>
            </td>
          </tr>
        </table>

        <h2 style="color: #1e3c72; margin: 30px 0 20px 0; font-size: 22px;">Subscription Stats</h2>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9ff; border-radius: 12px; padding: 20px; margin: 15px 0;">
          <tr>
            <td>
              <table width="100%" cellpadding="8" cellspacing="0">
                <tr>
                  <td style="font-size: 15px; color: #555;">Total VIP Users:</td>
                  <td style="font-size: 15px; color: #333; font-weight: bold; text-align: right;">${stats.totalVipUsers || 0}</td>
                </tr>
                <tr>
                  <td style="font-size: 15px; color: #555;">New VIP Today:</td>
                  <td style="font-size: 15px; color: #333; font-weight: bold; text-align: right;">${stats.newVipToday || 0}</td>
                </tr>
                <tr>
                  <td style="font-size: 15px; color: #555;">Expiring in 7 days:</td>
                  <td style="font-size: 15px; color: #f7971e; font-weight: bold; text-align: right;">${stats.expiringVipSoon || 0}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <h2 style="color: #1e3c72; margin: 30px 0 20px 0; font-size: 22px;">Content Stats</h2>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fff4; border-radius: 12px; padding: 20px; margin: 15px 0;">
          <tr>
            <td>
              <table width="100%" cellpadding="8" cellspacing="0">
                <tr>
                  <td style="font-size: 15px; color: #555;">Messages Sent Today:</td>
                  <td style="font-size: 15px; color: #333; font-weight: bold; text-align: right;">${stats.messagesToday || 0}</td>
                </tr>
                <tr>
                  <td style="font-size: 15px; color: #555;">Moments Created Today:</td>
                  <td style="font-size: 15px; color: #333; font-weight: bold; text-align: right;">${stats.momentsToday || 0}</td>
                </tr>
                <tr>
                  <td style="font-size: 15px; color: #555;">Stories Posted Today:</td>
                  <td style="font-size: 15px; color: #333; font-weight: bold; text-align: right;">${stats.storiesToday || 0}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        ${stats.newUsersList && stats.newUsersList.length > 0 ? `
        <h2 style="color: #1e3c72; margin: 30px 0 20px 0; font-size: 22px;">New Users Today</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 12px; font-weight: bold; color: #333; border-bottom: 1px solid #e0e0e0;">Name</td>
            <td style="padding: 12px; font-weight: bold; color: #333; border-bottom: 1px solid #e0e0e0;">Username</td>
            <td style="padding: 12px; font-weight: bold; color: #333; border-bottom: 1px solid #e0e0e0;">Email</td>
            <td style="padding: 12px; font-weight: bold; color: #333; border-bottom: 1px solid #e0e0e0;">Joined</td>
          </tr>
          ${stats.newUsersList.map(user => `
          <tr>
            <td style="padding: 12px; color: #555; border-bottom: 1px solid #f0f0f0;">${user.name}</td>
            <td style="padding: 12px; color: #11998e; border-bottom: 1px solid #f0f0f0;">@${user.username || 'N/A'}</td>
            <td style="padding: 12px; color: #555; border-bottom: 1px solid #f0f0f0;">${user.email}</td>
            <td style="padding: 12px; color: #555; border-bottom: 1px solid #f0f0f0;">${new Date(user.createdAt).toLocaleTimeString()}</td>
          </tr>
          `).join('')}
        </table>
        ` : ''}

        <p style="font-size: 14px; color: #888888; text-align: center; margin: 30px 0 0 0;">
          This is an automated daily report for ${APP_NAME} administrators.
        </p>
      </td>
    </tr>
  `;

  return {
    subject: `[${APP_NAME}] Daily Report - ${new Date().toLocaleDateString()}`,
    html: baseTemplate(content, '#1e3c72'),
    text: `${APP_NAME} Daily Report - Total Users: ${stats.totalUsers}, New Users Today: ${stats.newUsersToday}, Active Users: ${stats.activeUsersToday}`
  };
};

/**
 * New user registration notification for admin
 */
exports.newUserNotificationEmail = (user) => {
  // Ensure images is a valid array of strings
  const images = Array.isArray(user.images)
    ? user.images.filter(img => img && typeof img === 'string' && img.startsWith('http'))
    : [];

  // Get profile photo URL (first image)
  const profilePhoto = images.length > 0 ? images[0] : null;

  // Get location info
  const location = user.location || {};
  const locationStr = [location.city, location.country].filter(Boolean).join(', ') || 'Not specified';

  // Get birth date
  const birthDate = user.birth_year && user.birth_month && user.birth_day
    ? `${user.birth_year}-${user.birth_month}-${user.birth_day}`
    : 'Not specified';

  // Generate photo gallery HTML
  const photoGalleryHtml = images.length > 0
    ? `
      <h3 style="color: #11998e; margin: 25px 0 15px 0; font-size: 16px;">Photos (${images.length}):</h3>
      <table width="100%" cellpadding="5" cellspacing="0">
        <tr>
          ${images.slice(0, 5).map((img, i) => `
            <td width="20%" align="center" style="vertical-align: top;">
              <a href="${img}" target="_blank">
                <img src="${img}" alt="Photo ${i + 1}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 2px solid #e0e0e0;">
              </a>
            </td>
          `).join('')}
        </tr>
      </table>
      <p style="font-size: 12px; color: #888; margin: 10px 0 0 0;">Click photos to view full size</p>
    `
    : '<p style="color: #888; font-style: italic;">No photos uploaded</p>';

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">New User Completed Profile!</h1>
        <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0 0;">${new Date().toLocaleString()}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">

        <!-- Profile Header with Photo -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
          <tr>
            <td width="120" style="vertical-align: top;">
              ${profilePhoto
                ? `<a href="${profilePhoto}" target="_blank"><img src="${profilePhoto}" alt="${user.name}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid #11998e;"></a>`
                : `<div style="width: 100px; height: 100px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; font-size: 36px; color: #999;">👤</div>`
              }
            </td>
            <td style="vertical-align: middle; padding-left: 20px;">
              <h2 style="margin: 0; color: #333; font-size: 24px;">${user.name}</h2>
              <p style="margin: 5px 0 0 0; color: #11998e; font-size: 16px; font-weight: bold;">@${user.username || 'N/A'}</p>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">${user.email}</p>
            </td>
          </tr>
        </table>

        <!-- User Details -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9ff; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <tr>
            <td>
              <h3 style="color: #11998e; margin: 0 0 15px 0; font-size: 16px;">Basic Info:</h3>
              <table width="100%" cellpadding="8" cellspacing="0">
                <tr>
                  <td style="font-size: 14px; color: #666; width: 140px;">User ID:</td>
                  <td style="font-size: 14px; color: #333; font-family: monospace;">${user._id || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #666;">Gender:</td>
                  <td style="font-size: 14px; color: #333; font-weight: bold;">${user.gender || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #666;">Birth Date:</td>
                  <td style="font-size: 14px; color: #333;">${birthDate}</td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #666;">Location:</td>
                  <td style="font-size: 14px; color: #333;">${locationStr}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Language Info -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fff4; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <tr>
            <td>
              <h3 style="color: #11998e; margin: 0 0 15px 0; font-size: 16px;">Language Info:</h3>
              <table width="100%" cellpadding="8" cellspacing="0">
                <tr>
                  <td style="font-size: 14px; color: #666; width: 140px;">Native Language:</td>
                  <td style="font-size: 14px; color: #333; font-weight: bold;">${user.native_language || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #666;">Learning:</td>
                  <td style="font-size: 14px; color: #333; font-weight: bold;">${user.language_to_learn || 'Not specified'}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Bio -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff9e6; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <tr>
            <td>
              <h3 style="color: #f7971e; margin: 0 0 10px 0; font-size: 16px;">Bio:</h3>
              <p style="font-size: 14px; color: #333; line-height: 1.6; margin: 0; font-style: italic;">"${user.bio || 'No bio provided'}"</p>
            </td>
          </tr>
        </table>

        <!-- Additional Info -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <tr>
            <td>
              <h3 style="color: #666; margin: 0 0 15px 0; font-size: 16px;">Additional Info:</h3>
              <table width="100%" cellpadding="8" cellspacing="0">
                <tr>
                  <td style="font-size: 14px; color: #666; width: 140px;">MBTI:</td>
                  <td style="font-size: 14px; color: #333;">${user.mbti || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #666;">Blood Type:</td>
                  <td style="font-size: 14px; color: #333;">${user.bloodType || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #666;">VIP Status:</td>
                  <td style="font-size: 14px; color: ${user.vipSubscription?.isActive ? '#f7971e' : '#666'}; font-weight: bold;">
                    ${user.vipSubscription?.isActive ? '👑 VIP (' + (user.vipSubscription.plan || 'Active') + ')' : 'Regular User'}
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #666;">Account Created:</td>
                  <td style="font-size: 14px; color: #333;">${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Photo Gallery -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <tr>
            <td>
              ${photoGalleryHtml}
            </td>
          </tr>
        </table>

        <!-- Photo URLs (for easy copying) -->
        ${images.length > 0 ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f0f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <tr>
            <td>
              <h4 style="color: #666; margin: 0 0 10px 0; font-size: 14px;">Photo URLs (click to copy):</h4>
              ${images.map((img, i) => `
                <p style="font-size: 12px; color: #333; margin: 5px 0; word-break: break-all;">
                  <strong>Photo ${i + 1}:</strong> <a href="${img}" target="_blank" style="color: #11998e;">${img}</a>
                </p>
              `).join('')}
            </td>
          </tr>
        </table>
        ` : ''}

        <p style="font-size: 14px; color: #888888; text-align: center; margin: 25px 0 0 0;">
          This is an automated notification for ${APP_NAME} administrators.
        </p>
      </td>
    </tr>
  `;

  return {
    subject: `[${APP_NAME}] New User: ${user.name} (@${user.username || 'N/A'}) completed profile!`,
    html: baseTemplate(content, '#11998e'),
    text: `New user completed profile on ${APP_NAME}:
Name: ${user.name}
Username: @${user.username || 'N/A'}
Email: ${user.email}
Gender: ${user.gender || 'N/A'}
Location: ${locationStr}
Native Language: ${user.native_language || 'N/A'}
Learning: ${user.language_to_learn || 'N/A'}
Bio: ${user.bio || 'N/A'}
Photos: ${images.length > 0 ? images.join('\n') : 'None'}`
  };
};

module.exports = exports;

