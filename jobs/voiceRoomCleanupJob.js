/**
 * Voice Room Cleanup Job
 *
 * Periodically marks rooms as 'ended' when no heartbeat has been received
 * for more than STALE_MS milliseconds (default: 90s).  Clients are expected
 * to send a `voiceroom:heartbeat` socket event every ~30s while in a room.
 */

const VoiceRoom = require('../models/VoiceRoom');

const STALE_MS = 90 * 1000; // 90 seconds
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
  console.log('[voiceRoomCleanup] job started (every 60s, stale > 90s)');
}

module.exports = { start, runVoiceRoomCleanup };
