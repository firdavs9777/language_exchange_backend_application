const mongoose = require('mongoose');

const SectionScoreSchema = new mongoose.Schema(
  {
    attempted: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    // Percentage 0-100 for completed-enough sections, null when no
    // questions have been attempted yet.
    score: { type: Number, default: null },
  },
  { _id: false }
);

const UserExamProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamType',
    required: true,
  },
  questionsAttempted: { type: Number, default: 0 },
  questionsCorrect: { type: Number, default: 0 },
  // One sub-doc per section type. Backend MVP only writes reading + writing,
  // but the rest are pre-declared so Phase 2 (speaking/listening/vocab)
  // doesn't need a migration.
  sectionScores: {
    reading: { type: SectionScoreSchema, default: () => ({}) },
    writing: { type: SectionScoreSchema, default: () => ({}) },
    speaking: { type: SectionScoreSchema, default: () => ({}) },
    listening: { type: SectionScoreSchema, default: () => ({}) },
    vocabulary: { type: SectionScoreSchema, default: () => ({}) },
  },
  overallScore: Number,
  lastAttemptedQuestionId: mongoose.Schema.Types.ObjectId,
  lastUpdated: { type: Date, default: Date.now },
});

UserExamProgressSchema.index({ userId: 1, examId: 1 }, { unique: true });
UserExamProgressSchema.index({ userId: 1 });

module.exports = mongoose.model('UserExamProgress', UserExamProgressSchema);
