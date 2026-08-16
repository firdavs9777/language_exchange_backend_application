const { AuthError } = require('./errors');

function isConfigured(provider) {
  if (provider === 'google') return !!process.env.FLAME_GOOGLE_CLIENT_ID;
  if (provider === 'apple') return !!process.env.FLAME_APPLE_CLIENT_ID;
  if (provider === 'facebook')
    return !!(process.env.FLAME_FACEBOOK_APP_ID && process.env.FLAME_FACEBOOK_APP_SECRET);
  return false;
}

/**
 * Every Google OAuth client ID this app owns, as a list.
 *
 * FLAME_GOOGLE_CLIENT_ID accepts a comma-separated list because Google
 * audiences an ID token to whichever client performed the sign-in — the iOS
 * client on iOS, the Android client on Android, the web client on web. The
 * Flutter `serverClientId` option does not retarget that on iOS (confirmed on
 * device: aud was the iOS client and serverAuthCode was null), so verifying
 * against a single ID guarantees at least one platform gets rejected with
 * INVALID_SOCIAL_TOKEN.
 *
 * Listing several audiences is not a weakening: google-auth-library still
 * requires aud to match one of them exactly, and every entry is a client we
 * control.
 */
function googleAudiences() {
  return String(process.env.FLAME_GOOGLE_CLIENT_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function verifyGoogle(idToken) {
  try {
    const { OAuth2Client } = require('google-auth-library');
    const audiences = googleAudiences();
    const client = new OAuth2Client(audiences[0]);
    const ticket = await client.verifyIdToken({
      idToken, audience: audiences,
    });
    const p = ticket.getPayload();
    if (!p || !p.sub) throw new Error('no payload');
    return {
      providerId: p.sub, email: p.email || null, name: p.name || null,
      emailVerified: p.email_verified === true, photo: p.picture || null,
    };
  } catch (_e) {
    throw new AuthError('INVALID_SOCIAL_TOKEN', 'Invalid Google token');
  }
}

async function verifyApple(idToken) {
  try {
    const appleSignin = require('apple-signin-auth');
    const p = await appleSignin.verifyIdToken(idToken, {
      audience: process.env.FLAME_APPLE_CLIENT_ID,
      ignoreExpiration: false,
    });
    if (!p || !p.sub) throw new Error('no payload');
    return {
      providerId: p.sub, email: p.email || null, name: null,
      emailVerified: p.email_verified === 'true' || p.email_verified === true,
    };
  } catch (_e) {
    throw new AuthError('INVALID_SOCIAL_TOKEN', 'Invalid Apple token');
  }
}

async function verifyFacebook(accessToken) {
  try {
    const axios = require('axios');
    const appToken = `${process.env.FLAME_FACEBOOK_APP_ID}|${process.env.FLAME_FACEBOOK_APP_SECRET}`;
    const debug = await axios.get('https://graph.facebook.com/debug_token', {
      params: { input_token: accessToken, access_token: appToken },
    });
    const d = debug.data && debug.data.data;
    if (!d || d.is_valid !== true || d.app_id !== process.env.FLAME_FACEBOOK_APP_ID) {
      throw new Error('invalid token');
    }
    const me = await axios.get('https://graph.facebook.com/me', {
      params: { fields: 'id,name,email', access_token: accessToken },
    });
    const m = me.data;
    if (!m || !m.id) throw new Error('no profile');
    return {
      providerId: m.id, email: m.email || null, name: m.name || null,
      emailVerified: !!m.email, // FB only returns verified emails
    };
  } catch (_e) {
    throw new AuthError('INVALID_SOCIAL_TOKEN', 'Invalid Facebook token');
  }
}

module.exports = { isConfigured, googleAudiences, verifyGoogle, verifyApple, verifyFacebook };
