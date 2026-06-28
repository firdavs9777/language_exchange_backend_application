const mongoose = require('mongoose');

/**
 * Shared word bank for the Exam Study Vocabulary feature.
 *
 * Distinct from the user-owned `Vocabulary` model (which tracks each user's
 * personal SRS list). Words here are read-only seed content: every learner
 * sees the same word for the same (language, level, topic).
 */
const ExamVocabularyWordSchema = new mongoose.Schema({
  word: { type: String, required: true, trim: true },
  languageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamLanguage',
    required: true,
  },
  // A word can apply to multiple exams (e.g. an academic word useful for both
  // IELTS and TOEFL). For our 3-exam MVP this is usually a single ref.
  examIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamType',
  }],
  level: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    required: true,
  },
  // Free-form topic tag matching ExamQuestion.topic vocabulary.
  topic: { type: String, default: null },
  partOfSpeech: {
    type: String,
    enum: ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'],
    default: 'other',
  },
  definition: { type: String, required: true },
  exampleSentence: { type: String, default: '' },
  // Populated lazily on first listen by the TTS pipeline (existing
  // speechService). Null until then.
  audioUrl: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

// Browse-by-level, browse-by-topic, per-exam quiz draw.
ExamVocabularyWordSchema.index({ languageId: 1, level: 1, topic: 1 });
ExamVocabularyWordSchema.index({ examIds: 1, level: 1 });
// Dedup hint for idempotent seed (no unique constraint — the seed checks
// explicitly so it can survive transitional duplicates).
ExamVocabularyWordSchema.index({ languageId: 1, word: 1 });

module.exports = mongoose.model('ExamVocabularyWord', ExamVocabularyWordSchema);
