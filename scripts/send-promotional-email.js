/**
 * Send Promotional Email to All Users
 *
 * Usage: node scripts/send-promotional-email.js
 *
 * Options (via environment variables):
 *   DRY_RUN=true     - Preview without sending
 *   BATCH_SIZE=50    - Emails per batch (default: 50)
 *   DELAY_MS=1000    - Delay between batches in ms (default: 1000)
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const emailService = require('../services/emailService');

// ===================== PROMOTION CONFIG =====================
const PROMO_CONFIG = {
  title: 'New Update Just Dropped!',
  message: `We just released a fresh new update and we're super excited for you to try it out!

Here's what's new:
• Smoother chat experience with faster message delivery
• Bug fixes and performance improvements
• New features to help you connect even better

We've been listening to your feedback and working hard to make Bananatalk the best place to learn languages and meet amazing people from around the world.

Update now and let us know what you think! Your feedback means everything to us.`,
  ctaText: 'Try It Now',
  ctaUrl: 'https://banatalk.com',
  iosUrl: 'https://apps.apple.com/us/app/bananatalk-learn-meet-or-date/id6755862146',
  androidUrl: 'https://play.google.com/store/apps/details?id=com.bananatalk.app'
};
// ============================================================

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 50;
const DELAY_MS = parseInt(process.env.DELAY_MS) || 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
  return conn;
};

const sendPromoEmails = async () => {
  console.log('\n========================================');
  console.log('📧 PROMOTIONAL EMAIL SENDER');
  console.log('========================================');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no emails sent)' : '📤 LIVE MODE'}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Delay: ${DELAY_MS}ms between batches`);
  console.log('----------------------------------------');
  console.log(`Title: ${PROMO_CONFIG.title}`);
  console.log('========================================\n');

  try {
    await connectDB();

    // Get all users with completed registration and valid email
    const users = await User.find({
      isRegistrationComplete: true,
      email: { $exists: true, $ne: null, $regex: /@/ }
    }).select('email name privacySettings').lean();

    console.log(`📊 Found ${users.length} users to email\n`);

    if (users.length === 0) {
      console.log('No users found. Exiting.');
      return;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const failures = [];

    // Process in batches
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(users.length / BATCH_SIZE);

      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} users)...`);

      for (const user of batch) {
        if (DRY_RUN) {
          console.log(`   [DRY RUN] Would send to: ${user.email}`);
          sent++;
        } else {
          const result = await emailService.sendPromotionalEmail(user, PROMO_CONFIG);

          if (result.success) {
            sent++;
            process.stdout.write('.');
          } else if (result.reason === 'notifications_disabled') {
            skipped++;
          } else {
            failed++;
            failures.push({ email: user.email, reason: result.reason });
          }
        }
      }

      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < users.length && !DRY_RUN) {
        console.log(`\n   ⏳ Waiting ${DELAY_MS}ms before next batch...`);
        await sleep(DELAY_MS);
      }
    }

    console.log('\n\n========================================');
    console.log('📊 SUMMARY');
    console.log('========================================');
    console.log(`✅ Sent: ${sent}`);
    console.log(`⏭️  Skipped (notifications off): ${skipped}`);
    console.log(`❌ Failed: ${failed}`);

    if (failures.length > 0) {
      console.log('\n❌ Failed emails:');
      failures.slice(0, 10).forEach(f => {
        console.log(`   - ${f.email}: ${f.reason}`);
      });
      if (failures.length > 10) {
        console.log(`   ... and ${failures.length - 10} more`);
      }
    }

    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🍌 Bananatalk Promotional Email Sender\n');
console.log('This will send emails to ALL registered users.');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : '⚠️  LIVE MODE - EMAILS WILL BE SENT'}\n`);

if (DRY_RUN) {
  console.log('Running in DRY RUN mode...\n');
  rl.close();
  sendPromoEmails();
} else {
  rl.question('Type "SEND" to confirm sending emails to all users: ', (answer) => {
    rl.close();
    if (answer === 'SEND') {
      sendPromoEmails();
    } else {
      console.log('Cancelled. Use DRY_RUN=true to preview first.');
      process.exit(0);
    }
  });
}
