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
    enum: ['reading', 'writing', 'speaking', 'listening', 'vocabulary'],
    required: true,
  },
  description: String,
  durationMinutes: Number,
  questionCount: { type: Number, default: 20 },
  createdAt: { type: Date, default: Date.now },
});

ExamSectionSchema.index({ examId: 1, sectionType: 1 });

module.exports = mongoose.model('ExamSection', ExamSectionSchema);
