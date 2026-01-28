/**
 * XP Rewards Configuration
 * Centralized configuration for all XP-earning activities
 */

const XP_REWARDS = {
  // Message activities
  MESSAGE_TARGET_LANGUAGE: 2,        // Sending message in target language
  MESSAGE_NATIVE_LANGUAGE: 0,        // No XP for native language messages

  // Correction activities
  GIVE_CORRECTION: 5,                // Giving a correction to someone
  RECEIVE_CORRECTION: 1,             // Receiving a correction (encourages engagement)
  ACCEPT_CORRECTION: 3,              // Accepting a correction

  // Lesson activities
  COMPLETE_LESSON: 20,               // Completing a lesson
  PERFECT_LESSON_BONUS: 5,           // Bonus for 100% accuracy
  FIRST_LESSON_BONUS: 10,            // Bonus for first lesson ever

  // Quiz activities
  COMPLETE_QUIZ: 30,                 // Completing any quiz
  PLACEMENT_TEST_BONUS: 50,          // Completing placement test
  PERFECT_QUIZ_BONUS: 10,            // Bonus for 100% accuracy

  // Vocabulary activities
  ADD_VOCABULARY: 2,                 // Adding a new word
  REVIEW_VOCABULARY: 1,              // Reviewing a word (regardless of result)
  MASTER_VOCABULARY: 10,             // Mastering a word (SRS level 9)
  VOCABULARY_STREAK_BONUS: 5,        // Reviewing 10+ words in a session

  // Challenge activities
  COMPLETE_DAILY_CHALLENGE: 50,      // Completing daily challenge
  COMPLETE_WEEKLY_CHALLENGE: 200,    // Completing weekly challenge
  COMPLETE_SPECIAL_CHALLENGE: 100,   // Completing special/event challenge

  // Streak activities
  DAILY_STREAK_BONUS: 5,             // Per day of streak (up to 7 days)
  WEEKLY_STREAK_MILESTONE: 50,       // Bonus for 7-day streak
  MONTHLY_STREAK_MILESTONE: 200,     // Bonus for 30-day streak

  // Social activities
  FIRST_CONVERSATION: 20,            // Starting first conversation
  CONVERSATION_MILESTONE_10: 50,     // 10th conversation milestone
  HELP_NEW_USER: 10,                 // Helping someone in their first week

  // AI Conversation activities
  AI_CONVERSATION_MESSAGE: 3,        // Per message in AI conversation
  AI_CONVERSATION_COMPLETE: 20,      // Completing an AI conversation (10+ messages)
  AI_CONVERSATION_FIRST: 50,         // First AI conversation bonus
  AI_CONVERSATION_STREAK_3: 15,      // 3-day AI conversation streak
  AI_CONVERSATION_STREAK_7: 50,      // 7-day AI conversation streak

  // Grammar Feedback activities
  GRAMMAR_FEEDBACK_REQUEST: 1,       // Requesting grammar feedback
  GRAMMAR_FEEDBACK_APPLY: 5,         // Applying a suggested correction
  GRAMMAR_PERFECT_MESSAGE: 10,       // Message with no errors

  // AI Quiz activities
  COMPLETE_AI_QUIZ: 25,              // Completing AI-generated quiz
  PERFECT_AI_QUIZ_BONUS: 10,         // Perfect score on AI quiz
  IMPROVE_WEAK_AREA: 15,             // Improving a previously weak area

  // Pronunciation activities
  PRONUNCIATION_EXCELLENT: 15,       // Score >= 90
  PRONUNCIATION_GOOD: 10,            // Score >= 70
  PRONUNCIATION_ATTEMPT: 3,          // Any pronunciation attempt
  TTS_LISTEN: 1,                     // Listening to TTS audio

  // AI Translation activities
  ENHANCED_TRANSLATION_USE: 2,       // Using enhanced translation
  IDIOM_LEARNED: 5,                  // Learning an idiom through translation
  GRAMMAR_EXPLORED: 3,               // Exploring grammar explanations
};

/**
 * Daily XP Goals Configuration
 */
const DAILY_GOALS = {
  casual: {
    name: 'Casual',
    xpTarget: 10,
    description: '10 XP per day - Perfect for busy schedules'
  },
  regular: {
    name: 'Regular',
    xpTarget: 30,
    description: '30 XP per day - Steady progress'
  },
  serious: {
    name: 'Serious',
    xpTarget: 50,
    description: '50 XP per day - Committed learning'
  },
  intense: {
    name: 'Intense',
    xpTarget: 100,
    description: '100 XP per day - Maximum progress'
  }
};

