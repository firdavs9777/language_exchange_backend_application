const authService = require('../services/authService');

async function register(req, res) {
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, data: result });
}

async function login(req, res) {
  const result = await authService.login(req.body);
  res.json({ success: true, data: result });
}

async function refresh(req, res) {
  // Either casing — see the note on refreshSchema in routes/auth.js.
  const supplied = req.body.refreshToken || req.body.refresh_token;
  const tokens = await authService.refreshTokens(supplied);

  res.json({
    success: true,
    data: {
      ...tokens,
      // Installed clients read access_token/refresh_token and cast the result
      // as String, so a missing key throws inside their own try/catch and
      // degrades silently into a logout. Answering in both casings fixes them
      // without an app release; new clients read the camelCase pair.
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
    },
  });
}

async function logout(req, res) {
  await authService.logout(req.user.id);
  res.json({ success: true, message: 'Logged out' });
}

module.exports = { register, login, refresh, logout };
