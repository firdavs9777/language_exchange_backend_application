/**
 * Email Templates for Bananatalk
 * Beautiful, consistent email templates for all occasions
 */

const { t, isRtl } = require('../services/emailTemplateService');

const APP_NAME = 'Bananatalk';
const SUPPORT_EMAIL = 'support@banatalk.com';
const YEAR = new Date().getFullYear();

// All user-facing copy lives in email_templates/{locale}.json (per-key en
// fallback via services/emailTemplateService.js). This file keeps ONLY
// layout/HTML. Admin-facing templates further below stay hardcoded English.

// Base template wrapper
// `unsubscribeUrl` is optional — only promotional/digest/re-engagement mail
// should pass it. Transactional emails (verification/reset/security) must
// pass nothing so no unsubscribe link is rendered (correct: transactional
// mail must not carry unsubscribe).
// `locale` localizes footer strings; for RTL locales (ar) it sets dir="rtl"
// on the content container so text and layout flow right-to-left.
const baseTemplate = (content, accentColor = '#667eea', unsubscribeUrl = null, locale = 'en') => `
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
        <table width="600" cellpadding="0" cellspacing="0"${isRtl(locale) ? ' dir="rtl"' : ''} style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          ${content}
          <tr>
            <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                ${t(locale, 'common.needHelp')} <a href="mailto:${SUPPORT_EMAIL}" style="color: ${accentColor}; text-decoration: none;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                ${t(locale, 'common.rights', { year: YEAR, appName: APP_NAME })}
              </p>
              ${unsubscribeUrl ? `
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #999999;">
                <a href="${unsubscribeUrl}" style="color: #999999; text-decoration: underline;">${t(locale, 'common.unsubscribe')}</a>
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

// Shared "Open Bananatalk" store-buttons block (inactivity/deactivation).
const storeButtonsBlock = (locale) => `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 12px; padding: 25px; margin: 30px 0;">
          <tr>
            <td align="center">
              <h3 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">${t(locale, 'common.openApp')}</h3>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right: 10px;">
                    <a href="https://apps.apple.com/us/app/bananatalk-learn-meet-or-date/id6755862146" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
                      ${t(locale, 'common.appStore')}
                    </a>
                  </td>
                  <td style="padding-left: 10px;">
                    <a href="https://play.google.com/store/apps/details?id=com.bananatalk.app" style="display: inline-block; background-color: #3DDC84; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
                      ${t(locale, 'common.googlePlay')}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`;

// ===================== AUTHENTICATION EMAILS =====================

/**
 * Welcome email after first registration
 */
exports.welcomeEmail = (userName, locale = 'en') => {
  const vars = { userName, appName: APP_NAME };
  const varsHtml = { userName: `<strong>${userName}</strong>`, appName: APP_NAME };
  const features = t(locale, 'welcome.features');

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 36px; font-weight: bold;">${t(locale, 'welcome.heading', vars)}</h1>
        <p style="color: rgba(255,255,255,0.9); font-size: 18px; margin: 15px 0 0 0;">${t(locale, 'welcome.tagline', vars)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          ${t(locale, 'welcome.intro', varsHtml)}
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9ff; border-radius: 12px; padding: 25px; margin: 25px 0;">
          <tr>
            <td>
              <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 18px;">${t(locale, 'welcome.whatYouCanDo', vars)}</h3>
              <ul style="margin: 0; padding-left: 20px; color: #555555; line-height: 2;">
                ${features.map((f) => `<li>${f}</li>`).join('\n                ')}
              </ul>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="https://banatalk.com/explore" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                ${t(locale, 'welcome.cta', vars)}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: t(locale, 'welcome.subject', vars),
    html: baseTemplate(content, '#667eea', null, locale),
    text: `${t(locale, 'welcome.intro', vars)}

${t(locale, 'welcome.whatYouCanDo', vars)}
${features.map((f) => `- ${f}`).join('\n')}

${t(locale, 'welcome.cta', vars)}: https://banatalk.com/explore`
  };
};

/**
 * Password changed confirmation email
 */
