/**
 * Voice Room Cleanup Job
 *
 * Periodically marks rooms as 'ended' when no heartbeat has been received
 * for more than STALE_MS milliseconds.
 *
 * STALE_MS is intentionally generous (30 minutes) right after the heartbeat
 * feature deploys — old Flutter clients in the wild don't emit
 * `voiceroom:heartbeat`, so a tight 90s window would kill their rooms
 * shortly after creation. Once app-update adoption is high (~1-2 weeks
 * post-launch), tighten this back to 90s for sharper cleanup.
 *
 * Tunable via VOICE_ROOM_STALE_MS env var (milliseconds).
 *
 * Clients on the new app emit `voiceroom:heartbeat` every ~20s while in
 * a room (see Flutter `VoiceRoomManager._heartbeatTimer`).
 */

const VoiceRoom = require('../models/VoiceRoom');

const DEFAULT_STALE_MS = 30 * 60 * 1000; // 30 minutes — generous for legacy clients
const STALE_MS = parseInt(process.env.VOICE_ROOM_STALE_MS, 10) || DEFAULT_STALE_MS;
const INTERVAL_MS = 60 * 1000; // run every 60 seconds

async function runVoiceRoomCleanup() {
  try {
    const cutoff = new Date(Date.now() - STALE_MS);
    const result = await VoiceRoom.updateMany(
      {
        status: { $in: ['waiting', 'active'] },
        lastHeartbeatAt: { $lt: cutoff }
      },
      {
        $set: {
          status: 'ended',
          endedAt: new Date()
        }
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`[voiceRoomCleanup] Marked ${result.modifiedCount} stale room(s) as ended`);
    }
  } catch (err) {
    console.error('[voiceRoomCleanup]', err);
  }
}

function start() {
  setInterval(runVoiceRoomCleanup, INTERVAL_MS);
  const staleMin = Math.round(STALE_MS / 1000 / 60);
  console.log(`[voiceRoomCleanup] job started (every 60s, stale > ${staleMin}min)`);
}

module.exports = { start, runVoiceRoomCleanup };
