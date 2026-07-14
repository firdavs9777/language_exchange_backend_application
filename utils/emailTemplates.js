/**
 * Email Templates for Bananatalk
 * Beautiful, consistent email templates for all occasions
 */

const APP_NAME = 'Bananatalk';
const SUPPORT_EMAIL = 'support@banatalk.com';
const YEAR = new Date().getFullYear();

// Base template wrapper
// `unsubscribeUrl` is optional — only promotional/digest emails should pass
// it. Transactional emails (verification/reset/security) must pass nothing
// so no unsubscribe link is rendered (correct: transactional mail must not
// carry unsubscribe).
const baseTemplate = (content, accentColor = '#667eea', unsubscribeUrl = null) => `
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
              ${unsubscribeUrl ? `
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #999999;">
                <a href="${unsubscribeUrl}" style="color: #999999; text-decoration: underline;">Unsubscribe</a>
              </p>
              ` : ''}
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
        <h1 style="color: #ffffff; margin: 0; font-size: 36px; font-weight: bold;">Welcome to ${APP_NAME}</h1>
        <p style="color: rgba(255,255,255,0.9); font-size: 18px; margin: 15px 0 0 0;">Practice languages with people who actually speak them</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>, your account is ready — you can start practicing with native speakers right now.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9ff; border-radius: 12px; padding: 25px; margin: 25px 0;">
          <tr>
            <td>
              <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 18px;">Here's what you can do:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #555555; line-height: 2;">
                <li>Chat with native speakers of the language you're learning</li>
                <li>Get corrections on your messages from the community</li>
                <li>Share moments and practice writing in your target language</li>
                <li>Save words and phrases to your vocabulary deck</li>
              </ul>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="https://banatalk.com/explore" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                Find a language partner
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: `Welcome to ${APP_NAME}, ${userName}!`,
    html: baseTemplate(content),
    text: `Hi ${userName}, your ${APP_NAME} account is ready — you can start practicing with native speakers right now.

Here's what you can do:
- Chat with native speakers of the language you're learning
- Get corrections on your messages from the community
- Share moments and practice writing in your target language
- Save words and phrases to your vocabulary deck

Find a language partner: https://banatalk.com/explore`
  };
};

/**
 * Password changed confirmation email
 */
exports.passwordChangedEmail = (userName, deviceInfo = {}) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">Password updated</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>, your ${APP_NAME} password was changed on <strong>${new Date().toLocaleString()}</strong>.
        </p>

        ${deviceInfo.device ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fff4; border: 1px solid #38ef7d; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                <strong>Device:</strong> ${deviceInfo.device || 'Unknown'}
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                <strong>IP address:</strong> ${deviceInfo.ipAddress || 'Unknown'}
              </p>
              <p style="margin: 0; font-size: 14px; color: #666666;">
                <strong>Location:</strong> ${deviceInfo.location || 'Unknown'}
              </p>
            </td>
          </tr>
        </table>
        ` : ''}

        <p style="font-size: 14px; color: #666666; line-height: 1.6; margin: 0 0 25px 0;">
          If you made this change, you're all set — no action is needed.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                <strong>Didn't change your password?</strong> <a href="https://banatalk.com/forgot-password" style="color: #856404; font-weight: bold;">Reset it now</a> and contact ${SUPPORT_EMAIL}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: `Your ${APP_NAME} password was changed`,
    html: baseTemplate(content, '#11998e'),
    text: `Hi ${userName}, your ${APP_NAME} password was changed on ${new Date().toLocaleString()}. If you made this change, no action is needed.

Didn't change your password? Reset it now at https://banatalk.com/forgot-password and contact ${SUPPORT_EMAIL}.`
  };
};

/**
 * Login from new device notification
 */
exports.newLoginEmail = (userName, deviceInfo = {}) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">New sign-in to your account</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>, your ${APP_NAME} account was just signed in to from a new device.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e3f2fd; border: 1px solid #4facfe; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;">
                <strong>Time:</strong> ${new Date().toLocaleString()}
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;">
                <strong>Device:</strong> ${deviceInfo.device || 'Unknown device'}
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;">
                <strong>IP address:</strong> ${deviceInfo.ipAddress || 'Unknown'}
              </p>
              <p style="margin: 0; font-size: 14px; color: #333333;">
                <strong>Location:</strong> ${deviceInfo.location || 'Unknown location'}
              </p>
            </td>
          </tr>
        </table>

        <p style="font-size: 14px; color: #666666; line-height: 1.6; margin: 0 0 25px 0;">
          If this was you, you can ignore this email.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                <strong>Don't recognize this sign-in?</strong> <a href="https://banatalk.com/forgot-password" style="color: #856404; font-weight: bold;">Reset your password</a> to secure your account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: `New sign-in to your ${APP_NAME} account`,
    html: baseTemplate(content, '#4facfe'),
    text: `Hi ${userName}, your ${APP_NAME} account was just signed in to from ${deviceInfo.device || 'an unknown device'} (${deviceInfo.location || 'unknown location'}) at ${new Date().toLocaleString()}.

If this was you, you can ignore this email.

Don't recognize this sign-in? Reset your password to secure your account: https://banatalk.com/forgot-password`
  };
};

/**
 * Account inactivity follow-up (friendly reminder)
 */
