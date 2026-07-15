/**
 * Pure decision/query logic for Workstream G Reels.
 *
 * Extracted from controllers/moments.js (feed shaping) and
 * controllers/report.js (auto-hide threshold) so the tricky bits — the
 * two-bucket language partition, the cursor derivation that avoids the
 * dup/skip regression, the 180s over-cap decision, and the report
 * auto-hide threshold — are unit testable without a database. Every
 * function here is side-effect free; callers translate the returned
 * decision into the actual Mongo reads/writes.
 */

/**
 * Stamp `isReel: { $ne: true }` onto a flat Mongo query object so reels are
 * excluded from a discovery feed. Returns a new object (does not mutate the
 * input) so callers can keep building on top of it (e.g. adding a blocked-
 * user filter afterwards).
 *
 * Applied to the FIVE discovery feeds: getMoments' default/forYou/following
 * branches, exploreMoments, and getTrendingMoments. Deliberately NOT applied
 * to getUserMoments (profile grid) or getSavedMoments — your own profile and
 * your saved list correctly keep showing your reels.
 *
 * @param {Object} query
 * @returns {Object}
 */
function excludeReels(query = {}) {
  return { ...query, isReel: { $ne: true } };
}

/**
 * Build the Mongo filter for GET /moments/reels.
 *
 * @param {Object} opts
 * @param {String|Date|null} [opts.before] - cursor: only reels with
 *   createdAt strictly before this value (keyset pagination).
 * @param {Array<String>} [opts.blockedIds] - poster ids to exclude.
 * @returns {Object}
 */
function buildReelsQuery({ before, blockedIds } = {}) {
  const query = {
    isReel: true,
    privacy: 'public',
    hiddenPendingReview: { $ne: true },
    isDeleted: { $ne: true },
  };

  if (before) {
    const cursorDate = before instanceof Date ? before : new Date(before);
    if (!Number.isNaN(cursorDate.getTime())) {
      query.createdAt = { $lt: cursorDate };
    }
  }

  if (Array.isArray(blockedIds) && blockedIds.length > 0) {
    query.user = { $nin: blockedIds };
  }

  return query;
}

/**
 * Two-bucket soft language ranking (spec §2, plan-review I2): bucket A =
 * reels whose `language` is in `relevantLanguages` (viewer's target +
 * native ISO codes), bucket B = everything else. Both buckets keep their
 * relative (recency-desc) order from the input — a stable partition, NOT a
 * re-sort — so this only works correctly when `reels` is already sorted by
 * createdAt desc (the raw fetched window).
 *
 * A soft boost, never a hard filter: an empty `relevantLanguages` (or a
 * viewer whose target/native don't resolve to an ISO code) puts everything
 * in bucket B, i.e. plain recency order.
 *
 * @param {Array<Object>} reels - each with a `language` field, already
 *   sorted createdAt desc.
 * @param {Array<String>} relevantLanguages - ISO codes to boost.
 * @returns {Array<Object>} concatenated bucket A then bucket B.
 */
function partitionByLanguage(reels, relevantLanguages) {
  const relevantSet = new Set((relevantLanguages || []).filter(Boolean));
  const bucketA = [];
  const bucketB = [];

  for (const reel of (reels || [])) {
    if (relevantSet.size > 0 && relevantSet.has(reel && reel.language)) {
      bucketA.push(reel);
    } else {
      bucketB.push(reel);
    }
  }

  return [...bucketA, ...bucketB];
}

/**
 * Derive `nextCursor` from the RAW fetched window — BEFORE
 * partitionByLanguage reorders it (plan-review I2, load-bearing).
 *
 * Why: the concatenated (A-then-B) array's tail is NOT necessarily the
 * window's oldest item — bucket B's oldest item can be newer than an
 * already-returned bucket-A item further back in the raw window. Deriving
 * the cursor from the reordered tail would set `createdAt: {$lt: <too new
 * a value>}` on the next page, causing an already-returned bucket-A reel to
 * be refetched (a duplicate) on page 2.
 *
 * Returns null when the raw window is empty, or (when `limit` is given)
 * when the window came back short of `limit` — there is no next page.
 *
 * @param {Array<Object>} rawWindow - the pre-partition, createdAt-desc
 *   fetched page (each item has `createdAt`).
 * @param {Number} [limit] - the page size requested; if the raw window has
 *   fewer items than this, there's nothing more to page through.
 * @returns {String|null} ISO-8601 timestamp, or null.
 */
