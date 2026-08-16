const matchService = require('../services/matchService');

async function listMatches(req, res) {
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = parseInt(req.query.offset, 10) || 0;
  const { matches, total } = await matchService.list(req.user.id, { limit, offset });

  res.json({
    success: true,
    data: {
      matches,
      pagination: { total, limit, offset, has_more: offset + matches.length < total },
    },
  });
}

async function deleteMatch(req, res) {
  await matchService.unmatch(req.user.id, req.params.id);
  res.json({ success: true, data: { unmatched: true } });
}

module.exports = { listMatches, deleteMatch };
