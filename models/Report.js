const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, "Please add the type of report"],
    enum: ["user", "moment", "comment", "message", "story"],
  },
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "Reported item ID is required"],
    refPath: "type",
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Reporter user ID is required"],
  },
  // Owner of the reported content
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Reported user ID is required"],
  },
  reason: {
    type: String,
    required: [true, "Report reason is required"],
    enum: [
      "spam",
      "harassment",
      "hate_speech",
      "violence",
      "nudity",
      "false_information",
      "copyright",
      "other",
    ],
  },
  description: {
    type: String,
    maxlength: [500, "Description cannot exceed 500 characters"],
    trim: true,
  },
  status: {
    type: String,
    enum: ["pending", "under_review", "resolved", "dismissed"],
    default: "pending",
  },
  moderatorAction: {
    type: String,
    enum: [
      "pending",
      "content_removed",
      "user_warned",
      "user_suspended",
      "user_banned",
      "no_violation",
    ],
    default: "pending",
  },
    moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  // Moderator notes
  moderatorNotes: {
    type: String,
    maxlength: [1000, "Moderator notes cannot exceed 1000 characters"],
  },

  // When the report was reviewed
  reviewedAt: {
    type: Date,
  },

  // When the report was resolved
  resolvedAt: {
    type: Date,
  },

  // Priority level
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium",
  },

  // Whether the content is still visible
  contentHidden: {
    type: Boolean,
    default: false,
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});
// Update updatedAt on save
ReportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ reportedBy: 1 });
ReportSchema.index({ reportedUser: 1 });
ReportSchema.index({ type: 1, reportId: 1 });
// Compound index to prevent duplicate reports efficiently
ReportSchema.index({ reportedBy: 1, type: 1, reportId: 1 }, { unique: true });

// Method to mark as resolved
ReportSchema.methods.resolve = function(moderatorId, action, notes) {
  this.status = 'resolved';
  this.moderatedBy = moderatorId;
  this.moderatorAction = action;
  this.moderatorNotes = notes;
  this.reviewedAt = Date.now();
  this.resolvedAt = Date.now();
  return this.save();
};

// Method to mark as under review
ReportSchema.methods.startReview = function(moderatorId) {
  this.status = 'under_review';
  this.moderatedBy = moderatorId;
  this.reviewedAt = Date.now();
  return this.save();
};

// Static method to get pending reports count
ReportSchema.statics.getPendingCount = function() {
  return this.countDocuments({ status: 'pending' });
};

// Static method to get reports by user
ReportSchema.statics.getReportsByUser = function(userId) {
  return this.find({ reportedUser: userId }).sort({ createdAt: -1 });
};

// Static method to check if content is already reported by user
ReportSchema.statics.hasUserReported = async function(userId, type, reportId) {
  const existingReport = await this.findOne({
    reportedBy: userId,
    type: type,
    reportId: reportId
  });
  return !!existingReport;
};

module.exports = mongoose.model("Report", ReportSchema);
