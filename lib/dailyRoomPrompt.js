/**
 * Pure decision logic for Workstream D's daily room-prompt job
 * (jobs/dailyRoomPromptJob.js — Task 6).
 *
 * Extracted so the day-of-year prompt rotation and same-day dedup guard are
 * unit-testable without a database or socket.io server. The job itself
 * (jobs/dailyRoomPromptJob.js) only translates these decisions into Mongo
 * reads/writes + a socket broadcast.
 */

/**
 * Day of year (1-366) for a given Date, in UTC, so rotation is stable
 * regardless of server timezone. Mirrors controllers/moments.js's
 * getPromptOfDay rotation exactly (same algorithm, kept local/pure here so
 * this module has no controller dependency).
 *
 * @param {Date} date
 * @returns {number}
 */
function getDayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Select the day's prompt for a hub's target language via the same
 * deterministic day-of-year rotation used by controllers/moments.js's
 * getPromptOfDay (same prompt all day, rotates by day of year). Returns
 * null if there are no active prompts for that language (caller should
 * skip + log — no cross-language fallback for hubs, unlike the moments
 * endpoint's 'en' fallback, since a hub's prompt must match its own
 * targetLanguage).
 *
 * @param {Array<Object>} prompts - active prompts already filtered to
 *   { language: hub.targetLanguage, active: true } and sorted by _id asc
 *   (stable ordering), e.g. via Prompt.find({ language, active: true }).sort({ _id: 1 }).lean()
 * @param {String} targetLanguage - hub.targetLanguage (canonical, e.g. 'en')
 * @param {Date} [date] - defaults to now
 * @returns {Object|null} the selected prompt, or null if `prompts` is empty
 */
function selectPromptForLanguage(prompts, targetLanguage, date = new Date()) {
  if (!Array.isArray(prompts) || prompts.length === 0) return null;
  const matching = prompts.filter((p) => p.language === targetLanguage);
  if (matching.length === 0) return null;

  const dayOfYear = getDayOfYear(date);
  return matching[dayOfYear % matching.length];
}

/**
 * Decide whether the job should post today, given the most recent system
 * prompt message already posted to this hub (if any). Dedup guard: only one
 * daily-prompt system message per hub per UTC calendar day.
 *
 * @param {Object|null} lastPromptMessage - most recent system prompt Message
 *   for this hub (e.g. `{ createdAt }`), or null if none exists yet.
 * @param {Date} [now] - defaults to now
 * @returns {boolean} true if the job should create+broadcast a new prompt message
 */
function shouldPostToday(lastPromptMessage, now = new Date()) {
  if (!lastPromptMessage || !lastPromptMessage.createdAt) return true;

  const last = new Date(lastPromptMessage.createdAt);
  return !isSameUtcDay(last, now);
}

/**
 * @param {Date} a
 * @param {Date} b
 * @returns {boolean}
 */
function isSameUtcDay(a, b) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

module.exports = {
  getDayOfYear,
  selectPromptForLanguage,
  shouldPostToday,
  isSameUtcDay
};
