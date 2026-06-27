const mongoose = require('mongoose');

const ExamQuestionSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamType',
    required: true,
  },
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamSection',
    required: true,
  },
  questionText: { type: String, required: true },
  questionType: {
    type: String,
    enum: ['multiple-choice', 'essay', 'speaking-prompt', 'fill-blank'],
    required: true,
  },
  // Mixed so MC can store a string ("A") while fill-blank can store text.
  correctAnswer: mongoose.Schema.Types.Mixed,
  options: [String],
  audioUrl: String,
  imageUrl: String,
  explanation: String,
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  source: {
    type: String,
    enum: ['builtin', 'ai-generated'],
    default: 'builtin',
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ExamQuestionSchema.index({ examId: 1, sectionId: 1 });
ExamQuestionSchema.index({ sectionId: 1, difficulty: 1 });
ExamQuestionSchema.index({ source: 1 });

module.exports = mongoose.model('ExamQuestion', ExamQuestionSchema);
