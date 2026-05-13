const mongoose = require('mongoose');

const TutorMessageSchema = new mongoose.Schema({
  role:        { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content:     { type: String, default: '' },
  messageType: { type: String, enum: ['text', 'quiz_card', 'vocab_card', 'grammar_card', 'srs_due_card', 'mini_lesson_card'], default: 'text' },
  payload:     { type: mongoose.Schema.Types.Mixed },
  createdAt:   { type: Date, default: Date.now },
}, { _id: true });

const AITutorSessionSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  persona:   { type: String, enum: ['nana', 'sensei', 'riko'], required: true },
  messages:  { type: [TutorMessageSchema], default: [] },
  startedAt: { type: Date, default: Date.now },
  endedAt:   { type: Date },
  summary:   { type: String, maxlength: 200 },
}, { timestamps: true });

AITutorSessionSchema.index({ user: 1, startedAt: -1 });

module.exports = mongoose.model('AITutorSession', AITutorSessionSchema);
