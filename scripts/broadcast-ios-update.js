/**
 * One-shot push notification to every user with an active iOS FCM token —
 * sibling of broadcast-android-update.js, with the platform flipped to iOS
 * and an APNS-shaped payload so the notification renders correctly on
 * iPhones / iPads.
 *
 * Sends ONLY to iOS tokens; Android users are skipped. (Android already
 * got their own broadcast when 1.4.9 hit the Play Store — sending again
 * here would be noise.)
 *
 * Usage:
 *   node scripts/broadcast-ios-update.js                # dry-run
 *   node scripts/broadcast-ios-update.js --apply        # actually send
 *   node scripts/broadcast-ios-update.js --apply --limit 50   # canary
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const admin = require('../config/firebase');
require('../models/User');

const APPLY = process.argv.includes('--apply');
const LIMIT_FLAG_IDX = process.argv.indexOf('--limit');
const LIMIT = LIMIT_FLAG_IDX > -1 ? parseInt(process.argv[LIMIT_FLAG_IDX + 1], 10) : null;

// ─── Notification payload ────────────────────────────────────────────
const TITLE = '🚀 BananaTalk 1.9.1 is here';
const BODY  = 'VIP in 18 languages, language flags on every profile, in-chat phrases & topics, KakaoTalk-style reactions, smoother filters. Tap to update → https://apps.apple.com/app/id6755862146';
const DATA  = {
  type: 'app_update',
  target_url: 'https://apps.apple.com/us/app/bananatalk-learn-meet-or-date/id6755862146',
  platform: 'ios'
};

const CHUNK_SIZE = 500;

const collectIosTokens = async () => {
  const User = mongoose.model('User');
  const query = { 'fcmTokens.platform': 'ios', 'fcmTokens.active': true };
  const projection = '_id fcmTokens';
  const users = await User.find(query).select(projection).lean();

  const tokenPairs = [];
  for (const u of users) {
    for (const t of u.fcmTokens || []) {
      if (t.platform === 'ios' && t.active && t.token) {
        tokenPairs.push({ userId: u._id, token: t.token });
      }
    }
  }
  return tokenPairs;
};

// iOS-specific message: APNS payload tells the system how to render the
// alert. content-available + mutable-content keep the notification in
// the foreground/notification-center flow the Flutter app already handles.
const buildMessage = (token) => ({
  token,
  notification: { title: TITLE, body: BODY },
  data: DATA,
  apns: {
    headers: {
      'apns-priority': '10',
      'apns-push-type': 'alert'
    },
    payload: {
      aps: {
        alert: { title: TITLE, body: BODY },
        sound: 'default',
        badge: 1,
        'mutable-content': 1
      }
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
  console.log(`🧹 Marked ${badTokens.length} dead iOS tokens inactive`);
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to ${mongoose.connection.host}`);

  let pairs = await collectIosTokens();
  console.log(`Found ${pairs.length} active iOS tokens across ${new Set(pairs.map(p => p.userId.toString())).size} users.`);

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
