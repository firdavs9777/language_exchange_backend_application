/**
 * Pure SM-2 spaced-repetition engine — no I/O, no Mongoose.
 *
 * models/Vocabulary.js#processReview wraps this with persistence (this.save()).
 * Extracted so the review math + the justMastered mastery transition can be
 * unit-tested without a live DB connection (established lib/ pattern —
 * see lib/reelsFeed.js, lib/normalizeLanguage.js).
 *
 * Bug fixed here (H1 — workstream-h-aistudy): the original inline
 * implementation in Vocabulary.js set `this.masteredAt = new Date()` at the
 * moment of mastery, THEN computed `justMastered` as
 * `this.srsLevel >= 9 && this.isMastered && !this.masteredAt` — `masteredAt`
 * was always truthy by that point, so `justMastered` was always false. Fixed
 * by capturing `wasAlreadyMastered` BEFORE any mutation.
 */

/**
 * @param {Object} current
 * @param {number} current.srsLevel
 * @param {number} current.interval
 * @param {number} current.easeFactor
 * @param {boolean} current.isMastered
 * @param {Date|null} [current.masteredAt]
 * @param {Object} [current.reviewStats] - { totalReviews, correctReviews, incorrectReviews, currentStreak, longestStreak, lastReviewedAt, firstReviewedAt }
 * @param {number} quality - SM-2 quality rating, 0-5
 * @returns {Object} New state + derived flags. Does not mutate `current`.
 */
function applyReview(current = {}, quality) {
  const wasCorrect = quality >= 3;
  const wasAlreadyMastered = !!current.isMastered;

  const prevStats = current.reviewStats || {};
  const reviewStats = {
    totalReviews: (prevStats.totalReviews || 0) + 1,
    correctReviews: prevStats.correctReviews || 0,
    incorrectReviews: prevStats.incorrectReviews || 0,
    currentStreak: prevStats.currentStreak || 0,
    longestStreak: prevStats.longestStreak || 0,
    lastReviewedAt: new Date(),
    firstReviewedAt: prevStats.firstReviewedAt || new Date(),
  };

  if (wasCorrect) {
    reviewStats.correctReviews += 1;
    reviewStats.currentStreak += 1;
    if (reviewStats.currentStreak > reviewStats.longestStreak) {
      reviewStats.longestStreak = reviewStats.currentStreak;
    }
  } else {
    reviewStats.incorrectReviews += 1;
    reviewStats.currentStreak = 0;
  }

  let srsLevel = current.srsLevel || 0;
  let interval = current.interval || 0;
  let easeFactor = current.easeFactor || 2.5;
  let nextReview;

  if (quality < 3) {
    // Failed review — reset to beginning (SM-2: lapse).
    srsLevel = 0;
    interval = 0;
    nextReview = new Date();
  } else {
    if (srsLevel === 0) {
      interval = 1;
    } else if (srsLevel === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    srsLevel = Math.min(srsLevel + 1, 9);
    nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
  }

  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), floor 1.3
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  const isMastered = srsLevel >= 9 ? true : wasAlreadyMastered;
  const justMastered = isMastered && !wasAlreadyMastered;
  const masteredAt = justMastered ? new Date() : (current.masteredAt || undefined);

  return {
    wasCorrect,
    reviewStats,
    srsLevel,
    interval,
    easeFactor,
    nextReview,
    isMastered,
    justMastered,
    masteredAt,
  };
}

module.exports = { applyReview };
