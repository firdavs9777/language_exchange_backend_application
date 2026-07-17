/**
 * TutorMemory weak-area decay + resolution — pure decision logic. (H6)
 *
 * Consumed by jobs/tutorMemoryDecayJob.js (NEW daily pass — no pre-existing
 * job iterates TutorMemory) and by tutorService.buildSystemPrompt (resolved
 * areas are excluded from prompts).
 *
 * Rules (spec H6):
 * - frequency HALVES when lastSeen > 14 days ago. Idempotent within a
 *   window: each area carries lastDecayedAt; a second job run inside the
 *   same 14-day window is a no-op (halving is at most once per 14d).
 * - an area exercised successfully RESOLVE_SUCCESS_N (3) times gets
 *   resolvedAt set → permanently excluded from prompts; never
 *   auto-resurrected (only fresh evidence writers may clear it, and none
 *   do — a new struggle creates a fresh entry instead).
 * - areas that decay to frequency 0 are also excluded from prompts but
 *   kept on the doc (cheap, and the frequency $slice cap already bounds
 *   growth).
 */

const DECAY_WINDOW_DAYS = 14;
const RESOLVE_SUCCESS_N = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Apply decay + resolution to a weakAreas array. Does not mutate input.
 * @param {Array<Object>} weakAreas - [{ topic, frequency, lastSeen, successCount?, resolvedAt?, lastDecayedAt? }]
 * @param {Date} [now]
 * @returns {{ weakAreas: Array<Object>, changed: boolean, decayed: number, resolved: number }}
 */
function decayWeakAreas(weakAreas, now = new Date()) {
  let changed = false;
  let decayed = 0;
  let resolved = 0;

  const next = (Array.isArray(weakAreas) ? weakAreas : []).map((areaIn) => {
    const area = { ...(areaIn?.toObject ? areaIn.toObject() : areaIn) };
    if (!area || !area.topic) return area;

    // Already resolved: frozen. Never resurrected, never re-decayed.
    if (area.resolvedAt) return area;

    // Resolution: N successful exercises.
    if ((area.successCount || 0) >= RESOLVE_SUCCESS_N) {
      area.resolvedAt = now;
      changed = true;
      resolved += 1;
      return area;
    }

    // Decay: halve when unseen > 14d, at most once per 14d window.
    const lastSeen = area.lastSeen ? new Date(area.lastSeen).getTime() : 0;
    const lastDecayed = area.lastDecayedAt ? new Date(area.lastDecayedAt).getTime() : 0;
    const staleSince = Math.max(lastSeen, lastDecayed);
    if (
      (area.frequency || 0) > 0 &&
      now.getTime() - staleSince > DECAY_WINDOW_DAYS * DAY_MS
    ) {
      area.frequency = Math.floor((area.frequency || 0) / 2);
      area.lastDecayedAt = now;
      changed = true;
      decayed += 1;
    }

    return area;
  });

  return { weakAreas: next, changed, decayed, resolved };
}

/**
 * Weak areas eligible for the tutor prompt: unresolved, still-relevant.
 * @param {Array<Object>} weakAreas
 * @param {number} [limit]
 * @returns {Array<Object>} sorted by frequency desc
 */
function promptableWeakAreas(weakAreas, limit = 3) {
  return (Array.isArray(weakAreas) ? weakAreas : [])
    .filter(w => w && w.topic && !w.resolvedAt && (w.frequency || 0) >= 1)
    .slice()
    .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
    .slice(0, limit);
}

module.exports = {
  decayWeakAreas,
  promptableWeakAreas,
  DECAY_WINDOW_DAYS,
  RESOLVE_SUCCESS_N,
};