/**
 * Level Calculation
 * Uses a square root formula for smooth progression
 * Level 1: 0 XP, Level 2: 100 XP, Level 10: ~3000 XP, Level 50: ~62500 XP
 */
const calculateLevel = (totalXP) => {
  if (totalXP <= 0) return 1;
  // Level = floor(sqrt(XP / 25)) + 1
  return Math.floor(Math.sqrt(totalXP / 25)) + 1;
};

/**
 * XP needed to reach a specific level
 */
const xpForLevel = (level) => {
  if (level <= 1) return 0;
  // XP = (level - 1)^2 * 25
  return Math.pow(level - 1, 2) * 25;
};

/**
 * Progress to next level (0-100%)
 */
const levelProgress = (totalXP) => {
  const currentLevel = calculateLevel(totalXP);
  const currentLevelXP = xpForLevel(currentLevel);
  const nextLevelXP = xpForLevel(currentLevel + 1);
  const xpInCurrentLevel = totalXP - currentLevelXP;
  const xpNeededForNext = nextLevelXP - currentLevelXP;

  return Math.floor((xpInCurrentLevel / xpNeededForNext) * 100);
};

/**
 * Streak Multiplier
 * Bonus XP multiplier based on streak length
 */
const getStreakMultiplier = (streakDays) => {
  if (streakDays >= 30) return 1.5;  // 50% bonus
  if (streakDays >= 14) return 1.3;  // 30% bonus
  if (streakDays >= 7) return 1.2;   // 20% bonus
  if (streakDays >= 3) return 1.1;   // 10% bonus
  return 1.0;
};

/**
 * CEFR Proficiency Levels
 */
const PROFICIENCY_LEVELS = {
  A1: { name: 'Beginner', minLessons: 0, description: 'Can understand basic expressions' },
  A2: { name: 'Elementary', minLessons: 10, description: 'Can communicate in simple tasks' },
  B1: { name: 'Intermediate', minLessons: 30, description: 'Can deal with most situations' },
  B2: { name: 'Upper Intermediate', minLessons: 60, description: 'Can interact with fluency' },
  C1: { name: 'Advanced', minLessons: 100, description: 'Can express ideas fluently' },
  C2: { name: 'Mastery', minLessons: 150, description: 'Can understand virtually everything' }
};

/**
 * SRS (Spaced Repetition System) Intervals
 * Level -> Days until next review
 */
const SRS_INTERVALS = {
  0: 0,      // Same day (new/failed)
  1: 1,      // 1 day
  2: 3,      // 3 days
  3: 7,      // 1 week
  4: 14,     // 2 weeks
  5: 30,     // 1 month
  6: 60,     // 2 months
  7: 120,    // 4 months
  8: 240,    // 8 months
  9: 365     // 1 year (mastered)
};

/**
 * Calculate next review date based on SRS level
 */
const getNextReviewDate = (srsLevel) => {
  const daysUntilReview = SRS_INTERVALS[Math.min(srsLevel, 9)] || 0;
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + daysUntilReview);
  nextReview.setHours(0, 0, 0, 0); // Reset to start of day
  return nextReview;
};

/**
 * Challenge Types Configuration
 */
const CHALLENGE_TYPES = {
  daily: {
    duration: 24 * 60 * 60 * 1000, // 24 hours
    maxActive: 3
  },
  weekly: {
    duration: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxActive: 1
  },
  special: {
    duration: null, // Custom duration
    maxActive: 5
  }
};

/**
 * Achievement Categories
 */
const ACHIEVEMENT_CATEGORIES = [
  'beginner',      // First steps achievements
  'vocabulary',    // Word learning achievements
  'lessons',       // Lesson completion achievements
  'streaks',       // Streak-based achievements
  'social',        // Conversation/helping achievements
  'milestones',    // Major progress milestones
  'special'        // Limited time/event achievements
];

module.exports = {
  XP_REWARDS,
  DAILY_GOALS,
  calculateLevel,
  xpForLevel,
  levelProgress,
  getStreakMultiplier,
  PROFICIENCY_LEVELS,
  SRS_INTERVALS,
  getNextReviewDate,
  CHALLENGE_TYPES,
  ACHIEVEMENT_CATEGORIES
};
