const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const password = require('../utils/password');
const jwtUtil = require('../utils/jwt');
const { ConflictError, AuthError, NotFoundError } = require('../utils/errors');

function toPublic(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    age: user.age,
    gender: user.gender,
    lookingFor: user.lookingFor,
    bio: user.bio,
    interests: user.interests,
    photos: user.photos,
    location: user.location,
    isOnline: user.isOnline,
    isVerified: user.isVerified,
    lastActive: user.lastActive,
    createdAt: user.createdAt,
    preferences: user.preferences,
  };
}

function refreshTtlMs() {
  const ttl = process.env.FLAME_JWT_REFRESH_TTL || '30d';
  // crude parser: supports "Nm", "Nh", "Nd"
  const m = /^(\d+)([mhd])$/.exec(ttl);
  if (!m) return 30 * 86400 * 1000;
  const n = parseInt(m[1], 10);
  return { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]] * n;
}

async function mintTokenPair(user) {
  const access  = jwtUtil.signAccess({ userId: user._id.toString() });
  const refresh = jwtUtil.signRefresh({ userId: user._id.toString() });
  await RefreshToken.create({
    userId:    user._id.toString(),
    tokenJti:  refresh.jti,
    expiresAt: new Date(Date.now() + refreshTtlMs()),
  });
  return {
    accessToken:  access.token,
    refreshToken: refresh.token,
    expiresIn:    access.expiresIn,
  };
}

async function register(input) {
  const passwordHash = await password.hash(input.password);
  let user;
  try {
    user = await User.create({
      email: input.email.toLowerCase().trim(),
      passwordHash,
      name: input.name,
      age: input.age,
      gender: input.gender,
      lookingFor: input.lookingFor,
      interests: input.interests,
      bio: input.bio,
    });
  } catch (e) {
    if (e.code === 11000) throw new ConflictError('EMAIL_TAKEN', 'Email is already registered');
    throw e;
  }
  const tokens = await mintTokenPair(user);
  return { user: toPublic(user), tokens };
}

async function login({ email, password: plain }) {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || user.isDeleted) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }
  const ok = await password.compare(plain, user.passwordHash);
  if (!ok) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }
  user.lastActive = new Date();
  user.isOnline = true;
  await user.save();
  const tokens = await mintTokenPair(user);
  return { user: toPublic(user), tokens };
}

async function refreshTokens(refreshToken) {
  const payload = jwtUtil.verifyRefresh(refreshToken);
  const stored = await RefreshToken.findOne({ tokenJti: payload.jti });
  if (!stored || stored.isRevoked) {
    throw new AuthError('REFRESH_REVOKED', 'Refresh token revoked');
  }
  const user = await User.findById(payload.userId);
  if (!user || user.isDeleted) {
    throw new NotFoundError('User no longer exists');
  }
  // Rotate: revoke the old jti, mint a fresh pair
  stored.isRevoked = true;
  await stored.save();
  const tokens = await mintTokenPair(user);
  return tokens;
}

async function logout(userId) {
  await RefreshToken.updateMany(
    { userId, isRevoked: false },
    { $set: { isRevoked: true } },
  );
  await User.updateOne({ _id: userId }, { $set: { isOnline: false } });
}

module.exports = { register, login, refreshTokens, logout, toPublic, mintTokenPair };
