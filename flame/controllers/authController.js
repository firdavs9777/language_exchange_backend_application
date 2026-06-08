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
  const tokens = await authService.refreshTokens(req.body.refreshToken);
  res.json({ success: true, data: tokens });
}

async function logout(req, res) {
  await authService.logout(req.user.id);
  res.json({ success: true, message: 'Logged out' });
}

module.exports = { register, login, refresh, logout };
