const matchService = require('../services/matchService');

// Same clamping contract as GET /discover (flame/routes/discovery.js): a
// missing or unparseable value falls back to the default, and the value is
// bounded rather than passed straight to the driver.
//
// Unbounded, `?limit=100000` loads that many matches plus a $in of that many
// user ids, and a negative `?offset` throws out of the driver as a 500.
const MAX_LIMIT = 50;

function clampLimit(raw, fallback) {
  const n = parseInt(raw, 10) || fallback;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
}

function clampOffset(raw) {
  const n = parseInt(raw, 10) || 0;
  return Math.max(n, 0);
}

async function listMatches(req, res) {
  const limit = clampLimit(req.query.limit, 20);
  const offset = clampOffset(req.query.offset);
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
