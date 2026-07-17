/**
 * SRS review request-contract resolver — pure, no I/O.
 *
 * H1 (workstream-h-aistudy): controllers/learning.js#submitVocabularyReview
 * previously 400'd whenever the request body didn't include `quality`
 * (0-5). Every shipped app version sends `{ correct: bool }` instead, so
 * the endpoint 400'd on every real call — the SRS loop never ran in
 * production (0 reviews ever processed, confirmed prod audit).
 *
 * Backend-first compat fix: accept `quality` when present (validated
 * 0-5); else map `correct: true → 4` (SM-2 "correct with some
 * hesitation"), `correct: false → 1` (SM-2 "incorrect, remembered on
 * seeing answer" — quality < 3 triggers a lapse). 400 only when NEITHER
 * field is present. This mapping is permanent — old app versions keep
 * sending `correct` forever and must keep working.
 */

/**
 * @param {Object} body
 * @param {number} [body.quality] - 0-5 SM-2 quality rating
 * @param {boolean} [body.correct] - legacy boolean contract
 * @returns {{ quality: number } | { error: string }}
 */
function resolveReviewQuality({ quality, correct } = {}) {
  if (quality !== undefined && quality !== null) {
    const q = Number(quality);
    if (Number.isNaN(q) || q < 0 || q > 5) {
      return { error: 'Quality must be between 0 and 5' };
    }
    return { quality: q };
  }

  if (correct !== undefined && correct !== null) {
    return { quality: correct ? 4 : 1 };
  }

  return { error: 'quality (0-5) or correct (boolean) is required' };
}

module.exports = { resolveReviewQuality };