exports.deactivationWarning = (userName, daysRemaining = 14, unsubscribeUrl = null) => {
  let subject, headerText, bodyHtml, ctaText, ctaUrl, plainText;

  if (daysRemaining > 7) {
    // 21-day-inactive path (daysRemaining = 14)
    subject    = `Everything you've built is still here`;
    headerText = `Still here when you're ready`;
    ctaText    = `Log back in`;
    ctaUrl     = `https://banatalk.com`;
    plainText  = `Hi ${userName}, three weeks since your last BananaTalk session. Your account, conversations, and vocabulary are all saved. Log back in when you're ready: https://banatalk.com`;
    bodyHtml   = `
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>,
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          Three weeks away. Your conversation history, vocabulary deck, and learning progress are all saved exactly where you left them.
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          Language learning is a long game — it's fine to pause. Whenever you're ready to pick back up, just log in.
        </p>`;
  } else {
    // 28-day-inactive path (daysRemaining = 7)
    subject    = `One login keeps your BananaTalk account active`;
    headerText = `Account notice`;
    ctaText    = `Keep my account`;
    ctaUrl     = `https://banatalk.com`;
    plainText  = `Hi ${userName}, log in once to keep your BananaTalk account active. Your saved conversations and vocabulary will be there: https://banatalk.com`;
    bodyHtml   = `
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>,
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          Your account stays active with a single login. The conversations and vocabulary you've saved will be waiting.
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          Takes 10 seconds.
        </p>`;
  }

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">${headerText}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        ${bodyHtml}

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                ${ctaText}
              </a>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 12px; padding: 25px; margin: 30px 0;">
          <tr>
            <td align="center">
              <h3 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">Open Bananatalk</h3>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right: 10px;">
                    <a href="https://apps.apple.com/us/app/bananatalk-learn-meet-or-date/id6755862146" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
                      App Store
                    </a>
                  </td>
                  <td style="padding-left: 10px;">
                    <a href="https://play.google.com/store/apps/details?id=com.bananatalk.app" style="display: inline-block; background-color: #3DDC84; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
                      Google Play
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject,
    html: baseTemplate(content, '#ff9a9e', unsubscribeUrl),
    text: plainText
  };
};

// Alias for backward-compatibility with emailService.sendDeactivationWarning
exports.accountDeactivationWarning = exports.deactivationWarning;

// ===================== ENGAGEMENT EMAILS =====================

/**
 * Inactivity reminder (language-learning specific nudge)
 */
exports.inactivityReminder = (userName, daysSinceActive = 7, targetLanguage, unsubscribeUrl = null) => {
  const hasLang = targetLanguage && String(targetLanguage).trim();
  const langLabel      = hasLang ? targetLanguage : 'your language';  // mid-sentence
  const langPossessive = hasLang ? targetLanguage : 'language';       // after "Your "

  let subject, headerText, bodyHtml, ctaText, ctaUrl, plainText;

  if (daysSinceActive >= 14) {
    // 14-day path
    subject    = `Your vocabulary deck has been waiting two weeks`;
    headerText = `Two weeks away`;
    ctaText    = `Review my vocabulary`;
    ctaUrl     = `https://banatalk.com`;
    plainText  = `Hi ${userName}, two weeks since your last session. Your vocabulary deck is waiting. Open BananaTalk: https://banatalk.com`;
    bodyHtml   = `
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>,
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          Two weeks off means some of the words you saved are overdue for review. The vocabulary is still in your deck — it just needs a session to stick.
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          Open your study queue and spend 10 minutes. That's enough to get back on track.
        </p>`;
  } else {
    // 7-day path
    subject    = `Your ${langPossessive} practice paused — pick up where you left off`;
    headerText = `It's been a week`;
    ctaText    = `Start a 5-minute session`;
    ctaUrl     = `https://banatalk.com`;
    plainText  = `Hi ${userName}, it's been 7 days since your last BananaTalk session. Open the AI Tutor for a 5-minute ${langLabel} conversation: https://banatalk.com`;
    bodyHtml   = `
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>,
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          It's been 7 days since your last session. That's right around when new vocabulary starts to slip — but you're still in the window where one short practice brings it back.
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          Easiest way in: open the AI Tutor and have a 5-minute conversation in ${langLabel}. No prep needed — just start talking.
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          Your saved words and open conversations will be there too.
        </p>`;
  }

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">${headerText}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        ${bodyHtml}

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                ${ctaText}
              </a>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 12px; padding: 25px; margin: 30px 0;">
          <tr>
            <td align="center">
              <h3 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">Open Bananatalk</h3>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right: 10px;">
                    <a href="https://apps.apple.com/us/app/bananatalk-learn-meet-or-date/id6755862146" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
                      App Store
                    </a>
                  </td>
                  <td style="padding-left: 10px;">
                    <a href="https://play.google.com/store/apps/details?id=com.bananatalk.app" style="display: inline-block; background-color: #3DDC84; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
                      Google Play
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject,
    html: baseTemplate(content, '#f5576c', unsubscribeUrl),
    text: plainText
  };
};

/**
 * Weekly digest email
 */
