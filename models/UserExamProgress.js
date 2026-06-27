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
  // Per-section tallies, keyed by `ExamSection.sectionType`. Stored as a
  // Map<String, SectionScore> so adding new section variants
  // (writing-task-1, writing-task-2, vocabulary-a1, …) doesn't require
  // a schema change. Mongoose serialises Maps to plain objects, so the
  // API contract reads identically to clients.
  sectionScores: {
    type: Map,
    of: SectionScoreSchema,
    default: () => new Map(),
  },
  overallScore: Number,
  lastAttemptedQuestionId: mongoose.Schema.Types.ObjectId,
  lastUpdated: { type: Date, default: Date.now },
});

UserExamProgressSchema.index({ userId: 1, examId: 1 }, { unique: true });
UserExamProgressSchema.index({ userId: 1 });

module.exports = mongoose.model('UserExamProgress', UserExamProgressSchema);
