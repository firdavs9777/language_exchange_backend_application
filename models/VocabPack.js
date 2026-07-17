const mongoose = require('mongoose');

/**
 * VocabPack — curated, level-tagged vocabulary packs (H9, workstream-h-aistudy).
 *
 * Seeded server-side by seeds/vocabPacks.js from migrations/vocabPacksData.json
 * (headword inventory only derives from reference books; all definitions,
 * examples, hints, and exercises are original generated content — copyright
 * boundary). Users browse packs (GET /learning/vocab-packs), pull a pack's
 * full content (GET /learning/vocab-packs/:id), and bulk-add its words into
 * their personal Vocabulary (POST /learning/vocab-packs/:id/add), which feeds
 * SRS review, vocabFocus, story generation, and the Today surface.
 */
const VocabPackWordSchema = new mongoose.Schema({
  word:            { type: String, required: true, trim: true, maxlength: 200 },
  definition:      { type: String, required: true, trim: true, maxlength: 500 },
  example:         { type: String, required: true, trim: true, maxlength: 500 },
  translationHint: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

/**
 * A single practice item attached to a pack. One flexible schema covers all
 * exercise types (the fields used depend on `type`):
 * - multiple_choice: prompt, options[], answerIndex, targetWord
 * - fill_blank:      prompt (contains ___), answer, targetWord
 * - matching:        pairs[{ term, definition }]
 * - error_correction:prompt, corrected, targetWord
 */
const VocabPackExercisePairSchema = new mongoose.Schema({
  term:       { type: String, trim: true, maxlength: 200 },
  definition: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

const VocabPackExerciseSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['multiple_choice', 'fill_blank', 'matching', 'error_correction'],
    required: true,
  },
  prompt:      { type: String, trim: true, maxlength: 600 },
  options:     { type: [String], default: undefined },
  answerIndex: { type: Number },
  answer:      { type: String, trim: true, maxlength: 300 },
  corrected:   { type: String, trim: true, maxlength: 600 },
  targetWord:  { type: String, trim: true, maxlength: 200 },
  pairs:       { type: [VocabPackExercisePairSchema], default: undefined },
}, { _id: false });

const VocabPackSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['intermediate', 'advanced'],
    required: true,
    index: true,
  },
  topic: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  // Language of the headwords. English-only for the first wave; field kept
  // explicit so future packs don't need a migration.
  language: {
    type: String,
    default: 'English',
    index: true,
  },
  words: {
    type: [VocabPackWordSchema],
    default: [],
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.length > 0,
      message: 'A pack must contain at least one word',
    },
  },
  // Optional authored practice items. Packs without exercises fall back to the
  // server-generated multiple-choice quiz built from `words`.
  exercises: {
    type: [VocabPackExerciseSchema],
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, { timestamps: true });

// One pack per (level, topic, language) — the seeder's upsert key.
VocabPackSchema.index({ level: 1, topic: 1, language: 1 }, { unique: true });

module.exports = mongoose.model('VocabPack', VocabPackSchema);
