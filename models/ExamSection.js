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
    enum: [
      'reading',
      'writing',
      'writing-task-1',
      'writing-task-2',
      'speaking', // legacy
      'speaking-part-1',
      'speaking-part-2',
      'speaking-part-3',
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
