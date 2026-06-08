/**
 * banService — single side-effect implementation for moderator actions
 * on user accounts. Both the report-driven flow
 * (controllers/report.js#resolveReport action=user_banned, refactored
 * in Step 15 B5 to delegate here) and the new manual-ban endpoint
 * (controllers/admin.js#banUser) call into this service so the ban
 * semantics are guaranteed identical.
 *
 * Side-effects on ban:
 *   1. Set User.isBanned=true, banReason, bannedAt
 *   2. End all active voice rooms hosted by the banned user
 *      (mirrors controllers/voiceRooms.js#endVoiceRoom: room.end()
 *      + livekitAdmin.endRoom() + 2 socket emits)
 *   3. Clear User.fcmTokens
 *   4. emailService.sendBanNotification (fire-and-forget)
 *   5. AdminAuditLog.logAction
 *
 * Side-effects on unban:
 *   1. Set User.isBanned=false, banReason=null, bannedAt=null
 *   2. emailService.sendUnbanNotification (fire-and-forget)
 *   3. AdminAuditLog.logAction
 *
 * Side-effects on role change:
 *   1. Set User.role
 *   2. AdminAuditLog.logAction (with from/to in details)
 *
 * All audit log writes are fire-and-forget — failures don't undo the
 * underlying action.
 */

const User = require('../models/User');
const VoiceRoom = require('../models/VoiceRoom');
const AdminAuditLog = require('../models/AdminAuditLog');
const BannedIdentity = require('../models/BannedIdentity');
const livekitAdmin = require('./livekitAdminService');
const emailService = require('./emailService');

exports.banUser = async function ({ userId, reason, moderatorId, source, io }) {
  const user = await User.findById(userId);
  if (!user) {
    await AdminAuditLog.logAction({
      moderator: moderatorId,
      action: 'ban_failed_target_missing',
      target: userId,
      reason,
      source,
    });
    return { ok: false, error: 'User not found' };
  }

  await User.findByIdAndUpdate(userId, {
    isBanned: true,
    banReason: reason || 'Banned by moderator',
    bannedAt: new Date(),
  });

  // Auto-end active voice rooms hosted by the banned user. Mirrors the
  // canonical flow at controllers/voiceRooms.js#endVoiceRoom — room.end()
  // (instance method sets status='ended', endedAt=now) → livekitAdmin.endRoom()
  // → socket emits to both the room channel and the lobby. This evicts
  // participants from LiveKit audio AND updates the lobby listing.
  const activeRooms = await VoiceRoom.find({
    host: userId,
    status: { $in: ['waiting', 'active'] },
  });
  for (const room of activeRooms) {
    try {
      await room.end();
      await livekitAdmin.endRoom(String(room._id));
      if (io) {
        io.to(`voiceroom_${room._id}`).emit('voiceroom:ended', {
          roomId: String(room._id),
          endedBy: 'admin',
        });
        io.to('voicerooms:lobby').emit('voiceroom:ended', {
          roomId: String(room._id),
        });
      }
    } catch (err) {
      console.error(
        `[banService] failed to end room ${room._id}:`,
        err.message
      );
    }
  }

  // Clear FCM tokens so banned user stops getting push.
  await User.findByIdAndUpdate(userId, { $set: { fcmTokens: [] } });

  // Send the banned user an email explaining the ban. Fire-and-forget.
  emailService.sendBanNotification(userId, reason).catch((err) =>
    console.error('[banService] sendBanNotification failed:', err.message)
  );

  await AdminAuditLog.logAction({
    moderator: moderatorId,
    action: 'user_banned',
    target: userId,
    reason,
    source,
    details: { activeRoomsEnded: activeRooms.length },
  });

  return { ok: true };
};

exports.unbanUser = async function ({ userId, reason, moderatorId }) {
  const user = await User.findById(userId);
  if (!user) {
    await AdminAuditLog.logAction({
      moderator: moderatorId,
      action: 'unban_failed_target_missing',
      target: userId,
      reason,
    });
    return { ok: false, error: 'User not found' };
  }

  if (user.isBanned !== true) {
    await AdminAuditLog.logAction({
      moderator: moderatorId,
      action: 'unban_noop',
      target: userId,
      reason,
      details: { already_unbanned: true },
    });
    return { ok: true, noop: true };
  }

  await User.findByIdAndUpdate(userId, {
    isBanned: false,
    banReason: null,
    bannedAt: null,
  });

  emailService.sendUnbanNotification(userId, reason).catch((err) =>
    console.error('[banService] sendUnbanNotification failed:', err.message)
  );

  await AdminAuditLog.logAction({
    moderator: moderatorId,
    action: 'user_unbanned',
    target: userId,
    reason,
  });

  return { ok: true };
};

exports.changeUserRole = async function ({
  userId,
  role,
  reason,
  moderatorId,
}) {
  if (!['user', 'admin'].includes(role)) {
    return { ok: false, error: 'Invalid role' };
  }

  const user = await User.findById(userId);
  if (!user) return { ok: false, error: 'User not found' };

  const previousRole = user.role;
  if (previousRole === role) {
    // Idempotent — still log so we have a trail of who attempted what.
    await AdminAuditLog.logAction({
      moderator: moderatorId,
      action: 'role_change_noop',
      target: userId,
      reason,
      details: { current: role },
    });
    return { ok: true, previousRole, newRole: role, noop: true };
  }

  await User.findByIdAndUpdate(userId, { role });

  await AdminAuditLog.logAction({
    moderator: moderatorId,
    action: 'role_changed',
    target: userId,
    reason,
    details: { from: previousRole, to: role },
  });

  return { ok: true, previousRole, newRole: role };
};

exports.checkBannedIdentity = async function ({ email, googleId, facebookId, appleId } = {}) {
  const conditions = [];
  if (email)      conditions.push({ email });
  if (googleId)   conditions.push({ googleId });
  if (facebookId) conditions.push({ facebookId });
  if (appleId)    conditions.push({ appleId });

  if (conditions.length === 0) return { banned: false };

  const match = await BannedIdentity.findOne({ $or: conditions });
  if (!match) return { banned: false };
  return { banned: true, reason: match.reason || null };
};

exports.hardDeleteUser = async function ({ userId, moderatorId }) {
  const user = await User.findById(userId);

  if (!user) {
    return { ok: false, error: 'User not found' };
  }

  if (user.isBanned !== true) {
    return { ok: false, error: 'User is not banned — ban the account first' };
  }

  const bannedDoc = await BannedIdentity.create({
    email:          user.email || null,
    googleId:       user.googleId || null,
    facebookId:     user.facebookId || null,
    appleId:        user.appleId || null,
    reason:         user.banReason || null,
    bannedAt:       user.bannedAt || null,
    deletedAt:      new Date(),
    moderatorId:    String(moderatorId),
    originalUserId: String(user._id),
  });

  try {
    await User.findByIdAndDelete(userId);
  } catch (err) {
    BannedIdentity.deleteOne({ _id: bannedDoc._id }).catch((rbErr) =>
      console.error('[banService] hardDeleteUser rollback failed:', rbErr.message)
    );
    throw err;
  }

  AdminAuditLog.logAction({
    moderator: moderatorId,
    action: 'user_hard_deleted',
    target: userId,
    reason: user.banReason || null,
    source: 'manual',
  }).catch((err) =>
    console.error('[banService] hardDeleteUser audit log failed:', err.message)
  );

  return { ok: true };
};
