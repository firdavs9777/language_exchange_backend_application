/**
 * Coins v2 — pure decision helpers for the daily-reward and ad-reward earn
 * loop (Task 17a). Extracted from controllers/coins.js so the once-per-day
 * key construction and the ad daily-cap check are unit-testable without a
 * database, mirroring lib/activeStoryFlags.js / lib/dailyRoomPrompt.js.
 *
 * Both rewards ride the SAME idempotent coinLedger.credit() path already
 * used by verify-purchase: the dedupe key goes in metadata.iapTransactionId
 * (the field CoinTransaction's unique sparse index actually enforces), so a
 * double-tap / client retry / concurrent request can never double-credit —
 * no extra locking needed in the controller. See models/CoinTransaction.js
 * for why this field is reused for a non-IAP reward.
 */

/** UTC calendar day as 'YYYY-MM-DD', so reward resets are timezone-stable. */
function formatUtcDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * [start, end) UTC day boundaries for a Mongo range query on createdAt
 * (used to count today's ad_reward rows for the cap check).
 */
function utcDayRange(date = new Date()) {
  const day = formatUtcDate(date);
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Idempotency key for the daily reward — one per user per UTC day. Reused
 * both to credit (metadata.iapTransactionId) and to check claimedToday
 * (findOne on that same value), so "did I credit it" and "is it claimed"
 * can never disagree.
 *
 * @param {String|import('mongoose').Types.ObjectId} userId
 * @param {Date} [date]
 * @returns {String}
 */
function buildDailyRewardKey(userId, date = new Date()) {
  return `daily-${userId}-${formatUtcDate(date)}`;
}

/**
 * Idempotency key for the Nth ad-reward watch of the day (1-indexed). `n`
 * must be derived from a fresh count of today's ad_reward rows — see
 * nextAdRewardIndex — so a legitimate 2nd watch gets a distinct key from
 * the 1st.
 *
 * @param {String|import('mongoose').Types.ObjectId} userId
 * @param {Number} n - 1-indexed slot for today's watch.
 * @param {Date} [date]
 * @returns {String}
 */
function buildAdRewardKey(userId, n, date = new Date()) {
  return `ad-${userId}-${formatUtcDate(date)}-${n}`;
}

/**
 * True once countToday has reached (or somehow exceeded) the daily cap.
 * @param {Number} countToday
 * @param {Number} cap
 * @returns {Boolean}
 */
function isAdCapReached(countToday, cap) {
  return countToday >= cap;
}

/**
 * 1-indexed slot for the next ad-reward credit, given how many the user
 * already has today. Concurrent requests that read the same countToday
 * compute the SAME n and therefore the SAME idempotency key — the ledger's
 * unique-index dedupe then lets only one of them actually credit, so a race
 * can under-credit a duplicate request but can never push the total past
 * the cap.
 *
 * @param {Number} countToday
 * @returns {Number}
 */
function nextAdRewardIndex(countToday) {
  return countToday + 1;
}

module.exports = {
  formatUtcDate,
  utcDayRange,
  buildDailyRewardKey,
  buildAdRewardKey,
  isAdCapReached,
  nextAdRewardIndex,
};
