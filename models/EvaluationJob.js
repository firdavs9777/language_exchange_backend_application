const mongoose = require('mongoose');

const EvaluationJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamQuestion',
    required: true,
  },
  userAnswer: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  score: Number,            // 0-100, populated when status='completed'
  feedback: String,         // populated when status='completed'
  strengths: [String],      // optional; bullets pulled from AI response
  improvements: [String],   // optional; same
  // Whisper-STT output for speaking jobs. Null for essay jobs.
  transcript: String,
  // S3 URL for the persisted audio, only set when SPEECH_PERSIST_AUDIO
  // is true. Null otherwise.
  audioUrl: String,
  errorMessage: String,     // populated when status='failed'
  createdAt: { type: Date, default: Date.now },
  completedAt: Date,
});

EvaluationJobSchema.index({ userId: 1, questionId: 1 });
EvaluationJobSchema.index({ status: 1 });

// Auto-cleanup after 7 days — keep the collection bounded since the
// app screen persists draft text but never needs the eval row long-term.
EvaluationJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('EvaluationJob', EvaluationJobSchema);
