const User = require('../models/User');
const authService = require('./authService');

const ID_FIELD = { google: 'googleId', apple: 'appleId', facebook: 'facebookId' };

async function findOrCreate(provider, payload) {
  const idField = ID_FIELD[provider];
  if (!idField) throw new Error(`unknown provider ${provider}`);
  const { providerId, email, name, emailVerified, photo } = payload;

  // 1. Existing account with this provider id → login.
  let user = await User.findOne({ [idField]: providerId, isDeleted: { $ne: true } });
  let isNew = false;

  // 2. Else link to an existing account by VERIFIED email.
  if (!user && email && emailVerified) {
    user = await User.findOne({ email: email.toLowerCase().trim(), isDeleted: { $ne: true } });
    if (user) { user[idField] = providerId; }
  }

  // 3. Else create a new (incomplete) social user.
  if (!user) {
    // Prefer the provider email, but fall back to a synthetic address when it
    // is absent (e.g. Apple relay declined) OR when it would collide with an
    // existing account (e.g. an UNVERIFIED email matching a password user —
    // we must not link to it, and we cannot reuse it under the unique index).
    let acctEmail = email ? email.toLowerCase().trim() : null;
    if (acctEmail && (await User.exists({ email: acctEmail, isDeleted: { $ne: true } }))) {
      acctEmail = null;
    }
    user = new User({
      email: acctEmail || `${provider}_${providerId}@social.flame`,
      name: name || 'New User',
      [idField]: providerId,
      profileComplete: false,
      // dating fields (age/gender/lookingFor/interests) collected by the
      // frontend social-profile-completion flow after first login.
      age: 18, gender: 'other', lookingFor: 'other', interests: [],
      photos: photo ? [{ id: `${provider}_0`, url: photo, isPrimary: true, order: 0 }] : [],
    });
    isNew = true;
  }

  user.lastActive = new Date();
  user.isOnline = true;
  await user.save();

  const tokens = await authService.mintTokenPair(user);
  return { user: authService.toPublic(user), tokens, isNew };
}

module.exports = { findOrCreate };
