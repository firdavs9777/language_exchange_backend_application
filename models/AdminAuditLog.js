const mongoose = require('mongoose');

/**
 * AdminAuditLog — durable record of moderator actions.
 *
 * Append-only. No TTL: mod accountability needs multi-year retention.
 * At ~1K active users, expected volume is ~50-100 actions/year — tiny
 * storage cost relative to the visibility benefit.
 *
 * `action` is an open string; conventional values used by Step 15:
 *   user_banned, user_unbanned, unban_noop,
 *   ban_failed_target_missing, unban_failed_target_missing,
 *   role_changed
 *
 * `source` carries provenance:
 *   'manual' — admin took direct action via /admin/users/:id/...
 *   'report:<reportId>' — action originated from a report resolution
 *   null — for legacy/system actions
 */
const AdminAuditLogSchema = new mongoose.Schema({
  moderator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  target: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  targetType: {
    type: String,
    default: 'user',
  },
  reason: {
    type: String,
    default: null,
  },
  source: {
    type: String,
    default: null,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

AdminAuditLogSchema.index({ moderator: 1, timestamp: -1 });
AdminAuditLogSchema.index({ target: 1, timestamp: -1 });
AdminAuditLogSchema.index({ action: 1, timestamp: -1 });

// Fire-and-forget logger. Never throws to the caller — a failed audit
// write should not undo the underlying moderator action.
AdminAuditLogSchema.statics.logAction = async function (entry) {
  try {
    return await this.create({
      moderator: entry.moderator,
      action: entry.action,
      target: entry.target || null,
      targetType: entry.targetType || 'user',
      reason: entry.reason || null,
      source: entry.source || null,
      details: entry.details || {},
    });
  } catch (err) {
    console.error('[AdminAuditLog] write failed:', err.message);
    return null;
  }
};

module.exports = mongoose.model('AdminAuditLog', AdminAuditLogSchema);
