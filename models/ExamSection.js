const mongoose = require('mongoose');

const ExamSectionSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamType',
    required: true,
  },
  sectionName: { type: String, required: true },
  sectionType: {
    type: String,
    // `writing` is kept as a legacy value for any pre-split rows; new
    // seed migration uses writing-task-1 / writing-task-2 so progress
    // tracks each task independently.
    enum: [
      'reading',
      'writing',
      'writing-task-1',
      'writing-task-2',
      'speaking',
      'listening',
      'vocabulary',
    ],
    required: true,
  },
  description: String,
  durationMinutes: Number,
  questionCount: { type: Number, default: 20 },
  createdAt: { type: Date, default: Date.now },
});

ExamSectionSchema.index({ examId: 1, sectionType: 1 });

module.exports = mongoose.model('ExamSection', ExamSectionSchema);
