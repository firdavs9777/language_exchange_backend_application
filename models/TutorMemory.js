const mongoose = require('mongoose');

const WeakAreaSchema = new mongoose.Schema({
  topic:     { type: String, required: true },
  frequency: { type: Number, default: 1 },
  lastSeen:  { type: Date,   default: Date.now },
  // H6 (workstream-h-aistudy) — mastery/decay lifecycle:
  // successCount: times the user exercised this area successfully (e.g.
  //   completing a grammar drill on the topic). At 3, the daily decay job
  //   sets resolvedAt.
  successCount:  { type: Number, default: 0 },
  // resolvedAt: excluded from prompts forever once set; never auto-resurrected
  //   (a new struggle writes a fresh entry instead).
  resolvedAt:    { type: Date },
  // lastDecayedAt: makes the 14-day frequency-halving idempotent per window
  //   (see lib/tutorMemoryDecay.js + jobs/tutorMemoryDecayJob.js).
  lastDecayedAt: { type: Date },
}, { _id: false });

const VocabFocusSchema = new mongoose.Schema({
  wordId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Vocabulary' },
  status:       { type: String, enum: ['learning', 'mastered'], default: 'learning' },
  lastReviewed: { type: Date },
}, { _id: false });

const ChatSummarySchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AITutorSession' },
  summary:   { type: String, maxlength: 200 },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const DailyPlanTaskSchema = new mongoose.Schema({
  type:      { type: String, enum: ['srs_review', 'grammar_drill', 'tutor_chat', 'tutor_pronunciation'], required: true },
  count:     { type: Number },
  topic:     { type: String },
  minutes:   { type: Number },
  completed: { type: mongoose.Schema.Types.Mixed, default: 0 },
}, { _id: false });

const DailyPlanSchema = new mongoose.Schema({
  date:  { type: Date, required: true },
  tasks: { type: [DailyPlanTaskSchema], default: [] },
}, { _id: false });

const TutorMemorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  // No `default: null` — Mongoose's enum validator rejects null even when
  // null isn't in the enum array, so an unset persona stays `undefined`.
  // Client-side `memory.persona == null` works for both undefined + null.
  persona:             { type: String, enum: ['nana', 'sensei', 'riko'] },
  proficiencyLevel:    { type: String, enum: ['A1','A2','B1','B2','C1','C2'], default: 'A1' },
  targetLanguages:     { type: [String], default: [] },
  nativeLanguage:      { type: String, default: '' },
  weakAreas:           { type: [WeakAreaSchema], default: [] },
  vocabFocus:          { type: [VocabFocusSchema], default: [] },
  recentChatSummaries: { type: [ChatSummarySchema], default: [] },
  dailyPlan:           { type: DailyPlanSchema, default: null },
  lastSeen:            { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('TutorMemory', TutorMemorySchema);