exports.passwordChangedEmail = (userName, deviceInfo = {}, locale = 'en') => {
  const timestamp = new Date().toLocaleString();
  const resetUrl = 'https://banatalk.com/forgot-password';
  const vars = { userName, appName: APP_NAME, timestamp, supportEmail: SUPPORT_EMAIL, resetUrl };
  const varsHtml = {
    ...vars,
    userName: `<strong>${userName}</strong>`,
    timestamp: `<strong>${timestamp}</strong>`,
    resetLink: `<a href="${resetUrl}" style="color: #856404; font-weight: bold;">${t(locale, 'passwordChanged.notYouLinkLabel')}</a>`,
  };
  const unknown = t(locale, 'common.unknown');

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">${t(locale, 'passwordChanged.heading')}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          ${t(locale, 'passwordChanged.intro', varsHtml)}
        </p>

        ${deviceInfo.device ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fff4; border: 1px solid #38ef7d; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                <strong>${t(locale, 'common.deviceLabel')}</strong> ${deviceInfo.device || unknown}
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                <strong>${t(locale, 'common.ipLabel')}</strong> ${deviceInfo.ipAddress || unknown}
              </p>
              <p style="margin: 0; font-size: 14px; color: #666666;">
                <strong>${t(locale, 'common.locationLabel')}</strong> ${deviceInfo.location || unknown}
              </p>
            </td>
          </tr>
        </table>
        ` : ''}

        <p style="font-size: 14px; color: #666666; line-height: 1.6; margin: 0 0 25px 0;">
          ${t(locale, 'passwordChanged.allSet')}
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                ${t(locale, 'passwordChanged.notYouHtml', varsHtml)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: t(locale, 'passwordChanged.subject', vars),
    html: baseTemplate(content, '#11998e', null, locale),
    text: `${t(locale, 'passwordChanged.intro', vars)} ${t(locale, 'passwordChanged.allSet')}

${t(locale, 'passwordChanged.notYouText', vars)}`
  };
};

/**
 * Login from new device notification
 */
exports.newLoginEmail = (userName, deviceInfo = {}, locale = 'en') => {
  const timestamp = new Date().toLocaleString();
  const resetUrl = 'https://banatalk.com/forgot-password';
  const device = deviceInfo.device || t(locale, 'common.unknownDevice');
  const location = deviceInfo.location || t(locale, 'common.unknownLocation');
  const vars = { userName, appName: APP_NAME, timestamp, device, location, resetUrl };
  const varsHtml = {
    ...vars,
    userName: `<strong>${userName}</strong>`,
    resetLink: `<a href="${resetUrl}" style="color: #856404; font-weight: bold;">${t(locale, 'newLogin.notYouLinkLabel')}</a>`,
  };

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">${t(locale, 'newLogin.heading')}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          ${t(locale, 'newLogin.intro', varsHtml)}
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e3f2fd; border: 1px solid #4facfe; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;">
                <strong>${t(locale, 'common.timeLabel')}</strong> ${timestamp}
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;">
                <strong>${t(locale, 'common.deviceLabel')}</strong> ${device}
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;">
                <strong>${t(locale, 'common.ipLabel')}</strong> ${deviceInfo.ipAddress || t(locale, 'common.unknown')}
              </p>
              <p style="margin: 0; font-size: 14px; color: #333333;">
                <strong>${t(locale, 'common.locationLabel')}</strong> ${location}
              </p>
            </td>
          </tr>
        </table>

        <p style="font-size: 14px; color: #666666; line-height: 1.6; margin: 0 0 25px 0;">
          ${t(locale, 'newLogin.wasYou')}
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0;">
          <tr>
            <td>
              <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                ${t(locale, 'newLogin.notYouHtml', varsHtml)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: t(locale, 'newLogin.subject', vars),
    html: baseTemplate(content, '#4facfe', null, locale),
    text: `${t(locale, 'newLogin.textBody', vars)}

${t(locale, 'newLogin.wasYou')}

${t(locale, 'newLogin.notYouText', vars)}`
  };
};

/**
 * Account inactivity follow-up (friendly reminder)
 */
exports.deactivationWarning = (userName, daysRemaining = 14, unsubscribeUrl = null, locale = 'en') => {
  // key prefix: 21-day-inactive path (daysRemaining = 14) vs 28-day (= 7)
  const k = daysRemaining > 7 ? 'deactivation21' : 'deactivation28';
  const url = 'https://banatalk.com';
  const vars = { userName, appName: APP_NAME, url };
  const varsHtml = { ...vars, userName: `<strong>${userName}</strong>` };

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">${t(locale, `${k}.heading`)}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          ${t(locale, 'common.greeting', varsHtml)}
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          ${t(locale, `${k}.p1`)}
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          ${t(locale, `${k}.p2`)}
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                ${t(locale, `${k}.cta`)}
              </a>
            </td>
          </tr>
        </table>
${storeButtonsBlock(locale)}
      </td>
    </tr>
  `;

  return {
    subject: t(locale, `${k}.subject`),
    html: baseTemplate(content, '#ff9a9e', unsubscribeUrl, locale),
    text: t(locale, `${k}.text`, vars)
  };
};

// Alias for backward-compatibility with emailService.sendDeactivationWarning
exports.accountDeactivationWarning = exports.deactivationWarning;

// ===================== ENGAGEMENT EMAILS =====================

/**
 * Inactivity reminder (language-learning specific nudge)
 */
exports.inactivityReminder = (userName, daysSinceActive = 7, targetLanguage, unsubscribeUrl = null, locale = 'en') => {
  const hasLang = !!(targetLanguage && String(targetLanguage).trim());
  const url = 'https://banatalk.com';
  const vars = { userName, appName: APP_NAME, url, language: targetLanguage };
  const varsHtml = { ...vars, userName: `<strong>${userName}</strong>` };
  // NOTE: {language} is the stored language_to_learn display name (English,
  // e.g. "Spanish") — v1 keeps it untranslated inside localized sentences.
  // The *Fallback keys avoid grammatical breakage when it's missing.

  let subject, headerText, bodyHtml, ctaText, plainText;

  if (daysSinceActive >= 14) {
    // 14-day path
    subject    = t(locale, 'inactivity14.subject');
    headerText = t(locale, 'inactivity14.heading');
    ctaText    = t(locale, 'inactivity14.cta');
    plainText  = t(locale, 'inactivity14.text', vars);
    bodyHtml   = `
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          ${t(locale, 'common.greeting', varsHtml)}
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          ${t(locale, 'inactivity14.p1')}
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          ${t(locale, 'inactivity14.p2')}
        </p>`;
  } else {
    // 7-day path
    subject    = hasLang ? t(locale, 'inactivity7.subject', vars) : t(locale, 'inactivity7.subjectFallback');
    headerText = t(locale, 'inactivity7.heading');
    ctaText    = t(locale, 'inactivity7.cta');
    plainText  = hasLang ? t(locale, 'inactivity7.text', vars) : t(locale, 'inactivity7.textFallback', vars);
    bodyHtml   = `
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          ${t(locale, 'common.greeting', varsHtml)}
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          ${t(locale, 'inactivity7.p1')}
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          ${hasLang ? t(locale, 'inactivity7.p2', vars) : t(locale, 'inactivity7.p2Fallback')}
        </p>
        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0;">
          ${t(locale, 'inactivity7.p3')}
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
              <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                ${ctaText}
              </a>
            </td>
          </tr>
        </table>
${storeButtonsBlock(locale)}
      </td>
    </tr>
  `;

  return {
    subject,
    html: baseTemplate(content, '#f5576c', unsubscribeUrl, locale),
    text: plainText
  };
};

/**
 * Weekly digest email
 */
exports.weeklyDigest = (userName, stats = {}, unsubscribeUrl = null, locale = 'en') => {
  const url = 'https://banatalk.com/profile/stats';
  const statVars = {
    wordsReviewed: stats.wordsReviewed || 0,
    wordsSaved: stats.wordsSaved || 0,
    messagesSent: stats.messagesSent || 0,
    correctionsExchanged: stats.correctionsExchanged || 0,
  };
  const vars = { userName, appName: APP_NAME, url, ...statVars };
  const varsHtml = { ...vars, userName: `<strong>${userName}</strong>` };

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); padding: 40px; text-align: center;">
        <h1 style="color: #333333; margin: 0; font-size: 32px; font-weight: bold;">${t(locale, 'weeklyDigest.heading')}</h1>
        <p style="color: #555555; font-size: 16px; margin: 10px 0 0 0;">${t(locale, 'weeklyDigest.weekOf', { date: new Date().toLocaleDateString() })}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 25px 0;">
          ${t(locale, 'weeklyDigest.intro', varsHtml)}
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
          <tr>
            <td style="padding: 10px; text-align: center; width: 50%;">
              <div style="font-size: 32px; font-weight: bold; color: #333;">${statVars.wordsReviewed}</div>
              <div style="font-size: 13px; color: #777;">${t(locale, 'weeklyDigest.statWordsReviewed')}</div>
            </td>
            <td style="padding: 10px; text-align: center; width: 50%;">
              <div style="font-size: 32px; font-weight: bold; color: #333;">${statVars.wordsSaved}</div>
              <div style="font-size: 13px; color: #777;">${t(locale, 'weeklyDigest.statWordsSaved')}</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #333;">${statVars.messagesSent}</div>
              <div style="font-size: 13px; color: #777;">${t(locale, 'weeklyDigest.statMessages')}</div>
            </td>
            <td style="padding: 10px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #333;">${statVars.correctionsExchanged}</div>
              <div style="font-size: 13px; color: #777;">${t(locale, 'weeklyDigest.statCorrections')}</div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                ${t(locale, 'weeklyDigest.cta')}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: t(locale, 'weeklyDigest.subject'),
    html: baseTemplate(content, '#667eea', unsubscribeUrl, locale),
    text: `${t(locale, 'weeklyDigest.text', vars)}

${t(locale, 'weeklyDigest.textCta', vars)}`
  };
};

