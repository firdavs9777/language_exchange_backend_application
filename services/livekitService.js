/**
 * LiveKit Service
 * Mints short-lived JWT access tokens so clients can connect directly to LiveKit Cloud.
 * Media never traverses our backend — we only authorize joins.
 */

const { AccessToken } = require('livekit-server-sdk');

const DEFAULT_TTL_SECONDS = 60 * 60; // 1 hour

const requireEnv = () => {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) {
    throw new Error('LiveKit env not configured (LIVEKIT_API_KEY/SECRET/URL)');
  }
  return { apiKey, apiSecret, url };
};

/**
 * Mint a join token for a given identity + room.
 *
 * @param {Object} opts
 * @param {string} opts.identity           Stable participant id (use User._id.toString()).
 * @param {string} opts.name               Display name shown to other participants.
 * @param {string} opts.roomName           Room to grant access to.
 * @param {boolean} [opts.canPublish=true] Allow publishing audio/video tracks.
 * @param {boolean} [opts.canSubscribe=true] Allow subscribing to other participants.
 * @param {Object}  [opts.metadata]        Optional JSON metadata attached to the participant.
 * @param {number}  [opts.ttlSeconds=3600] Token lifetime in seconds.
 * @returns {Promise<{token: string, url: string}>}
 */
const mintRoomToken = async ({
  identity,
  name,
  roomName,
  canPublish = true,
  canSubscribe = true,
  metadata,
  ttlSeconds = DEFAULT_TTL_SECONDS,
}) => {
  if (!identity) throw new Error('identity required');
  if (!roomName) throw new Error('roomName required');

  const { apiKey, apiSecret, url } = requireEnv();

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: name || identity,
    ttl: ttlSeconds,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish,
    canSubscribe,
    canPublishData: true,
  });

  const token = await at.toJwt();
  return { token, url };
};

module.exports = { mintRoomToken };
