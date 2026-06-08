const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { AuthError } = require('./errors');

const ACCESS_SECRET  = process.env.FLAME_JWT_SECRET;
const REFRESH_SECRET = process.env.FLAME_JWT_REFRESH_SECRET;
const ACCESS_TTL     = process.env.FLAME_JWT_ACCESS_TTL  || '15m';
const REFRESH_TTL    = process.env.FLAME_JWT_REFRESH_TTL || '30d';
const ISS            = 'flame';

function signAccess(payload) {
  const token = jwt.sign(
    { ...payload, type: 'access' },
    ACCESS_SECRET,
    { issuer: ISS, expiresIn: ACCESS_TTL },
  );
  return { token, expiresIn: ACCESS_TTL };
}

function signRefresh(payload) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { ...payload, type: 'refresh', jti },
    REFRESH_SECRET,
    { issuer: ISS, expiresIn: REFRESH_TTL },
  );
  return { token, jti, expiresIn: REFRESH_TTL };
}

function verifyAccess(token) {
  try {
    const p = jwt.verify(token, ACCESS_SECRET, { issuer: ISS });
    if (p.type !== 'access') throw new AuthError('INVALID_TOKEN', 'Wrong token type');
    return p;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    if (e.name === 'TokenExpiredError') throw new AuthError('TOKEN_EXPIRED', 'Access token expired');
    throw new AuthError('INVALID_TOKEN', 'Invalid access token');
  }
}

function verifyRefresh(token) {
  try {
    const p = jwt.verify(token, REFRESH_SECRET, { issuer: ISS });
    if (p.type !== 'refresh') throw new AuthError('INVALID_TOKEN', 'Wrong token type');
    return p;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    if (e.name === 'TokenExpiredError') throw new AuthError('TOKEN_EXPIRED', 'Refresh token expired');
    throw new AuthError('INVALID_TOKEN', 'Invalid refresh token');
  }
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