// ===================== NOTIFICATION EMAILS =====================

/**
 * New follower notification
 */
exports.newFollowerEmail = (userName, followerName, followerImage, locale = 'en') => {
  const vars = { userName, followerName, appName: APP_NAME, url: 'https://banatalk.com/messages' };
  const varsHtml = { ...vars, userName: `<strong>${userName}</strong>`, followerName: `<strong>${followerName}</strong>` };

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">${t(locale, 'newFollower.heading')}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px; text-align: center;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 25px 0;">
          ${t(locale, 'newFollower.intro', varsHtml)}
        </p>

        ${followerImage ? `
        <img src="${followerImage}" alt="${followerName}" style="width: 80px; height: 80px; border-radius: 50%; margin: 20px 0; border: 4px solid #667eea;">
        ` : ''}

        <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 20px 0;">
          ${t(locale, 'newFollower.body')}
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="https://banatalk.com/messages/new/${followerName}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                ${t(locale, 'newFollower.cta')}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: t(locale, 'newFollower.subject', vars),
    html: baseTemplate(content, '#667eea', null, locale),
    text: t(locale, 'newFollower.text', vars)
  };
};

/**
 * New message notification (for users not actively using the app)
 */
exports.newMessageEmail = (userName, senderName, messagePreview, locale = 'en') => {
  const url = 'https://banatalk.com/messages';
  const vars = { userName, senderName, appName: APP_NAME, url, messagePreview };
  const varsHtml = { ...vars, userName: `<strong>${userName}</strong>`, senderName: `<strong>${senderName}</strong>` };

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">${t(locale, 'newMessage.heading')}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          ${t(locale, 'newMessage.intro', varsHtml)}
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
              <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                ${t(locale, 'newMessage.cta', vars)}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: t(locale, 'newMessage.subject', vars),
    html: baseTemplate(content, '#4facfe', null, locale),
    text: `${t(locale, 'newMessage.text', vars)}

${t(locale, 'newMessage.textReply', vars)}`
  };
};

