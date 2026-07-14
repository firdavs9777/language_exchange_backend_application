/**
 * Email unsubscribe compliance (CAN-SPAM / GDPR)
 *
 * Public, token-verified endpoint that flips the matching per-user
 * privacySettings boolean. The token IS the auth — no login required,
 * because unsubscribe links must keep working from old emails.
 *
 * Token format: `${base64url(userId:emailType)}.${hex(hmacSha256(payload))}`
 * No expiry claim by design (plan requirement — old emails must still work).
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/async');
const User = require('../models/User');

const SUPPORTED_EMAIL_TYPES = {
  promotional: 'privacySettings.emailNotifications',
  digest: 'privacySettings.weeklyDigest',
};

const getSecret = () => process.env.JWT_SECRET;

const sign = (payload) =>
  crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');

/**
 * Build a signed, non-expiring unsubscribe token for a user + email type.
 */
const makeUnsubscribeToken = (userId, emailType) => {
  const payload = `${userId}:${emailType}`;
  const payloadEncoded = Buffer.from(payload, 'utf8').toString('base64url');
  const signature = sign(payload);
  return `${payloadEncoded}.${signature}`;
};

/**
 * Verify a token produced by makeUnsubscribeToken.
 * Returns `{ userId, emailType }` on success, `null` on any failure
 * (malformed token, bad signature, tampered payload) — never throws.
 */
const verifyUnsubscribeToken = (token) => {
  try {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadEncoded, signature] = parts;
    if (!payloadEncoded || !signature) return null;

    const payload = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
    const expectedSignature = sign(payload);

    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const separatorIndex = payload.indexOf(':');
    if (separatorIndex === -1) return null;

    const userId = payload.slice(0, separatorIndex);
    const emailType = payload.slice(separatorIndex + 1);
    if (!userId || !emailType) return null;
    // Defense-in-depth: a valid signature implies we minted the id, but a
    // malformed ObjectId would still CastError (→ 500) at the updateOne.
    if (!mongoose.isValidObjectId(userId)) return null;

    return { userId, emailType };
  } catch (err) {
    return null;
  }
};

/**
 * Map a token's emailType to the privacySettings dot-path that should be
 * set to false. Returns null for unrecognized types (caller should 400).
 */
const emailTypeToPrivacyField = (emailType) => SUPPORTED_EMAIL_TYPES[emailType] || null;

const confirmationHtml = (message) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bananatalk</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f6f6;font-family:'Segoe UI', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f6f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding:40px 30px;text-align:center;">
              <h1 style="margin:0 0 15px 0;font-size:24px;color:#333333;">${message}</h1>
              <p style="margin:0;font-size:14px;color:#888888;">You can re-enable these emails anytime from your Bananatalk app settings.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/**
 * @desc    Unsubscribe from a category of marketing/digest email via a
 *          signed link (no auth — the token is the auth).
 * @route   GET /api/v1/email/unsubscribe?token=...
 * @access  Public
 */
const unsubscribe = asyncHandler(async (req, res) => {
  const { token } = req.query;

  const decoded = verifyUnsubscribeToken(token);
  if (!decoded) {
    return res.status(400).send(confirmationHtml("This unsubscribe link is invalid."));
  }

  const field = emailTypeToPrivacyField(decoded.emailType);
  if (!field) {
    return res.status(400).send(confirmationHtml("This unsubscribe link is invalid."));
  }

  await User.updateOne({ _id: decoded.userId }, { $set: { [field]: false } });

  return res.status(200).send(confirmationHtml("You're unsubscribed."));
});

module.exports = {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  emailTypeToPrivacyField,
  unsubscribe,
};
