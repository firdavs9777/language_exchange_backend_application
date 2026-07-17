/**
 * VocabPack seeder (H9, workstream-h-aistudy). ADDITIVE ONLY.
 *
 * Reads migrations/vocabPacksData.json (real content: headword coverage derived
 * from reference books, all definitions/examples/exercises generated originally).
 *
 * Safety pattern (mirrors seeds/languages.js):
 * - validates the ENTIRE data file shape up front; refuses to write anything
 *   on any validation error (no half-seeds)
 * - upserts on the unique (level, topic, language) key — re-running is
 *   idempotent; existing packs get their words/exercises refreshed, nothing is
 *   deleted
 * - prints a per-pack audit line; exits non-zero on failure
 *
 * Usage: node seeds/vocabPacks.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

const VocabPack = require('../models/VocabPack');
const { validateVocabPacksData } = require('../lib/vocabPackShape');

const DATA_PATH = path.join(__dirname, '..', 'migrations', 'vocabPacksData.json');

const _cleanExercise = (ex) => {
  const out = { type: ex.type };
  if (ex.prompt !== undefined) out.prompt = String(ex.prompt).trim();
  if (Array.isArray(ex.options)) out.options = ex.options.map((o) => String(o).trim());
  if (ex.answerIndex !== undefined) out.answerIndex = ex.answerIndex;
  if (ex.answer !== undefined) out.answer = String(ex.answer).trim();
  if (ex.corrected !== undefined) out.corrected = String(ex.corrected).trim();
  if (ex.targetWord !== undefined) out.targetWord = String(ex.targetWord).trim();
  if (Array.isArray(ex.pairs)) {
    out.pairs = ex.pairs.map((p) => ({
      term: String(p.term).trim(),
      definition: String(p.definition).trim(),
    }));
  }
  return out;
};

const seedVocabPacks = async ({ dryRun = false } = {}) => {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const packs = JSON.parse(raw);

  const { valid, errors } = validateVocabPacksData(packs);
  if (!valid) {
    console.error(`[seeds/vocabPacks] REFUSING to seed — ${errors.length} validation error(s):`);
    errors.forEach(e => console.error(`  - ${e}`));
    throw new Error('vocabPacksData.json failed shape validation');
  }

  let created = 0;
  let updated = 0;

  for (const pack of packs) {
    const key = {
      level: pack.level,
      topic: pack.topic.trim(),
      language: pack.language || 'English',
    };

    const exercises = Array.isArray(pack.exercises) ? pack.exercises.map(_cleanExercise) : [];

    if (dryRun) {
      const exists = await VocabPack.exists(key);
      console.log(`  [dry-run] ${exists ? 'UPDATE' : 'CREATE'} ${key.level}/${key.topic} (${pack.words.length} words, ${exercises.length} exercises)`);
      continue;
    }

    const res = await VocabPack.findOneAndUpdate(
      key,
      {
        $set: {
          words: pack.words.map(w => ({
            word: w.word.trim(),
            definition: w.definition.trim(),
            example: w.example.trim(),
            ...(w.translationHint ? { translationHint: w.translationHint.trim() } : {}),
          })),
          exercises,
          isActive: true,
        },
        $setOnInsert: key,
      },
      { upsert: true, new: false, rawResult: true }
    );

    const wasUpdate = !!(res && res.lastErrorObject && res.lastErrorObject.updatedExisting);
    if (wasUpdate) updated += 1; else created += 1;
    console.log(`  ${wasUpdate ? 'updated' : 'created'}: ${key.level}/${key.topic} (${pack.words.length} words, ${exercises.length} exercises)`);
  }

  console.log(`[seeds/vocabPacks] done — created ${created}, updated ${updated}, total in file ${packs.length}${dryRun ? ' (dry-run)' : ''}`);
  return { created, updated, total: packs.length };
};

// CLI entry
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => seedVocabPacks({ dryRun }))
    .then(() => mongoose.connection.close())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seeds/vocabPacks] FAILED:', err.message);
      process.exit(1);
    });
}

module.exports = { seedVocabPacks };