exports.weeklyDigest = (userName, stats = {}, unsubscribeUrl = null) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); padding: 40px; text-align: center;">
        <h1 style="color: #333333; margin: 0; font-size: 32px; font-weight: bold;">Your week on BananaTalk</h1>
        <p style="color: #555555; font-size: 16px; margin: 10px 0 0 0;">Week of ${new Date().toLocaleDateString()}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 25px 0;">
          Hi <strong>${userName}</strong>, here's what you did this week:
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
          <tr>
            <td style="padding: 10px; text-align: center; width: 50%;">
              <div style="font-size: 32px; font-weight: bold; color: #333;">${stats.wordsReviewed || 0}</div>
              <div style="font-size: 13px; color: #777;">words reviewed</div>
            </td>
            <td style="padding: 10px; text-align: center; width: 50%;">
              <div style="font-size: 32px; font-weight: bold; color: #333;">${stats.wordsSaved || 0}</div>
              <div style="font-size: 13px; color: #777;">new words saved</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #333;">${stats.messagesSent || 0}</div>
              <div style="font-size: 13px; color: #777;">messages with partners</div>
            </td>
            <td style="padding: 10px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #333;">${stats.correctionsExchanged || 0}</div>
              <div style="font-size: 13px; color: #777;">corrections exchanged</div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="https://banatalk.com/profile/stats" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                See your full progress
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: `Your language learning week`,
    html: baseTemplate(content, '#667eea', unsubscribeUrl),
    text: `Hi ${userName}, here's your week on BananaTalk: ${stats.wordsReviewed || 0} words reviewed, ${stats.wordsSaved || 0} new words saved, ${stats.messagesSent || 0} messages with partners, ${stats.correctionsExchanged || 0} corrections exchanged.

See your full progress: https://banatalk.com/profile/stats`
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
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">You have a new follower</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px; text-align: center;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 25px 0;">
          Hi <strong>${userName}</strong>, <strong>${followerName}</strong> started following you on ${APP_NAME}.
        </p>

        ${followerImage ? `
        <img src="${followerImage}" alt="${followerName}" style="width: 80px; height: 80px; border-radius: 50%; margin: 20px 0; border: 4px solid #667eea;">
        ` : ''}

        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 20px 0;">
          A new follower is a good opening for a language exchange — say hello and see if your languages match.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="https://banatalk.com/messages/new/${followerName}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                Say hello
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: `${followerName} started following you on ${APP_NAME}`,
    html: baseTemplate(content),
    text: `Hi ${userName}, ${followerName} started following you on ${APP_NAME}. A new follower is a good opening for a language exchange — say hello and see if your languages match: https://banatalk.com/messages`
  };
};

/**
 * New message notification (for users not actively using the app)
 */
exports.newMessageEmail = (userName, senderName, messagePreview) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">You have a new message</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>, <strong>${senderName}</strong> sent you a message on ${APP_NAME}:
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
                Reply on ${APP_NAME}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: `New message from ${senderName} on ${APP_NAME}`,
    html: baseTemplate(content, '#4facfe'),
    text: `Hi ${userName}, ${senderName} sent you a message on ${APP_NAME}: "${messagePreview}"

Reply: https://banatalk.com/messages`
  };
};

/**
 * Correction received notification (HelloTalk style)
 */
exports.correctionReceivedEmail = (userName, correctorName, originalText, correctedText) => {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">You received a correction</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>, <strong>${correctorName}</strong> suggested a correction to one of your messages. Here's what changed:
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
                See the correction
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: `${correctorName} suggested a correction on ${APP_NAME}`,
    html: baseTemplate(content, '#fa709a'),
    text: `Hi ${userName}, ${correctorName} suggested a correction to one of your messages on ${APP_NAME}.

Original: "${originalText}"
Corrected: "${correctedText}"

See the correction: https://banatalk.com/messages`
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
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">Your VIP membership is active</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>, your ${APP_NAME} VIP <strong>${plan}</strong> plan is now active. Thanks for supporting ${APP_NAME}.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-radius: 12px; padding: 25px; margin: 25px 0;">
          <tr>
            <td>
              <h3 style="color: #f7971e; margin: 0 0 15px 0; font-size: 18px;">What's included:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #555555; line-height: 2;">
                <li>Unlimited messages per day</li>
                <li>No ads</li>
                <li>Message translations</li>
                <li>Advanced search filters</li>
                <li>VIP badge</li>
                <li>Priority support</li>
              </ul>
            </td>
          </tr>
        </table>

        <p style="font-size: 14px; color: #666666; text-align: center;">
          Your subscription is active until <strong>${new Date(endDate).toLocaleDateString()}</strong>.
        </p>
      </td>
    </tr>
  `;

  return {
    subject: `Welcome to ${APP_NAME} VIP, ${userName}`,
    html: baseTemplate(content, '#f7971e'),
    text: `Hi ${userName}, your ${APP_NAME} VIP ${plan} plan is now active. What's included: unlimited messages per day, no ads, message translations, advanced search filters, VIP badge, and priority support. Your subscription is active until ${new Date(endDate).toLocaleDateString()}.`
  };
};

// ===================== ADMIN EMAILS =====================

/**
 * Enhanced Daily admin report email
 */
