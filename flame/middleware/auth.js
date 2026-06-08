const { verifyAccess } = require('../utils/jwt');
const { AuthError } = require('../utils/errors');
const User = require('../models/User');

// Lightweight middleware: verifies the access token, attaches { id } to req.user.
// Controllers fetch the full User only when they need the document (lazy load).
module.exports = async function auth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new AuthError('MISSING_TOKEN', 'Bearer token required');
    }
    const token = header.slice(7);
    const payload = verifyAccess(token);
    req.user = { id: payload.userId };
    next();
  } catch (err) {
    next(err);
  }
};

// Variant that also loads the User document — for routes that need it on every call.
module.exports.withUser = async function authWithUser(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new AuthError('MISSING_TOKEN', 'Bearer token required');
    }
    const token = header.slice(7);
    const payload = verifyAccess(token);
    const user = await User.findById(payload.userId);
    if (!user || user.isDeleted) {
      throw new AuthError('USER_NOT_FOUND', 'User no longer exists');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
