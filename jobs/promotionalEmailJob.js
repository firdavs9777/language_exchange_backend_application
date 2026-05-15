/**
 * Promotional Email Job
 *
 * Sends weekly promotional emails to all users
 * Scheduled for Sunday mornings (Korean Time)
 */

const User = require('../models/User');
const emailService = require('../services/emailService');

// Promotional content - update this for each campaign
const PROMO_CONFIG = {
  title: "What's new in BananaTalk",
  message: `A few things that make language practice with your partners smoother:

• Accept corrections in one tap — when your partner corrects your message, you can now accept it directly in the chat bubble
• Spot corrections faster — a small "Correct" button appears below messages so you can help your partner without long-pressing
• Save phrases to your study deck — translate a message and tap "Save phrase" to add it to your vocabulary queue for later review

Update the app to get these features.`,
  ctaText: 'Try It Now',
  ctaUrl: 'https://banatalk.com',
  iosUrl: 'https://apps.apple.com/us/app/bananatalk-learn-meet-or-date/id6755862146',
  androidUrl: 'https://play.google.com/store/apps/details?id=com.bananatalk.app'
};

const BATCH_SIZE = 50;
const DELAY_MS = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Run the promotional email job
 */
const runPromotionalEmailJob = async () => {
  console.log('\n📧 Starting promotional email job...');

  try {
    // Get all users with completed registration and valid email
    const users = await User.find({
      isRegistrationComplete: true,
      email: { $exists: true, $ne: null, $regex: /@/ }
    }).select('email name privacySettings').lean();

    console.log(`📊 Found ${users.length} users to email`);

    if (users.length === 0) {
      console.log('No users to email. Skipping.');
      return { sent: 0, skipped: 0, failed: 0 };
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(users.length / BATCH_SIZE);

      console.log(`📦 Processing batch ${batchNum}/${totalBatches}...`);

      for (const user of batch) {
        const result = await emailService.sendPromotionalEmail(user, PROMO_CONFIG);

        if (result.success) {
          sent++;
        } else if (result.reason === 'notifications_disabled') {
          skipped++;
        } else {
          failed++;
        }
      }

      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < users.length) {
        await sleep(DELAY_MS);
      }
    }

    console.log(`\n✅ Promotional email job complete!`);
    console.log(`   Sent: ${sent} | Skipped: ${skipped} | Failed: ${failed}`);

    return { sent, skipped, failed };

  } catch (error) {
    console.error('❌ Promotional email job failed:', error);
    return { sent: 0, skipped: 0, failed: 0, error: error.message };
  }
};

module.exports = {
  runPromotionalEmailJob,
  PROMO_CONFIG
};
