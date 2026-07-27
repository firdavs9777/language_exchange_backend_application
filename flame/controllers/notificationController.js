const deviceService = require('../services/deviceService');

async function registerToken(req, res) {
  const data = await deviceService.registerToken(req.user.id, {
    token: req.body.token,
    platform: req.body.platform,
    deviceId: req.body.deviceId,
  });
  res.status(201).json({ success: true, data });
}

async function removeToken(req, res) {
  const data = await deviceService.removeToken(req.user.id, req.params.deviceId);
  res.json({ success: true, data });
}

async function getSettings(req, res) {
  const data = await deviceService.getSettings(req.user.id);
  res.json({ success: true, data });
}

async function updateSettings(req, res) {
  const data = await deviceService.updateSettings(req.user.id, req.body);
  res.json({ success: true, data });
}

module.exports = { registerToken, removeToken, getSettings, updateSettings };
