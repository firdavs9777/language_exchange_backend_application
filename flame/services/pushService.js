const admin = require('firebase-admin');
const User = require('../models/User');
const logger = require('../utils/logger');

// Lazy require: conversationControlsService requires chatService, which is a
// heavier dependency chain than pushService otherwise needs. Nothing in that
// chain requires pushService back, so this isn't a cycle — just deferred to
// keep pushService's own module load light.
function _conversationControls() {
  return require('./conversationControlsService');
}

// Guarded push service: NEVER throws, at require-time or call-time. Every
// public function is a no-op (returns { skipped: true }) whenever Firebase
// isn't configured for flame — which is the case in dev/CI until
// FLAME_FIREBASE_PROJECT_ID (+ credentials) are provided.

let initAttempted = false;
let configured = false;
let flameApp = null;

const APP_NAME = 'flame';

// Lazy, cached, try/catch-guarded init. Runs at most once per process.
function init() {
  if (initAttempted) return configured;
  initAttempted = true;

  if (!process.env.FLAME_FIREBASE_PROJECT_ID) {
    configured = false;
    return configured;
  }

  try {
    const existing = admin.apps.find((a) => a && a.name === APP_NAME);
    if (existing) {
      flameApp = existing;
    } else {
      const credential = process.env.FLAME_FIREBASE_SERVICE_ACCOUNT
        ? admin.credential.cert(require(process.env.FLAME_FIREBASE_SERVICE_ACCOUNT))
        : admin.credential.applicationDefault();
      flameApp = admin.initializeApp(
        { credential, projectId: process.env.FLAME_FIREBASE_PROJECT_ID },
        APP_NAME,
      );
    }
    configured = true;
  } catch (err) {
    logger.warn('pushService: firebase init failed, pushes disabled —', err.message);
    configured = false;
    flameApp = null;
  }

  return configured;
}

function isConfigured() {
  return init();
}

// FCM requires all `data` values to be strings.
function sanitizeData(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value !== null && value !== undefined) {
      out[key] = typeof value === 'string' ? value : String(value);
    }
  }
  return out;
}

// Remove tokens FCM reports as dead/invalid. Best-effort — never throws.
async function pruneTokens(userId, tokens, responses) {
  try {
    const toRemove = [];
    responses.forEach((res, idx) => {
      if (!res.success) {
        const code = res.error && res.error.code;
        if (
          code === 'messaging/registration-token-not-registered'
          || code === 'messaging/invalid-argument'
        ) {
          toRemove.push(tokens[idx].token);
        }
      }
    });
    if (toRemove.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { token: { $in: toRemove } } },
      });
      logger.info(`pushService: pruned ${toRemove.length} dead token(s) for user ${userId}`);
    }
  } catch (err) {
    logger.warn('pushService: pruneTokens failed —', err.message);
  }
}

/**
 * Send a push to every active device of `userId`.
 * Always resolves — never throws. Returns { sent } on an actual send
 * attempt, or { sent: 0, skipped: true } whenever the send was skipped
 * (unconfigured, notifications disabled, user missing, no active tokens).
 */
async function sendToUser(userId, { title, body, data = {} } = {}) {
  let user;
  try {
    user = await User.findById(userId);
  } catch (err) {
    logger.warn(`pushService: failed to load user ${userId} —`, err.message);
    return { sent: 0, skipped: true };
  }

  if (!user || user.isDeleted) {
    logger.info(`pushService: user ${userId} not found, skipping push`);
    return { sent: 0, skipped: true };
  }

  if (!isConfigured()) {
    logger.info('pushService: firebase not configured, skipping push');
    return { sent: 0, skipped: true };
  }

  const settings = user.notificationSettings || {};
  if (settings.enabled === false) {
    logger.info(`pushService: notifications disabled for user ${userId}, skipping push`);
    return { sent: 0, skipped: true };
  }

  const activeTokens = (user.fcmTokens || []).filter((t) => t.active);
  if (activeTokens.length === 0) {
    logger.info(`pushService: no active tokens for user ${userId}, skipping push`);
    return { sent: 0, skipped: true };
  }

  try {
    const message = {
      notification: { title, body },
      data: sanitizeData(data),
      tokens: activeTokens.map((t) => t.token),
    };
    const response = await flameApp.messaging().sendEachForMulticast(message);
    if (response.failureCount > 0) {
      await pruneTokens(userId, activeTokens, response.responses);
    }
    logger.info(`pushService: sent to user ${userId} — ${response.successCount} delivered, ${response.failureCount} failed`);
    return { sent: response.successCount };
  } catch (err) {
    logger.warn(`pushService: send failed for user ${userId} —`, err.message);
    return { sent: 0, skipped: true };
  }
}

/**
 * Send a chat-message push to `receiverId`. Respects
 * notificationSettings.chatMessages (in addition to the global `enabled`
 * gate applied by sendToUser). Never throws.
 */
async function sendChatMessage(receiverId, { senderName, text, conversationId } = {}) {
  let user;
  try {
    user = await User.findById(receiverId);
  } catch (err) {
    logger.warn(`pushService: failed to load user ${receiverId} —`, err.message);
    return { skipped: true };
  }

  if (!user || user.isDeleted) {
    return { skipped: true };
  }

  const settings = user.notificationSettings || {};
  if (settings.chatMessages === false) {
    logger.info(`pushService: chatMessages disabled for user ${receiverId}, skipping`);
    return { skipped: true };
  }

  // A muted conversation still appears in the list and still accrues unread
  // count — mute only silences the push. Argument order is
  // (conversationId, userId), matching conversationControlsService's contract.
  if (conversationId && await _conversationControls().isMutedFor(conversationId, receiverId)) {
    logger.info(`pushService: conversation ${conversationId} muted for ${receiverId}, skipping push`);
    return { skipped: true, muted: true };
  }

  const preview = text && text.length > 100 ? `${text.slice(0, 100)}...` : (text || '');

  return sendToUser(receiverId, {
    title: senderName ? `New message from ${senderName}` : 'New message',
    body: preview,
    data: {
      type: 'chat_message',
      conversationId: conversationId ? String(conversationId) : '',
    },
  });
}

module.exports = { isConfigured, sendToUser, sendChatMessage };
