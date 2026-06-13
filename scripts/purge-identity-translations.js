/**
 * Removes Translation rows whose sourceLanguage === targetLanguage.
 *
 * Background: translationService.translateText used to short-circuit and
 * return the source text verbatim when source === target (identity case).
 * getOrCreateTranslation then cached that result, so any moment whose
 * `language` field was mislabeled to match a popular target language got a
 * permanent broken entry (e.g. an Arabic moment tagged 'en' would serve
 * its Arabic source back as the English "translation" forever).
 *
 * After backend@<this-deploy>, identity returns are no longer persisted
 * (services/translationService.js skips the save) and the moment translate
 * controller auto-detects source language fresh on every call (no longer
 * trusts moment.language). This script cleans up the existing polluted
 * rows so users see proper translations on the next request.
 *
 * Usage:
 *   node scripts/purge-identity-translations.js              # dry-run, prints counts
 *   node scripts/purge-identity-translations.js --apply      # actually delete
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const Translation = require('../models/Translation');

const APPLY = process.argv.includes('--apply');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to ${mongoose.connection.host}`);

  const filter = {
    $expr: { $eq: ['$sourceLanguage', '$targetLanguage'] }
  };

  const matches = await Translation.find(filter)
    .select('sourceId sourceType sourceLanguage targetLanguage translatedText')
    .lean();

  console.log(`Found ${matches.length} identity-translation rows (source === target).`);
  for (const row of matches.slice(0, 10)) {
    const preview = (row.translatedText || '').slice(0, 60);
    console.log(`  - ${row.sourceType} ${row.sourceId} ${row.sourceLanguage}→${row.targetLanguage} "${preview}"`);
  }
  if (matches.length > 10) {
    console.log(`  …and ${matches.length - 10} more.`);
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to delete.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const result = await Translation.deleteMany(filter);
  console.log(`\nDeleted ${result.deletedCount} rows.`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
