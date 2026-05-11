const { WebhookReceiver } = require('livekit-server-sdk');

const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

/**
 * Verifies the LiveKit webhook signature and attaches the parsed
 * event to req.livekitEvent.
 *
 * LiveKit sends webhooks as application/webhook+json with an
 * Authorization header containing a JWT signed with the API secret.
 */
exports.verifyLivekitWebhook = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'missing Authorization header' });
    }
    // req.body should be a Buffer (raw bytes) at this point — ensure
    // routes/livekit.js mounts express.raw({ type: 'application/webhook+json' })
    // before this middleware
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : req.body;
    const event = await receiver.receive(rawBody, authHeader);
    req.livekitEvent = event;
    next();
  } catch (e) {
    console.error('[livekit-webhook] verify failed:', e.message);
    return res.status(401).json({ error: 'invalid webhook signature' });
  }
};