exports.adminDailyReportEmail = (stats) => {
  // Helper to format numbers
  const formatNum = (n) => (n || 0).toLocaleString();

  // Helper to format growth indicator
  const growthIndicator = (rate) => {
    if (rate > 0) return `<span style="color: #11998e;">+${rate}%</span>`;
    if (rate < 0) return `<span style="color: #f5576c;">${rate}%</span>`;
    return `<span style="color: #888;">0%</span>`;
  };

  // Format demographics list
  const formatList = (items, limit = 5) => {
    if (!items || items.length === 0) return '<em style="color: #888;">No data</em>';
    return items.slice(0, limit).map(item =>
      `<span style="display: inline-block; background: #f0f0f0; padding: 4px 10px; border-radius: 12px; margin: 3px; font-size: 13px;">${item._id || 'Unknown'}: ${item.count}</span>`
    ).join('');
  };

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Daily Admin Report</h1>
        <p style="color: rgba(255,255,255,0.9); font-size: 15px; margin: 10px 0 0 0;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 30px;">

        <!-- Backend Health -->
        ${stats.backendHealth ? `
        <h2 style="color: #1e3c72; margin: 0 0 15px 0; font-size: 18px;">Server Health</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); border-radius: 10px; padding: 15px; margin-bottom: 20px;">
          <tr>
            <td style="color: #fff; padding: 8px;">
              <strong>Uptime:</strong> ${stats.backendHealth.uptime} &nbsp;|&nbsp;
              <strong>Memory:</strong> ${stats.backendHealth.memory?.heapUsed} / ${stats.backendHealth.memory?.heapTotal} &nbsp;|&nbsp;
              <strong>CPU Load:</strong> ${stats.backendHealth.cpu?.loadAvg1m} &nbsp;|&nbsp;
              <strong>DB Connections:</strong> ${stats.backendHealth.database?.connections || 'N/A'}
            </td>
          </tr>
        </table>
        ` : ''}

        <!-- User Stats Grid -->
        <h2 style="color: #1e3c72; margin: 0 0 15px 0; font-size: 18px;">User Statistics</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
          <tr>
            <td width="25%" style="padding: 5px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; padding: 15px; text-align: center;">
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff;">${formatNum(stats.users?.registered || stats.totalUsers)}</p>
                <p style="margin: 3px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.9);">Total Users</p>
              </div>
            </td>
            <td width="25%" style="padding: 5px;">
              <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); border-radius: 10px; padding: 15px; text-align: center;">
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff;">${formatNum(stats.users?.newToday || stats.newUsersToday)}</p>
                <p style="margin: 3px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.9);">New Today</p>
              </div>
            </td>
            <td width="25%" style="padding: 5px;">
              <div style="background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%); border-radius: 10px; padding: 15px; text-align: center;">
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff;">${formatNum(stats.users?.activeToday || stats.activeUsersToday)}</p>
                <p style="margin: 3px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.9);">Active Today</p>
              </div>
            </td>
            <td width="25%" style="padding: 5px;">
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 10px; padding: 15px; text-align: center;">
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff;">${stats.users?.retentionRate || 0}%</p>
                <p style="margin: 3px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.9);">Retention</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- User Details Table -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9ff; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
          <tr><td>
            <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px;">
              <tr>
                <td style="color: #555;">New Yesterday:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.users?.newYesterday)}</td>
                <td style="color: #555; padding-left: 20px;">This Week:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.users?.newThisWeek || stats.newUsersThisWeek)}</td>
              </tr>
              <tr>
                <td style="color: #555;">Active This Week:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.users?.activeThisWeek)}</td>
                <td style="color: #555; padding-left: 20px;">This Month:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.users?.activeThisMonth)}</td>
              </tr>
              <tr>
                <td style="color: #555;">Incomplete Registrations:</td>
                <td style="color: #f7971e; font-weight: bold; text-align: right;">${formatNum(stats.users?.incompleteRegistrations)}</td>
                <td style="color: #555; padding-left: 20px;">Growth Rate:</td>
                <td style="font-weight: bold; text-align: right;">${growthIndicator(stats.users?.growthRate)}</td>
              </tr>
            </table>
          </td></tr>
        </table>

        <!-- VIP Stats -->
        <h2 style="color: #1e3c72; margin: 0 0 15px 0; font-size: 18px;">VIP Subscriptions</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff8e1; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
          <tr><td>
            <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px;">
              <tr>
                <td style="color: #555;">Total VIP:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.vip?.totalVip || stats.totalVipUsers)}</td>
                <td style="color: #555; padding-left: 20px;">Conversion Rate:</td>
                <td style="color: #11998e; font-weight: bold; text-align: right;">${stats.vip?.conversionRate || 0}%</td>
              </tr>
              <tr>
                <td style="color: #555;">New VIP Today:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.vip?.newVipToday || stats.newVipToday)}</td>
                <td style="color: #555; padding-left: 20px;">New This Week:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.vip?.newVipThisWeek)}</td>
              </tr>
              <tr>
                <td style="color: #555;">Expiring in 7 Days:</td>
                <td style="color: #f7971e; font-weight: bold; text-align: right;">${formatNum(stats.vip?.expiringIn7Days || stats.expiringVipSoon)}</td>
                <td style="color: #555; padding-left: 20px;">Expired This Week:</td>
                <td style="color: #f5576c; font-weight: bold; text-align: right;">${formatNum(stats.vip?.expiredThisWeek)}</td>
              </tr>
            </table>
          </td></tr>
        </table>

        <!-- Engagement Stats -->
        <h2 style="color: #1e3c72; margin: 0 0 15px 0; font-size: 18px;">Engagement</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fff4; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
          <tr><td>
            <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px;">
              <tr>
                <td style="color: #555;">Messages Today:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.engagement?.messages?.today || stats.messagesToday)}</td>
                <td style="color: #555; padding-left: 20px;">Per Active User:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${stats.engagement?.messages?.perActiveUser || 0}</td>
              </tr>
              <tr>
                <td style="color: #555;">Messages This Week:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.engagement?.messages?.thisWeek)}</td>
                <td style="color: #555; padding-left: 20px;">Total Messages:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.engagement?.messages?.total)}</td>
              </tr>
              <tr>
                <td style="color: #555;">Calls Today:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.engagement?.calls?.callsToday)}</td>
                <td style="color: #555; padding-left: 20px;">Avg Duration:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${stats.engagement?.calls?.avgCallDuration || 0}s</td>
              </tr>
              <tr>
                <td style="color: #555;">Moments Today:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.engagement?.content?.momentsToday || stats.momentsToday)}</td>
                <td style="color: #555; padding-left: 20px;">Stories Today:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.engagement?.content?.storiesToday || stats.storiesToday)}</td>
              </tr>
              <tr>
                <td style="color: #555;">New Conversations:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.engagement?.conversations?.newToday)}</td>
                <td style="color: #555; padding-left: 20px;">Voice Rooms Active:</td>
                <td style="color: #333; font-weight: bold; text-align: right;">${formatNum(stats.engagement?.voiceRooms?.activeRooms)}</td>
              </tr>
            </table>
          </td></tr>
        </table>

        <!-- Demographics -->
        ${stats.demographics ? `
        <h2 style="color: #1e3c72; margin: 0 0 15px 0; font-size: 18px;">User Demographics</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf5ff; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
          <tr><td>
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #555;"><strong>Top Native Languages:</strong></p>
            <p style="margin: 0 0 12px 0;">${formatList(stats.demographics.byNativeLanguage)}</p>
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #555;"><strong>Top Learning Languages:</strong></p>
            <p style="margin: 0 0 12px 0;">${formatList(stats.demographics.byLearningLanguage)}</p>
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #555;"><strong>Top Countries:</strong></p>
            <p style="margin: 0;">${formatList(stats.demographics.byCountry)}</p>
          </td></tr>
        </table>
        ` : ''}

        <!-- New Users List -->
        ${stats.newUsersList && stats.newUsersList.length > 0 ? `
        <h2 style="color: #1e3c72; margin: 0 0 15px 0; font-size: 18px;">New Users Today (${stats.newUsersList.length})</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; font-size: 12px;">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: 1px solid #e0e0e0;">Name</td>
            <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: 1px solid #e0e0e0;">Email</td>
            <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: 1px solid #e0e0e0;">Languages</td>
            <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: 1px solid #e0e0e0;">Status</td>
          </tr>
          ${stats.newUsersList.map(user => `
          <tr>
            <td style="padding: 8px; color: #555; border-bottom: 1px solid #f0f0f0;">${user.name}${user.username ? ` <span style="color: #11998e;">@${user.username}</span>` : ''}</td>
            <td style="padding: 8px; color: #555; border-bottom: 1px solid #f0f0f0;">${user.email}</td>
            <td style="padding: 8px; color: #555; border-bottom: 1px solid #f0f0f0;">${user.native_language || '?'} → ${user.language_to_learn || '?'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${user.isRegistrationComplete ? '<span style="color: #11998e;">Complete</span>' : '<span style="color: #f7971e;">Incomplete</span>'}</td>
          </tr>
          `).join('')}
        </table>
        ` : '<p style="color: #888; font-style: italic;">No new users today.</p>'}

        <p style="font-size: 12px; color: #888888; text-align: center; margin: 25px 0 0 0;">
          Generated at ${new Date().toLocaleString()} | ${APP_NAME} Admin Report
        </p>
      </td>
    </tr>
  `;

  return {
    subject: `[${APP_NAME}] Daily Report - ${new Date().toLocaleDateString()} | ${formatNum(stats.users?.newToday || stats.newUsersToday)} new users`,
    html: baseTemplate(content, '#1e3c72'),
    text: `${APP_NAME} Daily Report
Total Users: ${formatNum(stats.users?.registered || stats.totalUsers)}
New Users Today: ${formatNum(stats.users?.newToday || stats.newUsersToday)}
Active Users: ${formatNum(stats.users?.activeToday || stats.activeUsersToday)}
Retention Rate: ${stats.users?.retentionRate || 0}%
VIP Users: ${formatNum(stats.vip?.totalVip || stats.totalVipUsers)}
Messages Today: ${formatNum(stats.engagement?.messages?.today || stats.messagesToday)}
Server Uptime: ${stats.backendHealth?.uptime || 'N/A'}`
  };
};

/**
 * New user registration notification for admin
 *
 * Redesigned layout — single scannable card with compact hero, stats strip,
 * profile / languages / location / bio / signup-tech / photos sections.
 * `context` is optional and carries request-time info (platform, device,
 * totalUsers) that the User document doesn't have.
 */
exports.newUserNotificationEmail = (user, context = {}) => {
  const images = Array.isArray(user.images)
    ? user.images.filter(img => img && typeof img === 'string' && img.startsWith('http'))
    : [];
  const profilePhoto = images.length > 0 ? images[0] : null;

  // ----- Computed display values -----
  const location = user.location || {};
  const locationStr = [location.city, location.state, location.country].filter(Boolean).join(', ') || '—';
  const hasCoords = Array.isArray(location.coordinates) && location.coordinates.length === 2;
  const mapsLink = hasCoords
    ? `https://www.google.com/maps?q=${location.coordinates[1]},${location.coordinates[0]}`
    : null;

  const birthDate = user.birth_year && user.birth_month && user.birth_day
    ? `${user.birth_year}-${String(user.birth_month).padStart(2, '0')}-${String(user.birth_day).padStart(2, '0')}`
    : null;

  // Age computed from birthdate, with a sanity floor (negative or >120 → null)
  let age = null;
  if (user.birth_year) {
    const now = new Date();
    const yearDiff = now.getFullYear() - parseInt(user.birth_year, 10);
    if (Number.isFinite(yearDiff) && yearDiff > 0 && yearDiff < 120) {
      const m = parseInt(user.birth_month, 10);
      const d = parseInt(user.birth_day, 10);
      const hadBirthdayThisYear = m && d
        ? (now.getMonth() + 1 > m) || (now.getMonth() + 1 === m && now.getDate() >= d)
        : true;
      age = hadBirthdayThisYear ? yearDiff : yearDiff - 1;
    }
  }

  // Auth provider — derived from which *Id field is populated
  const provider = user.googleId ? 'Google'
    : user.facebookId ? 'Facebook'
    : user.appleId ? 'Apple'
    : 'Email';

  // Platform badge — prefer the request-time value, fall back to persisted field
  const platform = (context.platform || user.signupPlatform || 'unknown').toLowerCase();
  const platformBadges = {
    ios:     { label: 'iOS',     emoji: '📱', color: '#007aff' },
    android: { label: 'Android', emoji: '🤖', color: '#3ddc84' },
    web:     { label: 'Web',     emoji: '🌐', color: '#6c757d' },
    unknown: { label: 'Unknown', emoji: '❔', color: '#999999' }
  };
  const pBadge = platformBadges[platform] || platformBadges.unknown;

  const totalUsers = Number.isFinite(context.totalUsers) ? context.totalUsers : null;
  const userOrdinal = totalUsers ? `#${totalUsers.toLocaleString()}` : null;

  const device = context.device || {};
  const userAgentShort = (device.userAgent || '').slice(0, 140);

  const isVip = !!user.vipSubscription?.isActive;
  const followersCount = Array.isArray(user.followers) ? user.followers.length : 0;
  const followingCount = Array.isArray(user.following) ? user.following.length : 0;

  // ----- Small reusable bits -----
  const row = (label, value) => `
    <tr>
      <td style="font-size:13px;color:#888;padding:6px 0;width:140px;">${label}</td>
      <td style="font-size:14px;color:#222;padding:6px 0;font-weight:500;">${value || '<span style="color:#bbb;font-weight:normal;">—</span>'}</td>
    </tr>`;

  const card = (title, accent, rowsHtml) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafbfc;border-left:3px solid ${accent};border-radius:8px;margin:14px 0;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:12px;font-weight:600;color:${accent};letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;">${title}</div>
        <table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
      </td></tr>
    </table>`;

  const statChip = (emoji, label, value) => `
    <td align="center" valign="top" style="padding:8px 4px;">
      <div style="font-size:20px;line-height:1;">${emoji}</div>
      <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-top:6px;">${label}</div>
      <div style="font-size:14px;color:#222;font-weight:600;margin-top:2px;">${value || '—'}</div>
    </td>`;

  // ----- Sections -----
  const heroAvatar = profilePhoto
    ? `<a href="${profilePhoto}" target="_blank"><img src="${profilePhoto}" alt="${user.name}" style="width:84px;height:84px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.15);"></a>`
    : `<div style="width:84px;height:84px;border-radius:50%;background:rgba(255,255,255,.25);text-align:center;line-height:84px;font-size:36px;color:#fff;">👤</div>`;

  const heroBadgesHtml = `
    <span style="display:inline-block;background:rgba(255,255,255,.22);color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;margin-right:6px;">${pBadge.emoji} ${pBadge.label}</span>
    <span style="display:inline-block;background:rgba(255,255,255,.22);color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;margin-right:6px;">${provider}</span>
    ${isVip ? `<span style="display:inline-block;background:#f7971e;color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;margin-right:6px;">👑 VIP</span>` : ''}
    ${userOrdinal ? `<span style="display:inline-block;background:rgba(255,255,255,.22);color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;">User ${userOrdinal}</span>` : ''}
  `;

  const statsStripHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;border-radius:8px;margin:16px 0 8px 0;">
      <tr>
        ${statChip('🎂', 'Age', age ?? '—')}
        ${statChip('⚧', 'Gender', user.gender || '—')}
        ${statChip('🌍', 'Country', location.country || '—')}
        ${statChip('🗣️', 'Native', user.native_language || '—')}
        ${statChip('🎯', 'Learning', user.language_to_learn || '—')}
      </tr>
    </table>`;

  const accountRows =
    row('User ID', `<span style="font-family:monospace;font-size:12px;">${user._id || ''}</span>`) +
    row('Username', user.username ? `@${user.username}` : '') +
    row('Email', `<a href="mailto:${user.email}" style="color:#11998e;text-decoration:none;">${user.email}</a>`) +
    row('Auth Provider', provider) +
    row('Account Created', user.createdAt ? new Date(user.createdAt).toLocaleString() : '') +
    row('Email Verified', user.isEmailVerified ? '✅ Yes' : '❌ No') +
    row('Terms Accepted', user.termsAccepted ? `✅ Yes${user.termsAcceptedDate ? ` (${new Date(user.termsAcceptedDate).toLocaleDateString()})` : ''}` : '❌ No') +
    row('User Mode', user.userMode || 'regular') +
    row('VIP', isVip ? `👑 ${user.vipSubscription.plan || 'Active'}` : 'No') +
    row('Followers / Following', `${followersCount} / ${followingCount}`);

  const profileRows =
    row('Birth Date', birthDate) +
    row('Age', age) +
    row('Gender', user.gender) +
    row('MBTI', user.mbti) +
    row('Blood Type', user.bloodType) +
    row('Occupation', user.occupation) +
    row('School', user.school);

  const langRows =
    row('Native Language', user.native_language) +
    row('Learning', user.language_to_learn);

  const locationRows =
    row('Address', location.formattedAddress) +
    row('City', location.city) +
    row('State / Region', location.state) +
    row('Country', location.country) +
    row('Coordinates', hasCoords
      ? `<a href="${mapsLink}" target="_blank" style="color:#11998e;text-decoration:none;">${location.coordinates[1].toFixed(4)}, ${location.coordinates[0].toFixed(4)} ↗</a>`
      : '');

  const bioHtml = user.bio
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff9e6;border-left:3px solid #f7971e;border-radius:8px;margin:14px 0;">
         <tr><td style="padding:16px 20px;">
           <div style="font-size:12px;font-weight:600;color:#f7971e;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;">Bio</div>
           <div style="font-size:14px;color:#333;line-height:1.6;font-style:italic;">“${user.bio}”</div>
         </td></tr>
       </table>`
    : '';

  // Prefer the rich device fields (deviceModel/osVersion/appVersion) when the
  // Flutter client sent them via clientInfo; fall back to the UA-derived
  // device bucket otherwise.
  const appVersionLabel = device.appVersion
    ? `${device.appVersion}${device.appBuild ? ` (${device.appBuild})` : ''}`
    : '';
  const signupTechRows =
    row('Platform', `${pBadge.emoji} <span style="color:${pBadge.color};font-weight:600;">${pBadge.label}</span>`) +
    row('Device', device.deviceModel || device.device) +
    row('OS Version', device.osVersion) +
    row('App Version', appVersionLabel) +
    row('IP Address', device.ipAddress ? `<span style="font-family:monospace;font-size:12px;">${device.ipAddress}</span>` : '') +
    row('User Agent', userAgentShort ? `<span style="font-family:monospace;font-size:11px;color:#555;word-break:break-all;">${userAgentShort}</span>` : '');

  const photosHtml = images.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;">
         <tr><td style="padding:0;">
           <div style="font-size:12px;font-weight:600;color:#11998e;letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px;">Photos (${images.length})</div>
           <table cellpadding="0" cellspacing="6"><tr>
             ${images.slice(0, 6).map((img) => `
               <td valign="top">
                 <a href="${img}" target="_blank"><img src="${img}" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #e0e0e0;display:block;"></a>
               </td>`).join('')}
           </tr></table>
           ${images.length > 6 ? `<div style="font-size:12px;color:#999;margin-top:8px;">+${images.length - 6} more</div>` : ''}
         </td></tr>
       </table>`
    : '';

  // ----- Compose -----
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 28px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="94" valign="top">${heroAvatar}</td>
            <td valign="top" style="padding-left:18px;">
              <div style="color:rgba(255,255,255,.85);font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">New User Joined</div>
              <h1 style="color:#fff;margin:4px 0 2px 0;font-size:22px;line-height:1.2;">${user.name || 'Unnamed'}</h1>
              <div style="color:rgba(255,255,255,.9);font-size:13px;margin-bottom:10px;">@${user.username || 'no-username'} · ${user.email}</div>
              ${heroBadgesHtml}
              <div style="color:rgba(255,255,255,.75);font-size:11px;margin-top:10px;">${new Date().toLocaleString()}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 30px;">
        ${statsStripHtml}
        ${card('Account', '#11998e', accountRows)}
        ${card('Profile', '#5865f2', profileRows)}
        ${card('Languages', '#38ef7d', langRows)}
        ${card('Location', '#11998e', locationRows)}
        ${bioHtml}
        ${card('Signup Environment', '#999999', signupTechRows)}
        ${photosHtml}
        <p style="font-size:12px;color:#999;text-align:center;margin:24px 0 0 0;">
          Automated admin notification · ${APP_NAME}
        </p>
      </td>
    </tr>
  `;

  // Plain-text fallback — kept structured but compact
  const textLines = [
    `New user joined ${APP_NAME}`,
    `─────────────────────────`,
    `Name:        ${user.name || '—'}`,
    `Username:    @${user.username || '—'}`,
    `Email:       ${user.email}`,
    `Provider:    ${provider}`,
    `Platform:    ${pBadge.label}`,
    userOrdinal ? `User #:      ${userOrdinal}` : null,
    `Age:         ${age ?? '—'}`,
    `Gender:      ${user.gender || '—'}`,
    `Birth Date:  ${birthDate || '—'}`,
    `MBTI:        ${user.mbti || '—'}`,
    `Blood Type:  ${user.bloodType || '—'}`,
    `Occupation:  ${user.occupation || '—'}`,
    `School:      ${user.school || '—'}`,
    `Native:      ${user.native_language || '—'}`,
    `Learning:    ${user.language_to_learn || '—'}`,
    `Location:    ${locationStr}`,
    `VIP:         ${isVip ? (user.vipSubscription.plan || 'Active') : 'No'}`,
    `Verified:    ${user.isEmailVerified ? 'Yes' : 'No'}`,
    `Created:     ${user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}`,
    `Device:      ${device.deviceModel || device.device || '—'}`,
    device.osVersion ? `OS:          ${device.osVersion}` : null,
    appVersionLabel ? `App:         ${appVersionLabel}` : null,
    `IP:          ${device.ipAddress || '—'}`,
    `User-Agent:  ${userAgentShort || '—'}`,
    `Bio:         ${user.bio || '—'}`,
    images.length ? `Photos:      ${images.length}\n  - ${images.join('\n  - ')}` : `Photos:      None`
  ].filter(Boolean);

  return {
    subject: `[${APP_NAME}] ${pBadge.emoji} ${user.name || 'New user'} (@${user.username || '?'}) · ${pBadge.label}${userOrdinal ? ` · ${userOrdinal}` : ''}`,
    html: baseTemplate(content, '#11998e'),
    text: textLines.join('\n')
  };
};

