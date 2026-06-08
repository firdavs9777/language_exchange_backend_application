const userService = require('../services/userService');

async function getMe(req, res) {
  const me = await userService.getMe(req.user.id);
  res.json({ success: true, data: me });
}

async function getById(req, res) {
  const u = await userService.getById(req.params.id);
  res.json({ success: true, data: u });
}

async function updateMe(req, res) {
  const me = await userService.updateMe(req.user.id, req.body);
  res.json({ success: true, data: me });
}

async function uploadPhoto(req, res) {
  const photo = await userService.uploadPhoto(req.user.id, req.file);
  res.status(201).json({ success: true, data: photo });
}

async function deletePhoto(req, res) {
  await userService.deletePhoto(req.user.id, req.params.photoId);
  res.json({ success: true });
}

module.exports = { getMe, getById, updateMe, uploadPhoto, deletePhoto };
