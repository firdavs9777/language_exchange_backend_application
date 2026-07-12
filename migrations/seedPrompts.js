/**
 * Migration: seed daily moment prompts.
 *
 * Seeds 40 curated prompts (10 'en' for zh/ar/ru→en learners, 10 'ko',
 * 10 'zh', 10 generic 'en' conversation starters) from migrations/promptsData.json.
 *
 * Idempotent — upserts by `text` (unique per prompt). Re-running updates
 * language/level/emoji/active on existing prompts rather than duplicating.
 *
 * Usage:
 *   node migrations/seedPrompts.js
 *
 * NOTE: This script connects to process.env.MONGO_URI. It is intended to
 * run on the server post-deploy, NOT against production Mongo from a local
 * machine.
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const Prompt = require('../models/Prompt');
const prompts = require('./promptsData.json');

async function seedPrompts() {
  try {
    console.log('🔄 Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    let created = 0;
    let updated = 0;

    for (const prompt of prompts) {
      const result = await Prompt.updateOne(
        { text: prompt.text },
        { $set: prompt },
        { upsert: true }
      );

      if (result.upsertedCount && result.upsertedCount > 0) {
        created += 1;
        console.log(`+ Created [${prompt.language}] ${prompt.text}`);
      } else {
        updated += 1;
        console.log(`= Updated [${prompt.language}] ${prompt.text}`);
      }
    }

    console.log(`\n✅ Done. ${created} created, ${updated} already existed/updated. Total: ${prompts.length}`);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

// Dry-run mode: `node migrations/seedPrompts.js --dry-run` prints the parsed
// prompts without touching the database (used for local verification).
if (require.main === module) {
  if (process.argv.includes('--dry-run')) {
    console.log(`Dry run: ${prompts.length} prompts parsed from migrations/promptsData.json\n`);
    prompts.forEach((p, i) => {
      console.log(`${i + 1}. [${p.language}/${p.level}] ${p.emoji} ${p.text}`);
    });
  } else {
    seedPrompts();
  }
}

module.exports = seedPrompts;