/**
 * Correction received notification (HelloTalk style)
 */
exports.correctionReceivedEmail = (userName, correctorName, originalText, correctedText, locale = 'en') => {
  const url = 'https://banatalk.com/messages';
  const vars = { userName, correctorName, appName: APP_NAME, url };
  const varsHtml = { ...vars, userName: `<strong>${userName}</strong>`, correctorName: `<strong>${correctorName}</strong>` };

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">${t(locale, 'correction.heading')}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          ${t(locale, 'correction.intro', varsHtml)}
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
          <tr>
            <td style="background-color: #ffebee; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
              <p style="margin: 0 0 5px 0; font-size: 12px; color: #c62828; text-transform: uppercase;">${t(locale, 'correction.originalLabel')}</p>
              <p style="margin: 0; font-size: 16px; color: #c62828; text-decoration: line-through;">${originalText}</p>
            </td>
          </tr>
          <tr><td style="height: 10px;"></td></tr>
          <tr>
            <td style="background-color: #e8f5e9; border-radius: 8px; padding: 15px;">
              <p style="margin: 0 0 5px 0; font-size: 12px; color: #2e7d32; text-transform: uppercase;">${t(locale, 'correction.correctedLabel')}</p>
              <p style="margin: 0; font-size: 16px; color: #2e7d32; font-weight: bold;">${correctedText}</p>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                ${t(locale, 'correction.cta')}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    subject: t(locale, 'correction.subject', vars),
    html: baseTemplate(content, '#fa709a', null, locale),
    text: `${t(locale, 'correction.text', vars)}

${t(locale, 'correction.originalLabel')} "${originalText}"
${t(locale, 'correction.correctedLabel')} "${correctedText}"

${t(locale, 'correction.textSeeIt', vars)}`
  };
};

