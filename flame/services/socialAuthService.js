const User = require('../models/User');
const authService = require('./authService');

const ID_FIELD = { google: 'googleId', apple: 'appleId', facebook: 'facebookId' };

async function findOrCreate(provider, payload) {
  const idField = ID_FIELD[provider];
  if (!idField) throw new Error(`unknown provider ${provider}`);
  const { providerId, email, name, emailVerified, photo } = payload;

  // An UNVERIFIED provider email is treated as NO usable email: we never link
  // by it (auto-link takeover) and never store it (registration-DoS — the real
  // owner could no longer register that address). Only a verified email counts.
  const verifiedEmail = (email && emailVerified) ? email.toLowerCase().trim() : null;

  // 1. Existing account with this provider id → login.
  let user = await User.findOne({ [idField]: providerId, isDeleted: { $ne: true } });
  let isNew = false;

  // 2. Else link to an existing account by VERIFIED email.
  if (!user && verifiedEmail) {
    user = await User.findOne({ email: verifiedEmail, isDeleted: { $ne: true } });
    if (user) { user[idField] = providerId; }
  }

  // 3. Else create a new (incomplete) social user.
  if (!user) {
    // Account email is EITHER a verified provider email with no existing owner,
    // OR a synthetic address. Belt-and-suspenders: if the verified email somehow
    // already exists (race), fall back to synthetic to satisfy the unique index.
    let acctEmail = verifiedEmail;
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
  try {
    await user.save();
  } catch (e) {
    // Concurrent first-login race: two requests both reached step 3 and one lost
    // the unique-index insert. Re-find by provider id and continue as a login.
    if (e.code === 11000 && isNew) {
      const existing = await User.findOne({ [idField]: providerId, isDeleted: { $ne: true } });
      if (existing) {
        user = existing;
        isNew = false;
        user.lastActive = new Date();
        user.isOnline = true;
        await user.save();
      } else {
        throw e;
      }
    } else {
      throw e;
    }
  }

  const tokens = await authService.mintTokenPair(user);
  return { user: authService.toPublic(user), tokens, isNew };
}

module.exports = { findOrCreate };
