/**
 * Promotional Email Job
 *
 * Sends weekly promotional emails to all users
 * Scheduled for Sunday mornings (Korean Time)
 */

const User = require('../models/User');
const emailService = require('../services/emailService');

// Promotional campaign config.
//
// campaignId: bump this to a new value whenever the content changes so the
// campaign goes out to everyone again. Users who already received the
// CURRENT campaignId are skipped (see promoCampaignsSent on the User model)
// — this stops the identical-weekly-promo hammer that trains Gmail to
// spam-fold repeat sends of the same content.
//
// COPY LIVES IN email_templates/{locale}.json under "promoCampaign"
// (title/message/ctaText) — emailService.sendPromotionalEmail resolves each
// user's preferredLocale and pulls the localized strings, falling back to
// en per key. Update the catalogs (at minimum en.json) when you bump
// campaignId. Only URLs + the dedup id stay here.
const PROMO_CONFIG = {
  campaignId: 'corrections-in-one-tap-2026-07',
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
/**
 * Decide whether a user should be skipped for a given campaign — pure
 * function so it's easy to unit test without a DB.
 */
const shouldSkipCampaign = (promoCampaignsSent, campaignId) =>
  Array.isArray(promoCampaignsSent) && promoCampaignsSent.includes(campaignId);

const runPromotionalEmailJob = async () => {
  console.log('\n📧 Starting promotional email job...');

  const { campaignId } = PROMO_CONFIG;

  try {
    // Get all users with completed registration and valid email
    const users = await User.find({
      isRegistrationComplete: true,
      email: { $exists: true, $ne: null, $regex: /@/ }
    }).select('email name privacySettings promoCampaignsSent preferredLocale').lean();

    console.log(`📊 Found ${users.length} users to email (campaignId=${campaignId})`);

    if (users.length === 0) {
      console.log('No users to email. Skipping.');
      return { sent: 0, skipped: 0, skippedCampaign: 0, failed: 0 };
    }

    let sent = 0;
    let skipped = 0;
    let skippedCampaign = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(users.length / BATCH_SIZE);

      console.log(`📦 Processing batch ${batchNum}/${totalBatches}...`);

      for (const user of batch) {
        // Per-user dedup: never re-send the same campaignId to a user who
        // already received it. Changing PROMO_CONFIG.campaignId re-enables
        // sends for everyone.
        if (shouldSkipCampaign(user.promoCampaignsSent, campaignId)) {
          skippedCampaign++;
          continue;
        }

        const result = await emailService.sendPromotionalEmail(user, PROMO_CONFIG);

        if (result.success) {
          sent++;
          await User.updateOne(
            { _id: user._id },
            { $addToSet: { promoCampaignsSent: campaignId } }
          );
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
    console.log(`   Sent: ${sent} | Skipped (opted out): ${skipped} | Skipped (already got campaign): ${skippedCampaign} | Failed: ${failed}`);

    return { sent, skipped, skippedCampaign, failed };

  } catch (error) {
    console.error('❌ Promotional email job failed:', error);
    return { sent: 0, skipped: 0, skippedCampaign: 0, failed: 0, error: error.message };
  }
};

module.exports = {
  runPromotionalEmailJob,
  shouldSkipCampaign,
  PROMO_CONFIG
};
