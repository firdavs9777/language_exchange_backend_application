const { AuthError } = require('./errors');

function isConfigured(provider) {
  if (provider === 'google') return !!process.env.FLAME_GOOGLE_CLIENT_ID;
  if (provider === 'apple') return !!process.env.FLAME_APPLE_CLIENT_ID;
  if (provider === 'facebook')
    return !!(process.env.FLAME_FACEBOOK_APP_ID && process.env.FLAME_FACEBOOK_APP_SECRET);
  return false;
}

async function verifyGoogle(idToken) {
  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.FLAME_GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken, audience: process.env.FLAME_GOOGLE_CLIENT_ID,
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

module.exports = { isConfigured, verifyGoogle, verifyApple, verifyFacebook };
