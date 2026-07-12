/**
 * Migration: seed public language rooms ("hubs") for Workstream D.
 *
 * Upserts a reserved system owner User (fixed email, role:'admin') and then
 * upserts one hub Conversation per canonical language in
 * lib/normalizeLanguage.js's CANONICAL list (en/ko/ja/zh/ar/es/de/fr).
 *
 * Idempotent — the owner is upserted by `email`; each hub is upserted by
 * `{ roomType: 'hub', targetLanguage }`. Re-running updates title/emojiFlag/
 * description/owner rather than duplicating hubs or resetting memberCount.
 *
 * Usage:
 *   node migrations/seedRooms.js
 *   node migrations/seedRooms.js --dry-run   (logs intended writes, connects to nothing)
 *
 * NOTE: This script connects to process.env.MONGO_URI. It is intended to
 * run on the server post-deploy, NOT against production Mongo from a local
 * machine.
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');

// Hubs weighted to measured demand (2026-07-12). targetLanguage MUST be
// canonical (matches lib/normalizeLanguage.js CANONICAL + Prompt.language).
const HUBS = [
  { targetLanguage: 'en', title: 'English Practice', emojiFlag: '🇬🇧', description: 'Practice English with learners and native speakers from around the world.' },
  { targetLanguage: 'ko', title: 'Korean Learners', emojiFlag: '🇰🇷', description: 'Chat, ask questions, and practice Korean together.' },
  { targetLanguage: 'ja', title: 'Japanese Learners', emojiFlag: '🇯🇵', description: 'A room for everyone learning Japanese to practice and connect.' },
  { targetLanguage: 'zh', title: 'Chinese Corner', emojiFlag: '🇨🇳', description: 'Practice Mandarin Chinese with fellow learners.' },
  { targetLanguage: 'ar', title: 'Arabic Room', emojiFlag: '🇸🇦', description: 'Practice Arabic together in a friendly space.' },
  { targetLanguage: 'es', title: 'Spanish Room', emojiFlag: '🇪🇸', description: 'Practice Spanish with learners and native speakers.' },
  { targetLanguage: 'de', title: 'German Room', emojiFlag: '🇩🇪', description: 'Practice German together in a friendly space.' },
  { targetLanguage: 'fr', title: 'French Room', emojiFlag: '🇫🇷', description: 'Practice French with learners and native speakers.' },
];

const SYSTEM_OWNER = {
  email: 'system@bananatalk.internal',
  name: 'BananaTalk',
  role: 'admin',
};

async function seedRooms() {
  const User = require('../models/User');
  const Conversation = require('../models/Conversation');

  try {
    console.log('🔄 Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // 1. Upsert the reserved system owner user. Uses updateOne (not
    // findOneAndUpdate+save) so Mongoose validators/pre-save hooks that
    // require social-login-only fields (password, birth date, etc.) are
    // skipped — mirrors seedPrompts.js's plain-updateOne pattern.
    const ownerUpdateResult = await User.updateOne(
      { email: SYSTEM_OWNER.email },
      { $set: { name: SYSTEM_OWNER.name, role: SYSTEM_OWNER.role } },
      { upsert: true }
    );

    if (ownerUpdateResult.upsertedCount && ownerUpdateResult.upsertedCount > 0) {
      console.log(`+ Created system owner user [${SYSTEM_OWNER.email}]`);
    } else {
      console.log(`= Updated system owner user [${SYSTEM_OWNER.email}]`);
    }

    const ownerDoc = await User.findOne({ email: SYSTEM_OWNER.email }).select('_id');
    const ownerId = ownerDoc._id;

    // 2. Upsert each hub, keyed by { roomType: 'hub', targetLanguage }.
    let created = 0;
    let updated = 0;

    for (const hub of HUBS) {
      const result = await Conversation.updateOne(
        { roomType: 'hub', targetLanguage: hub.targetLanguage },
        {
          $set: {
            roomType: 'hub',
            targetLanguage: hub.targetLanguage,
            title: hub.title,
            emojiFlag: hub.emojiFlag,
            description: hub.description,
            owner: ownerId,
            isPublic: true,
            isSeeded: true,
            maxMembers: 1000,
          },
          $setOnInsert: {
            participants: [],
            memberCount: 0,
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount && result.upsertedCount > 0) {
        created += 1;
        console.log(`+ Created hub [${hub.targetLanguage}] ${hub.emojiFlag} ${hub.title}`);
      } else {
        updated += 1;
        console.log(`= Updated hub [${hub.targetLanguage}] ${hub.emojiFlag} ${hub.title}`);
      }
    }

    console.log(`\n✅ Done. 1 system owner upserted. ${created} hubs created, ${updated} already existed/updated. Total hubs: ${HUBS.length}`);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

// Dry-run mode: `node migrations/seedRooms.js --dry-run` prints the intended
// writes WITHOUT connecting to the database or writing anything.
if (require.main === module) {
  if (process.argv.includes('--dry-run')) {
    console.log('Dry run: no DB connection will be made.\n');
    console.log(`System owner to upsert: [${SYSTEM_OWNER.email}] name="${SYSTEM_OWNER.name}" role=${SYSTEM_OWNER.role}\n`);
    console.log(`${HUBS.length} hubs to upsert:`);
    HUBS.forEach((h, i) => {
      console.log(`${i + 1}. [${h.targetLanguage}] ${h.emojiFlag} ${h.title} — ${h.description}`);
    });
  } else {
    seedRooms();
  }
}

module.exports = seedRooms;