// ===================== TRANSACTIONAL EMAILS =====================

/**
 * VIP subscription confirmation
 */
exports.vipSubscriptionEmail = (userName, plan, endDate, locale = 'en') => {
  const date = new Date(endDate).toLocaleDateString();
  const benefits = t(locale, 'vip.benefits');
  const vars = { userName, appName: APP_NAME, plan, date, benefits: benefits.join(', ') };
  const varsHtml = { ...vars, userName: `<strong>${userName}</strong>`, plan: `<strong>${plan}</strong>` };

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%); padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">${t(locale, 'vip.heading')}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          ${t(locale, 'vip.intro', varsHtml)}
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-radius: 12px; padding: 25px; margin: 25px 0;">
          <tr>
            <td>
              <h3 style="color: #f7971e; margin: 0 0 15px 0; font-size: 18px;">${t(locale, 'vip.whatsIncluded')}</h3>
              <ul style="margin: 0; padding-left: 20px; color: #555555; line-height: 2;">
                ${benefits.map((b) => `<li>${b}</li>`).join('\n                ')}
              </ul>
            </td>
          </tr>
        </table>

        <p style="font-size: 14px; color: #666666; text-align: center;">
          ${t(locale, 'vip.activeUntil', { ...vars, date: `<strong>${date}</strong>` })}
        </p>
      </td>
    </tr>
  `;

  return {
    subject: t(locale, 'vip.subject', vars),
    html: baseTemplate(content, '#f7971e', null, locale),
    text: t(locale, 'vip.text', vars)
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
exports.promotionalEmail = (userName, { title, message, ctaText, ctaUrl, iosUrl, androidUrl, unsubscribeUrl }, locale = 'en') => {
  // title/message/ctaText arrive already-localized (the send path pulls them
  // from the promoCampaign catalog section per user locale); `locale` here
  // localizes the wrapper strings (greeting, footer, store buttons).
  // The campaign message is authored as plain text with newlines — convert
  // them to <br> so paragraphs/bullets actually render in the HTML part.
  const messageHtml = String(message || '').replace(/\n/g, '<br>');
  const vars = { userName, appName: APP_NAME };
  const varsHtml = { ...vars, userName: `<strong>${userName}</strong>` };

  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #FFD93D 0%, #FF6B6B 50%, #6BCB77 100%); padding: 50px 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">${title}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
          ${t(locale, 'common.greeting', varsHtml)}
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
              <h3 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">${t(locale, 'common.getApp')}</h3>
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 0 10px;">
                    <a href="${iosUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
                      ${t(locale, 'common.appStore')}
                    </a>
                  </td>
                  <td style="padding: 0 10px;">
                    <a href="${androidUrl}" style="display: inline-block; background-color: #3DDC84; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
                      ${t(locale, 'common.googlePlay')}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="font-size: 14px; color: #888888; text-align: center; margin: 25px 0 0 0;">
          ${t(locale, 'promotional.seeYou', vars)}
        </p>
      </td>
    </tr>
  `;

  return {
    subject: title,
    html: baseTemplate(content, '#FFD93D', unsubscribeUrl, locale),
    text: `${t(locale, 'common.greeting', vars)}

${message}

${t(locale, 'common.getApp')}:
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
exports.reportResolutionToReporter = (report, locale = 'en') => {
  const vars = { date: new Date(report.createdAt).toDateString(), appName: APP_NAME };
  return {
    subject: t(locale, 'reportResolution.subject'),
    text: `${t(locale, 'reportResolution.p1', vars)}

${t(locale, 'reportResolution.p2', vars)}

${t(locale, 'reportResolution.p3', vars)}`,
    html: baseTemplate(`
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="color: #333; margin: 0 0 15px 0;">${t(locale, 'reportResolution.heading')}</h2>
        <p style="font-size: 16px; color: #555; line-height: 1.7;">${t(locale, 'reportResolution.p1', vars)}</p>
        <p style="font-size: 16px; color: #555; line-height: 1.7;">${t(locale, 'reportResolution.p2', vars)}</p>
        <p style="font-size: 16px; color: #555; line-height: 1.7;">${t(locale, 'reportResolution.p3', vars)}</p>
      </td>
    </tr>`, '#11998e', null, locale)
  };
};

/**
 * Notification to a banned user explaining the ban + appeal contact.
 */
exports.banNotification = (reason, locale = 'en') => {
  const appealEmail = 'appeal@banatalk.com';
  const vars = { appName: APP_NAME, appealEmail };
  const varsHtml = { ...vars, appealLink: `<a href="mailto:${appealEmail}" style="color: #d63031;">${appealEmail}</a>` };
  return {
    subject: t(locale, 'ban.subject', vars),
    text: `${t(locale, 'ban.p1', vars)}

${reason ? `${t(locale, 'common.reasonLabel')} ${reason}\n\n` : ''}${t(locale, 'ban.appealText', vars)}`,
    html: baseTemplate(`
    <tr>
      <td style="background: linear-gradient(135deg, #ff7e7e 0%, #d63031 100%); padding: 40px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 28px;">${t(locale, 'ban.heading')}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #555; line-height: 1.7;">${t(locale, 'ban.p1', vars)}</p>
        ${reason ? `<p style="font-size: 16px; color: #555; line-height: 1.7;"><strong>${t(locale, 'common.reasonLabel')}</strong> ${reason}</p>` : ''}
        <p style="font-size: 16px; color: #555; line-height: 1.7;">${t(locale, 'ban.appealHtml', varsHtml)}</p>
      </td>
    </tr>`, '#d63031', null, locale)
  };
};

// Step 15 — restored-account notification, mirrors banNotification.
exports.unbanNotification = (reason, locale = 'en') => {
  const vars = { appName: APP_NAME, supportEmail: SUPPORT_EMAIL };
  const varsHtml = { ...vars, supportLink: `<a href="mailto:${SUPPORT_EMAIL}" style="color: #11998e;">${SUPPORT_EMAIL}</a>` };
  return {
    subject: t(locale, 'unban.subject', vars),
    text: `${t(locale, 'unban.p1', vars)}

${reason ? `${t(locale, 'common.reasonLabel')} ${reason}\n\n` : ''}${t(locale, 'unban.questionsText', vars)}`,
    html: baseTemplate(`
    <tr>
      <td style="background: linear-gradient(135deg, #4cd964 0%, #11998e 100%); padding: 40px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 28px;">${t(locale, 'unban.heading')}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #555; line-height: 1.7;">${t(locale, 'unban.p1', vars)}</p>
        ${reason ? `<p style="font-size: 16px; color: #555; line-height: 1.7;"><strong>${t(locale, 'common.reasonLabel')}</strong> ${reason}</p>` : ''}
        <p style="font-size: 16px; color: #555; line-height: 1.7;">${t(locale, 'unban.questionsHtml', varsHtml)}</p>
      </td>
    </tr>`, '#11998e', null, locale)
  };
};

module.exports = exports;

