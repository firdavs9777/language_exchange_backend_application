/**
 * LiveKit admin service.
 *
 * Force-end a LiveKit room or boot a participant from server-side.
 * Fails open: any error is logged and swallowed so it never blocks the
 * Mongo state change or socket fan-out that called it.
 */

const { RoomServiceClient } = require('livekit-server-sdk');

let _client;

const getClient = () => {
  if (_client) return _client;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) {
    throw new Error('LiveKit env not configured (LIVEKIT_API_KEY/SECRET/URL)');
  }
  // RoomServiceClient wants the HTTP base URL, not the WSS one.
  const httpUrl = url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  _client = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  return _client;
};

/**
 * Force-close a LiveKit room. All participants are disconnected at the
 * transport layer. Idempotent — closing an already-closed room is a no-op.
 */
async function endRoom(roomName) {
  try {
    await getClient().deleteRoom(roomName);
  } catch (err) {
    // 404 / room-not-found is benign (already closed)
    const status = err?.status || err?.code;
    if (status !== 404 && status !== 'not_found') {
      console.error('[livekitAdmin] endRoom failed:', roomName, err.message);
    }
  }
}

/**
 * Boot a single participant from a room. Used for voice-room kick. No-throw.
 */
async function disconnectParticipant(roomName, identity) {
  try {
    await getClient().removeParticipant(roomName, identity);
  } catch (err) {
    console.error(
      '[livekitAdmin] disconnectParticipant failed:',
      roomName, identity, err.message
    );
  }
}

module.exports = { endRoom, disconnectParticipant };
