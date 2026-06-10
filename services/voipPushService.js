/**
 * iOS PushKit VoIP push delivery (for incoming-call ringing UX).
 *
 * Why VoIP pushes (vs. FCM/silent APNs)?
 *   Apple aggressively throttles silent pushes (`content-available: 1`)
 *   when the app is backgrounded or killed — they can arrive minutes late
 *   or be dropped entirely. VoIP pushes (`apns-push-type: voip`, topic
 *   suffixed with `.voip`) are delivered immediately and wake the app from
 *   any state. The trade-off: iOS 13+ enforces that EVERY VoIP push must
 *   trigger `CXProvider.reportNewIncomingCall` within seconds, otherwise
 *   Apple revokes the app's VoIP entitlement. AppDelegate.swift's
 *   `pushRegistry(_:didReceiveIncomingPushWith:...)` always forwards to
 *   the flutter_callkit_incoming plugin which handles that contract — so
 *   we never send a VoIP push that doesn't result in a CallKit prompt.
 *
 * Setup checklist:
 *   1. `npm install @parse/node-apn` in backend/
 *   2. Apple Developer portal → Keys → create a key with "Apple Push
 *      Notifications service (APNs)" enabled. Download the `.p8` file.
 *   3. Set env (e.g., in config/config.env or droplet env):
 *        APNS_VOIP_KEY_PATH=/etc/secrets/AuthKey_XXXXXXXXXX.p8
 *        APNS_VOIP_KEY_ID=XXXXXXXXXX           (10 chars, from filename)
 *        APNS_VOIP_TEAM_ID=YYYYYYYYYY          (10 chars, Apple team id)
 *        APNS_VOIP_TOPIC=com.bananatalk.app.voip
 *        APNS_VOIP_PRODUCTION=true             (false for dev sandbox)
 *
 * If anything is missing this module exports a no-op `send()` that logs
 * once and returns false — the rest of the backend (FCM path) keeps
 * delivering, just with iOS throttling on killed-state.
 */

const fs = require('fs');

let apnProvider = null;
let apnLoaded = false;
let logged = false;

function init() {
  if (apnLoaded) return apnProvider;
  apnLoaded = true;

  const {
    APNS_VOIP_KEY_PATH,
    APNS_VOIP_KEY_ID,
    APNS_VOIP_TEAM_ID,
    APNS_VOIP_TOPIC,
    APNS_VOIP_PRODUCTION,
  } = process.env;

  if (
    !APNS_VOIP_KEY_PATH ||
    !APNS_VOIP_KEY_ID ||
    !APNS_VOIP_TEAM_ID ||
    !APNS_VOIP_TOPIC
  ) {
    if (!logged) {
      console.warn(
        '[voipPush] APNS_VOIP_* env vars not fully set — VoIP push delivery disabled. ' +
        'iOS killed-state calls will fall back to throttled FCM silent pushes.'
      );
      logged = true;
    }
    return null;
  }

  let apn;
  try {
    apn = require('@parse/node-apn');
  } catch (err) {
    if (!logged) {
      console.warn(
        '[voipPush] @parse/node-apn not installed — VoIP push delivery disabled. ' +
        'Run `npm install @parse/node-apn` in backend/ to enable.'
      );
      logged = true;
    }
    return null;
  }

  if (!fs.existsSync(APNS_VOIP_KEY_PATH)) {
    console.warn(`[voipPush] APNS_VOIP_KEY_PATH not readable: ${APNS_VOIP_KEY_PATH}`);
    return null;
  }

  apnProvider = new apn.Provider({
    token: {
      key: APNS_VOIP_KEY_PATH,
      keyId: APNS_VOIP_KEY_ID,
      teamId: APNS_VOIP_TEAM_ID,
    },
    production: APNS_VOIP_PRODUCTION === 'true',
  });

  console.log(
    `[voipPush] initialised (topic=${APNS_VOIP_TOPIC}, production=${APNS_VOIP_PRODUCTION === 'true'})`
  );
  return apnProvider;
}

/**
 * Send a VoIP push to one device token. Returns true on success, false on
 * any failure (caller should still fall back to the regular FCM path).
 *
 * `payload` is the dictionary that AppDelegate.swift parses in
 * pushRegistry(_:didReceiveIncomingPushWith:_:_:). Keys it reads:
 *   - id (string, call id)
 *   - nameCaller (string)
 *   - handle (string, optional)
 *   - isVideo (bool) or callType ("video"/"audio")
 *   - livekitToken, livekitUrl, roomName (string, optional pre-mint)
 *   - callerId, callerProfilePicture, callType (forwarded into `extra`)
 */
async function send(deviceToken, payload) {
  const provider = init();
  if (!provider) return false;

  let apn;
  try {
    apn = require('@parse/node-apn');
  } catch (_) {
    return false;
  }

  const note = new apn.Notification();
  note.topic = process.env.APNS_VOIP_TOPIC;
  note.pushType = 'voip';
  note.expiry = Math.floor(Date.now() / 1000) + 30; // 30s — call rings limited time anyway
  note.priority = 10;
  note.payload = payload;

  try {
    const result = await provider.send(note, deviceToken);
    if (result.failed && result.failed.length > 0) {
      const fail = result.failed[0];
      console.warn(
        `[voipPush] APNs rejected token: status=${fail.status} reason=${
          fail.response && fail.response.reason
        }`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error('[voipPush] send error:', err.message);
    return false;
  }
}

/**
 * Send a VoIP push to every active token a user has registered. Tokens
 * that fail (e.g., uninstalled, expired) are NOT auto-pruned here — that
 * would require touching the User model from inside a hot dispatch path.
 * A periodic cleanup job can prune voipTokens whose lastUpdated is older
 * than ~30 days OR whose last send returned BadDeviceToken.
 */
async function sendToUser(user, payload) {
  if (!user || !Array.isArray(user.voipTokens) || user.voipTokens.length === 0) {
    return false;
  }
  const active = user.voipTokens.filter(t => t.active && t.token);
  if (active.length === 0) return false;

  const results = await Promise.all(
    active.map(t => send(t.token, payload).catch(() => false))
  );
  return results.some(Boolean);
}

module.exports = { send, sendToUser };
