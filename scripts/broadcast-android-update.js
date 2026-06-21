/**
 * One-shot push notification to all users with an active Android FCM token
 * — used to nudge them to install a freshly-released Android build.
 *
 * Sends ONLY to Android tokens (not iOS) so we don't spam users on
 * platforms that don't have the new version yet. Uses
 * admin.messaging().sendEach in chunks of 500 (FCM's per-call cap).
 * Failed tokens get marked inactive so they don't keep showing up
 * in future broadcasts.
 *
 * Usage:
 *   node scripts/broadcast-android-update.js                # dry-run (no send)
 *   node scripts/broadcast-android-update.js --apply        # actually send
 *   node scripts/broadcast-android-update.js --apply --limit 50   # limit, useful for canary
 *
 * Customize the notification payload by editing TITLE/BODY/DATA below.
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const admin = require('../config/firebase'); // initializes admin sdk
require('../models/User');

const APPLY = process.argv.includes('--apply');
const LIMIT_FLAG_IDX = process.argv.indexOf('--limit');
const LIMIT = LIMIT_FLAG_IDX > -1 ? parseInt(process.argv[LIMIT_FLAG_IDX + 1], 10) : null;

// ─── Notification payload (edit me) ──────────────────────────────────
const TITLE = '🚀 BananaTalk 1.5.1 is out';
const BODY  = 'VIP in 18 languages, language flags on every profile, in-chat phrases & topics, KakaoTalk-style reactions, smoother filters. Tap to update → https://play.google.com/store/apps/details?id=com.bananatalk.app';
const DATA  = {
  type: 'app_update',
  target_url: 'https://play.google.com/store/apps/details?id=com.bananatalk.app',
  platform: 'android'
};

const CHUNK_SIZE = 500; // FCM hard cap per sendEach call

const collectAndroidTokens = async () => {
  const User = mongoose.model('User');
  const query = { 'fcmTokens.platform': 'android', 'fcmTokens.active': true };
  const projection = '_id fcmTokens';
  const users = await User.find(query).select(projection).lean();

  // Each user may have multiple Android devices — pull every active Android
  // token. Skip iOS tokens entirely (this is an Android-only nudge).
  const tokenPairs = [];
  for (const u of users) {
    for (const t of u.fcmTokens || []) {
      if (t.platform === 'android' && t.active && t.token) {
        tokenPairs.push({ userId: u._id, token: t.token });
      }
    }
  }
  return tokenPairs;
};

const buildMessage = (token) => ({
  token,
  notification: { title: TITLE, body: BODY },
  data: DATA,
  android: {
    priority: 'high',
    notification: {
      channelId: 'default',
      sound: 'default',
      clickAction: 'FLUTTER_NOTIFICATION_CLICK'
    }
  }
});

const deactivateBadTokens = async (badTokens) => {
  if (badTokens.length === 0) return;
  const User = mongoose.model('User');
  await User.updateMany(
    { 'fcmTokens.token': { $in: badTokens } },
    { $set: { 'fcmTokens.$[t].active': false } },
    { arrayFilters: [{ 't.token': { $in: badTokens } }] }
  );
  console.log(`🧹 Marked ${badTokens.length} dead Android tokens inactive`);
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to ${mongoose.connection.host}`);

  let pairs = await collectAndroidTokens();
  console.log(`Found ${pairs.length} active Android tokens across ${new Set(pairs.map(p => p.userId.toString())).size} users.`);

  if (LIMIT && pairs.length > LIMIT) {
    pairs = pairs.slice(0, LIMIT);
    console.log(`Limiting to first ${LIMIT} for this run.`);
  }

  if (pairs.length === 0) {
    console.log('Nothing to send.');
    await mongoose.disconnect();
    process.exit(0);
  }

  if (!APPLY) {
    console.log('\nDry run. Would send:');
    console.log(`  Title: ${TITLE}`);
    console.log(`  Body:  ${BODY}`);
    console.log(`  Data:  ${JSON.stringify(DATA)}`);
    console.log('\nFirst 3 sample targets:');
    pairs.slice(0, 3).forEach(p =>
      console.log(`  - user ${p.userId} token ${p.token.slice(0, 18)}…`)
    );
    console.log('\nRe-run with --apply to actually send.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const badTokens = [];
  let delivered = 0, failed = 0;

  for (let i = 0; i < pairs.length; i += CHUNK_SIZE) {
    const chunk = pairs.slice(i, i + CHUNK_SIZE);
    const messages = chunk.map(p => buildMessage(p.token));
    const response = await admin.messaging().sendEach(messages);

    delivered += response.successCount;
    failed += response.failureCount;

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code || '';
        // Tokens that are explicitly invalid / unregistered should be retired.
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          badTokens.push(chunk[idx].token);
        }
      }
    });

    console.log(
      `Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${response.successCount} ok / ${response.failureCount} failed`
    );
  }

  console.log(`\n✅ Total: ${delivered} delivered, ${failed} failed.`);
  await deactivateBadTokens(badTokens);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Broadcast failed:', err);
  process.exit(1);
});