function deriveNextCursor(rawWindow, limit) {
  if (!Array.isArray(rawWindow) || rawWindow.length === 0) return null;
  if (typeof limit === 'number' && rawWindow.length < limit) return null;

  let minTime = Infinity;
  for (const item of rawWindow) {
    const t = new Date(item.createdAt).getTime();
    if (!Number.isNaN(t) && t < minTime) minTime = t;
  }

  if (!Number.isFinite(minTime)) return null;
  return new Date(minTime).toISOString();
}

/**
 * REELS_ENABLED kill switch — centralized in config/limitations.js.
 * Re-requires that module fresh on every call (rather than destructuring it
 * once at the top of this file) so tests can toggle process.env.REELS_ENABLED
 * and observe the change by clearing require.cache for
 * config/limitations.js — the same pattern lib/roomMembership.js uses for
 * ROOMS_ENABLED.
 *
 * @returns {boolean}
 */
function getReelsEnabled() {
  return require('../config/limitations').REELS_ENABLED;
}

/**
 * Express middleware: short-circuits GET /api/v1/moments/reels to a 404
 * when REELS_ENABLED is false. Extracted as a plain (req, res, next)
 * function so it's unit testable with mock req/res objects without loading
 * Express or the auth/jsonwebtoken chain that routes/moments.js pulls in
 * transitively.
 *
 * @param {Object} req
 * @param {Object} res - must have `.status(code).json(body)`
 * @param {Function} next
 */
function reelsEnabledGuard(req, res, next) {
  if (!getReelsEnabled()) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  next();
}

/**
 * Decide the `isReel` value to persist on a new Moment from the raw
 * request body value. Strict boolean check — never trust a truthy string
 * (e.g. 'false', '0') from the client; only the literal boolean `true`
 * marks a moment as a reel.
 *
 * @param {*} rawValue - req.body.isReel
 * @returns {boolean}
 */
function resolveIsReel(rawValue) {
  return rawValue === true;
}

/**
 * 180s reel duration cap (spec I5): decide whether an uploaded video pushes
 * a reel over the cap. Pure so the controller (which owns the actual
 * delete-from-Spaces + 400 side effects, in momentVideoUpload) can be
 * tested without touching Spaces or Mongo. The upload middleware's global
 * 600s cap is a separate, outer bound and is untouched by this decision.
 *
 * @param {Object} moment - must have `isReel`.
 * @param {Number} duration - seconds, from req.videoMetadata.duration.
 * @returns {boolean}
 */
function isReelOverCap(moment, duration) {
  return Boolean(moment && moment.isReel) &&
    typeof duration === 'number' &&
    !Number.isNaN(duration) &&
    duration > 180;
}

/**
 * Report auto-hide threshold (spec C1): a reel is auto-hidden pending
 * review once it has accumulated 2 or more distinct reports. Dedup across
 * repeat reports from the same reporter is free via the Report model's
 * unique `{reportedBy, type, reportId}` index (models/Report.js:147) —
 * this function only decides the count-based threshold.
 *
 * @param {Number} reportCount
 * @returns {boolean}
 */
function shouldAutoHide(reportCount) {
  return typeof reportCount === 'number' && reportCount >= 2;
}

module.exports = {
  excludeReels,
  buildReelsQuery,
  partitionByLanguage,
  deriveNextCursor,
  getReelsEnabled,
  reelsEnabledGuard,
  resolveIsReel,
  isReelOverCap,
  shouldAutoHide,
};
