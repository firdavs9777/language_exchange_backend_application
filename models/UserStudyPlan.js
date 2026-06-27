const mongoose = require('mongoose');

// Subdoc — one row in the weekly milestone roadmap.
const MilestoneSchema = new mongoose.Schema(
  {
    week: { type: Number, required: true },
    focus: { type: String, required: true },
    tasks: [String],
    estimatedHours: { type: Number, default: 8 },
  },
  { _id: false }
);

// Subdoc — one row in the day-by-day plan. Phase 1 keeps it light:
// section + topic + estimated time.
const DailyLessonSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    section: String,
    topic: String,
    estimatedMinutes: { type: Number, default: 45 },
  },
  { _id: false }
);

const UserStudyPlanSchema = new mongoose.Schema({
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
  targetScore: Number,
  targetExamDate: Date,
  plan: {
    milestones: [MilestoneSchema],
    dailyLessons: [DailyLessonSchema],
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active',
  },
  createdAt: { type: Date, default: Date.now },
});

// One active plan per (user, exam) — regenerating updates in place.
UserStudyPlanSchema.index({ userId: 1, examId: 1 });

module.exports = mongoose.model('UserStudyPlan', UserStudyPlanSchema);
