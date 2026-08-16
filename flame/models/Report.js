const mongoose = require('mongoose');
const { getConn } = require('../db');

// Reason strings are the app's ReportReason enum verbatim
// (flame_front_app lib/services/report_service.dart). Do not invent new
// vocabulary here — the app already serialises to these.
const REASONS = [
  'inappropriate_content',
  'fake_profile',
  'harassment',
  'spam',
  'underage',
  'other',
];

const reportSchema = new mongoose.Schema(
  {
    reportedBy: { type: String, required: true, index: true },
    reportedUser: { type: String, required: true, index: true },
    reason: { type: String, enum: REASONS, required: true },
    description: { type: String, maxlength: 500, default: null },
    // Carried from day one though nothing reads it yet, so a moderation queue
    // can be added later without a migration.
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending',
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false }, collection: 'reports' },
);

module.exports = getConn().model('Report', reportSchema);
module.exports.REASONS = REASONS;
