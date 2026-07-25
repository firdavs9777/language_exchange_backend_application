const storyService = require('../services/storyService');

async function getFeed(req, res) {
  const users = await storyService.getFeed(req.user.id);
  res.json({ success: true, data: { users } });
}

async function getMine(req, res) {
  const data = await storyService.getMyStories(req.user.id); // null when none
  res.json({ success: true, data });
}

async function create(req, res) {
  const story = await storyService.createStory(req.user.id, req.file, req.body.caption);
  res.status(201).json({ success: true, data: story });
}

async function view(req, res) {
  const data = await storyService.markViewed(req.user.id, req.params.id);
  res.json({ success: true, data });
}

async function remove(req, res) {
  await storyService.deleteStory(req.user.id, req.params.id);
  res.json({ success: true, data: { deleted: true } });
}

module.exports = { getFeed, getMine, create, view, remove };
