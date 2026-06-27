const mongoose = require('mongoose');

const ExamTypeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  languageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamLanguage',
    required: true,
  },
  description: String,
  sections: [
    {
      type: String,
      enum: ['reading', 'writing', 'speaking', 'listening', 'vocabulary'],
    },
  ],
  durationMinutes: Number,
  scoringType: {
    type: String,
    enum: ['band', 'score'],
    default: 'score',
  },
  maxScore: Number,
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

ExamTypeSchema.index({ languageId: 1 });
ExamTypeSchema.index({ active: 1 });

module.exports = mongoose.model('ExamType', ExamTypeSchema);
