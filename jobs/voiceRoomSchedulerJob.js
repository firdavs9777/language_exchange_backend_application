/**
 * Voice Room Scheduler Job
 *
 * Two responsibilities:
 * 1. Flip scheduled rooms with `scheduledFor <= now` to `status: 'active'`,
 *    notify host + RSVPs.
 * 2. Fire 1h and 15min reminder pushes for upcoming rooms (idempotent via
 *    `remindersSent` array).
 *
 * Runs every 60s. Uses atomic findOneAndUpdate to guard against double-firing
 * if cron overruns.
 */

const VoiceRoom = require('../models/VoiceRoom');
const {
  sendScheduledRoomStarted,
  sendScheduledRoomReminder,
} = require('../services/notificationService');

const TICK_MS = 60 * 1000;

let _intervalHandle = null;

async function _runStarts() {
  const now = new Date();
  const toStart = await VoiceRoom.find({
    status: 'scheduled',
    scheduledFor: { $lte: now },
  }).select('_id host title rsvps');

  for (const room of toStart) {
    try {
      const updated = await VoiceRoom.findOneAndUpdate(
        { _id: room._id, status: 'scheduled' },
        { $set: { status: 'active', lastHeartbeatAt: now } },
        { new: true }
      );
      if (!updated) continue;

      const recipients = [String(updated.host)];
      for (const r of updated.rsvps) {
        recipients.push(String(r.user));
      }
      const unique = [...new Set(recipients)];
      for (const userId of unique) {
        sendScheduledRoomStarted(userId, updated._id, updated.title).catch(err =>
          console.error('[voiceRoomScheduler/start] push failed:', err.message)
        );
      }
    } catch (err) {
      console.error('[voiceRoomScheduler/_runStarts]', err);
    }
  }
}

async function _runReminders() {
  const now = new Date();
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  const in15min = new Date(now.getTime() + 15 * 60 * 1000);

  // 1-hour reminders: room starts between now+15min and now+1h, not yet reminded
  const due1h = await VoiceRoom.find({
    status: 'scheduled',
    scheduledFor: { $lte: in1h, $gt: in15min },
    remindersSent: { $nin: ['1h'] },
  }).select('_id title rsvps');

  for (const room of due1h) {
    try {
      const updated = await VoiceRoom.findOneAndUpdate(
        { _id: room._id, remindersSent: { $nin: ['1h'] } },
        { $push: { remindersSent: '1h' } },
        { new: true }
      );
      if (!updated) continue;
      for (const r of updated.rsvps) {
        sendScheduledRoomReminder(r.user, updated._id, updated.title, '1h').catch(err =>
          console.error('[voiceRoomScheduler/reminder1h] push failed:', err.message)
        );
      }
    } catch (err) {
      console.error('[voiceRoomScheduler/_runReminders 1h]', err);
    }
  }

  // 15-minute reminders: room starts between now and now+15min, not yet reminded
  const due15 = await VoiceRoom.find({
    status: 'scheduled',
    scheduledFor: { $lte: in15min, $gt: now },
    remindersSent: { $nin: ['15min'] },
  }).select('_id title rsvps');

  for (const room of due15) {
    try {
      const updated = await VoiceRoom.findOneAndUpdate(
        { _id: room._id, remindersSent: { $nin: ['15min'] } },
        { $push: { remindersSent: '15min' } },
        { new: true }
      );
      if (!updated) continue;
      for (const r of updated.rsvps) {
        sendScheduledRoomReminder(r.user, updated._id, updated.title, '15min').catch(err =>
          console.error('[voiceRoomScheduler/reminder15] push failed:', err.message)
        );
      }
    } catch (err) {
      console.error('[voiceRoomScheduler/_runReminders 15min]', err);
    }
  }
}

function start() {
  if (_intervalHandle) return;
  _intervalHandle = setInterval(() => {
    _runStarts().catch(err => console.error('[voiceRoomScheduler]', err));
    _runReminders().catch(err => console.error('[voiceRoomScheduler]', err));
  }, TICK_MS);
  console.log('[voiceRoomScheduler] job started (every 60s)');
}

function stop() {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}

module.exports = { start, stop, _runStarts, _runReminders };