/**
 * Promotional email template
 */
exports.promotionalEmail = (userName, { title, message, ctaText, ctaUrl, iosUrl, androidUrl, unsubscribeUrl }) => {
  // The campaign message is authored as plain text with newlines (see
  // PROMO_CONFIG in jobs/promotionalEmailJob.js) — convert them to <br>
  // so paragraphs/bullets actually render in the HTML part.
  const messageHtml = String(message || '').replace(/\n/g, '<br>');
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #FFD93D 0%, #FF6B6B 50%, #6BCB77 100%); padding: 50px 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">${title}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>,
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          ${messageHtml}
        </p>

        ${ctaText && ctaUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                ${ctaText}
              </a>
            </td>
          </tr>
        </table>
        ` : ''}

        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f8f9ff 0%, #fff5f5 100%); border-radius: 12px; padding: 25px; margin: 25px 0;">
          <tr>
            <td style="text-align: center;">
              <h3 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">Get the app</h3>
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 0 10px;">
                    <a href="${iosUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
                      App Store
                    </a>
                  </td>
                  <td style="padding: 0 10px;">
                    <a href="${androidUrl}" style="display: inline-block; background-color: #3DDC84; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
                      Google Play
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="font-size: 14px; color: #888888; text-align: center; margin: 25px 0 0 0;">
          See you on ${APP_NAME}.
        </p>
      </td>
    </tr>
  `;

  return {
    subject: title,
    html: baseTemplate(content, '#FFD93D', unsubscribeUrl),
    text: `Hi ${userName},

${message}

Get the app:
iOS: ${iosUrl}
Android: ${androidUrl}`
  };
};

// ===================== SAFETY WAVE EMAILS (Step 14) =====================

/**
 * Admin alert for a new report — per-report notification (in addition
 * to the daily admin digest). Lets admins respond to high-priority
 * issues without waiting for the digest.
 */
exports.adminReportAlert = (report, reporterName, reportedUserName) => ({
  subject: `[Report] ${report.reason} — ${reportedUserName}`,
  text: `New report against ${reportedUserName} by ${reporterName}.

Reason: ${report.reason}
Priority: ${report.priority || 'normal'}
Description: ${report.description || '(none)'}

View in admin: ${process.env.APP_URL || 'https://banatalk.com'}/admin/reports/${report._id}

This is an automated alert. The full report is also included in
the daily admin digest.`,
  html: `<p><strong>New report</strong> against ${reportedUserName} by ${reporterName}.</p>
<ul>
  <li>Reason: ${report.reason}</li>
  <li>Priority: ${report.priority || 'normal'}</li>
  <li>Description: ${report.description || '(none)'}</li>
</ul>
<p>View in admin: <a href="${process.env.APP_URL || 'https://banatalk.com'}/admin/reports/${report._id}">${report._id}</a></p>`
});

/**
 * Confirmation to the reporter after the moderator acts on the report.
 * Deliberately vague about the action taken (privacy of the reported user).
 */
exports.reportResolutionToReporter = (report) => ({
  subject: 'Your report has been reviewed',
  text: `We've reviewed the report you submitted on ${new Date(report.createdAt).toDateString()} and taken appropriate action where warranted.

For privacy reasons we don't share specific outcomes, but every report helps keep ${APP_NAME} safe.

Thank you for helping the community.`,
  html: baseTemplate(`
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="color: #333; margin: 0 0 15px 0;">Your report has been reviewed</h2>
        <p style="font-size: 16px; color: #555; line-height: 1.7;">We've reviewed the report you submitted on ${new Date(report.createdAt).toDateString()} and taken appropriate action where warranted.</p>
        <p style="font-size: 16px; color: #555; line-height: 1.7;">For privacy reasons we don't share specific outcomes, but every report helps keep ${APP_NAME} safe.</p>
        <p style="font-size: 16px; color: #555; line-height: 1.7;">Thank you for helping the community.</p>
      </td>
    </tr>`, '#11998e')
});

/**
 * Notification to a banned user explaining the ban + appeal contact.
 */
exports.banNotification = (reason) => ({
  subject: `Your ${APP_NAME} account has been suspended`,
  text: `Your ${APP_NAME} account has been suspended following a review of reports made against it.

${reason ? `Reason: ${reason}\n\n` : ''}If you believe this decision was made in error, contact appeal@banatalk.com with your username and we'll take another look.`,
  html: baseTemplate(`
    <tr>
      <td style="background: linear-gradient(135deg, #ff7e7e 0%, #d63031 100%); padding: 40px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 28px;">Account suspended</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #555; line-height: 1.7;">Your ${APP_NAME} account has been suspended following a review of reports made against it.</p>
        ${reason ? `<p style="font-size: 16px; color: #555; line-height: 1.7;"><strong>Reason:</strong> ${reason}</p>` : ''}
        <p style="font-size: 16px; color: #555; line-height: 1.7;">If you believe this decision was made in error, contact <a href="mailto:appeal@banatalk.com" style="color: #d63031;">appeal@banatalk.com</a> with your username and we'll take another look.</p>
      </td>
    </tr>`, '#d63031')
});

// Step 15 — restored-account notification, mirrors banNotification.
exports.unbanNotification = (reason) => ({
  subject: `Your ${APP_NAME} account has been restored`,
  text: `Good news — your ${APP_NAME} account has been restored and you can log in again now.

${reason ? `Reason: ${reason}\n\n` : ''}If you have any questions, contact support@banatalk.com.`,
  html: baseTemplate(`
    <tr>
      <td style="background: linear-gradient(135deg, #4cd964 0%, #11998e 100%); padding: 40px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 28px;">Account restored</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #555; line-height: 1.7;">Good news — your ${APP_NAME} account has been restored and you can log in again now.</p>
        ${reason ? `<p style="font-size: 16px; color: #555; line-height: 1.7;"><strong>Reason:</strong> ${reason}</p>` : ''}
        <p style="font-size: 16px; color: #555; line-height: 1.7;">If you have any questions, contact <a href="mailto:support@banatalk.com" style="color: #11998e;">support@banatalk.com</a>.</p>
      </td>
    </tr>`, '#11998e')
});

module.exports = exports;

