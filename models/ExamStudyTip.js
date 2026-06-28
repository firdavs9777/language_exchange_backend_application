const mongoose = require('mongoose');

/**
 * Short, curated study tips / strategy notes / teaching techniques the
 * app surfaces alongside practice. Each tip is attached to an exam,
 * optionally narrowed to a section type (reading, writing-task-1,
 * speaking-part-2, vocabulary, etc.). Categories let the app group the
 * tips in the UI (Strategy, Grammar, Time Management, Common Mistakes,
 * Band Score Boosters, Cultural Notes).
 */
const ExamStudyTipSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamType',
    required: true,
  },
  // Optional — null means "applies to the whole exam".
  sectionType: { type: String, default: null },
  category: {
    type: String,
    enum: [
      'strategy',
      'grammar',
      'vocabulary',
      'time-management',
      'common-mistakes',
      'band-booster',
      'cultural-notes',
      'pronunciation',
      'fluency',
    ],
    required: true,
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  // Free-form tags for future filtering (e.g. 'band-7+', 'beginner').
  tags: [{ type: String }],
  // Display order within a (exam, sectionType, category) group. Lower
  // values surface first.
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

ExamStudyTipSchema.index({ examId: 1, sectionType: 1, category: 1, order: 1 });
ExamStudyTipSchema.index({ examId: 1, title: 1 });

module.exports = mongoose.model('ExamStudyTip', ExamStudyTipSchema);
