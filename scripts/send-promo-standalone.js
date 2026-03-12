/**
 * Standalone Promotional Email Sender
 * Avoids mongoose compatibility issues by using mongodb driver directly
 */

const { MongoClient } = require('mongodb');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
require('dotenv').config({ path: './config/config.env' });

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'test';

// Email config
const PROMO = {
  title: 'New Update Just Dropped!',
  message: `We just released a fresh new update and we're super excited for you to try it out!

Here's what's new:
• Smoother chat experience with faster message delivery
• Bug fixes and performance improvements
• New features to help you connect even better

We've been listening to your feedback and working hard to make BananaTalk the best place to learn languages and meet amazing people from around the world.

Update now and let us know what you think! Your feedback means everything to us.`,
  iosUrl: 'https://apps.apple.com/us/app/bananatalk-learn-meet-or-date/id6755862146',
  androidUrl: 'https://play.google.com/store/apps/details?id=com.bananatalk.app'
};

const buildHtml = (userName) => `
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
          <tr>
            <td style="background: linear-gradient(135deg, #FFD93D 0%, #FF6B6B 50%, #6BCB77 100%); padding: 50px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">🍌 ${PROMO.title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 18px; color: #333333; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${userName}</strong>! 👋
              </p>
              <p style="font-size: 16px; color: #555555; line-height: 1.8; margin: 0 0 25px 0; white-space: pre-line;">
                ${PROMO.message}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://banatalk.com" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                      Try It Now →
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f8f9ff 0%, #fff5f5 100%); border-radius: 12px; padding: 25px; margin: 25px 0;">
                <tr>
                  <td style="text-align: center;">
                    <h3 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">📱 Download BananaTalk</h3>
                    <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 0 10px;">
                          <a href="${PROMO.iosUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
                            🍎 App Store
                          </a>
                        </td>
                        <td style="padding: 0 10px;">
                          <a href="${PROMO.androidUrl}" style="display: inline-block; background-color: #3DDC84; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
                            🤖 Google Play
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="font-size: 14px; color: #888888; text-align: center; margin: 25px 0 0 0;">
                See you on BananaTalk! 🍌✨
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                Need help? Contact us at <a href="mailto:support@banatalk.com" style="color: #FFD93D; text-decoration: none;">support@banatalk.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                © 2026 BananaTalk. All rights reserved.
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendEmails() {
  console.log('\n🍌 BananaTalk Promotional Email Sender\n');
  console.log('========================================\n');

  // Setup Mailgun
  const mailgun = new Mailgun(formData);
  const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY,
    url: process.env.MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'
  });

  // Connect to MongoDB
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('✅ Connected to MongoDB\n');

  const db = client.db(DB_NAME);
  const users = await db.collection('users').find({
    isRegistrationComplete: true,
    email: { $exists: true, $ne: null, $regex: /@/ }
  }, { projection: { email: 1, name: 1 } }).toArray();

  console.log(`📧 Sending to ${users.length} users...\n`);

  let sent = 0, failed = 0;

  for (const user of users) {
    try {
      const html = buildHtml(user.name || 'Friend');
      await mg.messages.create(process.env.MAILGUN_DOMAIN, {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: user.email,
        subject: `🍌 ${PROMO.title}`,
        html: html,
        text: `Hi ${user.name || 'Friend'}! ${PROMO.message}\n\niOS: ${PROMO.iosUrl}\nAndroid: ${PROMO.androidUrl}`
      });
      sent++;
      process.stdout.write(`\r✅ Sent: ${sent} | ❌ Failed: ${failed}`);
      await sleep(100); // Small delay to avoid rate limits
    } catch (err) {
      failed++;
      console.error(`\n❌ Failed for ${user.email}: ${err.message}`);
    }
  }

  console.log(`\n\n========================================`);
  console.log(`📊 DONE! Sent: ${sent} | Failed: ${failed}`);
  console.log(`========================================\n`);

  await client.close();
}

sendEmails().catch(console.error);
