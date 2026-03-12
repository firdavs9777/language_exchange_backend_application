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
  title: 'New Update Just Dropped!',
  message: `We just released a fresh new update and we're super excited for you to try it out!

Here's what's new:
• Smoother chat experience with faster message delivery
• Bug fixes and performance improvements
• New features to help you connect even better

We've been listening to your feedback and working hard to make BananaTalk the best place to learn languages and meet amazing people from around the world.

Update now and let us know what you think! Your feedback means everything to us.`,
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
