const blockService = require('../services/blockService');

async function createBlock(req, res) {
  await blockService.block(req.user.id, req.body.user_id);
  res.status(201).json({ success: true, data: { blocked: true } });
}

async function removeBlock(req, res) {
  await blockService.unblock(req.user.id, req.params.userId);
  res.json({ success: true, data: { unblocked: true } });
}

async function listBlocks(req, res) {
  const blocked = await blockService.listBlocked(req.user.id);
  res.json({ success: true, data: { blocked_users: blocked } });
}

module.exports = { createBlock, removeBlock, listBlocks };
