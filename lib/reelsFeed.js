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

module.exports = {
  excludeReels,
};
