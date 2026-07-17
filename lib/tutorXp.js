/**
 * Tutor-chip XP decision table — pure, no I/O. (H2, workstream-h-aistudy)
 *
 * Session-end paths (chat/roleplay endSession, story/photo generation,
 * pronunciation summary, daily-practice grading) award XP + streak via
 * learningTrackingService, fire-and-forget. This module owns the "how
 * much" decision so it is unit-testable without a DB.
 *
 * Values sit on the existing config/xpRewards scale:
 *   COMPLETE_LESSON 20 / COMPLETE_AI_QUIZ 25 / PRONUNCIATION_GOOD 10 /
 *   AI_CONVERSATION_COMPLETE 20.
 */

const TUTOR_CHIP_XP = {
  chat: 20,           // ≈ AI_CONVERSATION_COMPLETE — a finished tutor chat
  roleplay: 25,       // graded scenario ≈ COMPLETE_AI_QUIZ
  story: 15,          // one-shot generation + comprehension read
  photo: 15,          // describe-the-photo exercise
  pronunciation: 10,  // ≈ PRONUNCIATION_GOOD per practice session
  daily_practice: 15, // translation graded ≈ lesson-scale
};

const DAILY_PRACTICE_CORRECT_BONUS = 5; // score ≥ 80 (isCorrect)

/**
 * XP for finishing a tutor chip session.
 * @param {string} chip - 'chat'|'roleplay'|'story'|'photo'|'pronunciation'|'daily_practice'
 * @param {Object} [opts]
 * @param {number} [opts.userMessages] - chat/roleplay: user turns in session
 * @param {boolean} [opts.isCorrect]   - daily_practice: grader verdict
 * @returns {number} XP to award (0 for unknown chips or empty sessions)
 */
function xpForChip(chip, opts = {}) {
  const base = TUTOR_CHIP_XP[chip];
  if (!base) return 0;

  // Chat/roleplay: don't award for sessions the user never engaged with
  // (opened and immediately closed — 0 user messages). One message is
  // enough; the point is the habit tick, not grinding.
  if ((chip === 'chat' || chip === 'roleplay') && (opts.userMessages || 0) < 1) {
    return 0;
  }

  if (chip === 'daily_practice' && opts.isCorrect) {
    return base + DAILY_PRACTICE_CORRECT_BONUS;
  }

  return base;
}

module.exports = { xpForChip, TUTOR_CHIP_XP, DAILY_PRACTICE_CORRECT_BONUS };
