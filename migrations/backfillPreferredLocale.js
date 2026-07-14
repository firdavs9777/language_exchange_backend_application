/**
 * Migration: backfill User.preferredLocale from native_language.
 *
 * For every user with no preferredLocale (null or missing), derive one via
 * lib/normalizeLocale.js normalizeLocale(native_language) and $set it.
 * Users whose native_language doesn't map to a supported template locale
 * (e.g. Uzbek, Burmese) are left at null — renderers fall back to 'en'.
 *
 * Idempotent — only touches users where preferredLocale is null/missing, so
 * re-running is a no-op for already-backfilled users, and device-locale
 * values written by /notifications/register-token are never overwritten.
 *
 * Usage:
 *   node migrations/backfillPreferredLocale.js --dry-run   # read-only: prints per-locale counts
 *   node migrations/backfillPreferredLocale.js             # performs the $set writes
 *
 * NOTE: connects to process.env.MONGO_URI (config/config.env). Like
 * seedPrompts.js, the real run is intended for the server post-deploy.
 * --dry-run performs reads only (no writes of any kind).
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const { normalizeLocale } = require('../lib/normalizeLocale');

const MISSING_LOCALE_FILTER = {
  $or: [
    { preferredLocale: null },
    { preferredLocale: { $exists: false } },
  ],
};

async function backfillPreferredLocale({ dryRun = false } = {}) {
  try {
    console.log('🔄 Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ Connected${dryRun ? ' (dry run — no writes)' : ''}\n`);

    const users = await User.find(MISSING_LOCALE_FILTER)
      .select('native_language')
      .lean();

    console.log(`Found ${users.length} users with no preferredLocale.\n`);

    // locale -> count of users that would receive it; null bucket = unmapped
    const counts = {};
    const unmappedValues = {};
    const ops = [];

    for (const user of users) {
      const locale = normalizeLocale(user.native_language);
      const bucket = locale || '(null — falls back to en)';
      counts[bucket] = (counts[bucket] || 0) + 1;

      if (locale) {
        ops.push({
          updateOne: {
            // Re-assert the null/missing filter per-doc so a concurrent
            // register-token write between our read and this write wins.
            filter: { _id: user._id, ...MISSING_LOCALE_FILTER },
            update: { $set: { preferredLocale: locale } },
          },
        });
      } else {
        const raw = user.native_language || '(empty)';
        unmappedValues[raw] = (unmappedValues[raw] || 0) + 1;
      }
    }

    console.log('Per-locale distribution (users with no preferredLocale):');
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([locale, n]) => console.log(`  ${locale.padEnd(28)} ${n}`));

    if (Object.keys(unmappedValues).length) {
      console.log('\nUnmapped native_language values (left at null → en):');
      Object.entries(unmappedValues)
        .sort((a, b) => b[1] - a[1])
        .forEach(([v, n]) => console.log(`  ${v.padEnd(28)} ${n}`));
    }

    if (dryRun) {
      console.log(`\nDry run complete — ${ops.length} users WOULD be updated, 0 written.`);
      return { wouldUpdate: ops.length, counts };
    }

    if (ops.length === 0) {
      console.log('\nNothing to update.');
      return { updated: 0, counts };
    }

    const result = await User.bulkWrite(ops, { ordered: false });
    console.log(`\n✅ Done. ${result.modifiedCount} users updated.`);
    return { updated: result.modifiedCount, counts };
  } catch (err) {
    console.error('❌ Backfill failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  backfillPreferredLocale({ dryRun: process.argv.includes('--dry-run') });
}

module.exports = backfillPreferredLocale;
