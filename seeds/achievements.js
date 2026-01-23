/**
 * Achievement Seeds
 * Run with: node seeds/achievements.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './config/config.env' });

const Achievement = require('../models/Achievement');

const achievements = [
  // ===================== BEGINNER CATEGORY =====================
  {
    code: 'first_message',
    name: 'First Words',
    description: 'Send your first message in your target language',
    icon: '👋',
    category: 'beginner',
    tier: 'bronze',
    xpReward: 25,
    requirement: { type: 'first_action', value: 1, action: 'first_target_message' },
    progressType: 'boolean',
    sortOrder: 1
  },
  {
    code: 'first_correction',
    name: 'Helping Hand',
    description: 'Give your first correction to someone',
    icon: '✏️',
    category: 'beginner',
    tier: 'bronze',
    xpReward: 25,
    requirement: { type: 'first_action', value: 1, action: 'first_correction_given' },
    progressType: 'boolean',
    sortOrder: 2
  },
  {
    code: 'first_vocabulary',
    name: 'Word Collector',
    description: 'Add your first vocabulary word',
    icon: '📖',
    category: 'beginner',
    tier: 'bronze',
    xpReward: 25,
    requirement: { type: 'first_action', value: 1, action: 'first_vocabulary' },
    progressType: 'boolean',
    sortOrder: 3
  },
  {
    code: 'first_lesson',
    name: 'Student',
    description: 'Complete your first lesson',
    icon: '📚',
    category: 'beginner',
    tier: 'bronze',
    xpReward: 30,
    requirement: { type: 'first_action', value: 1, action: 'first_lesson' },
    progressType: 'boolean',
    sortOrder: 4
  },
  {
    code: 'placement_test',
    name: 'Know Thyself',
    description: 'Complete the placement test',
    icon: '🎯',
    category: 'beginner',
    tier: 'silver',
    xpReward: 50,
    requirement: { type: 'first_action', value: 1, action: 'placement_test' },
    progressType: 'boolean',
    sortOrder: 5
  },

  // ===================== VOCABULARY CATEGORY =====================
  {
    code: 'vocabulary_10',
    name: 'Vocabulary Starter',
    description: 'Add 10 vocabulary words',
    icon: '📝',
    category: 'vocabulary',
    tier: 'bronze',
    xpReward: 30,
    requirement: { type: 'vocabulary_count', value: 10 },
    progressType: 'count',
    sortOrder: 1
  },
  {
    code: 'vocabulary_50',
    name: 'Word Enthusiast',
    description: 'Add 50 vocabulary words',
    icon: '📕',
    category: 'vocabulary',
    tier: 'silver',
    xpReward: 75,
    requirement: { type: 'vocabulary_count', value: 50 },
    progressType: 'count',
    sortOrder: 2
  },
  {
    code: 'vocabulary_100',
    name: 'Lexicon Builder',
    description: 'Add 100 vocabulary words',
    icon: '📗',
    category: 'vocabulary',
    tier: 'gold',
    xpReward: 150,
    requirement: { type: 'vocabulary_count', value: 100 },
    progressType: 'count',
    sortOrder: 3
  },
  {
    code: 'vocabulary_500',
    name: 'Dictionary',
    description: 'Add 500 vocabulary words',
    icon: '📘',
    category: 'vocabulary',
    tier: 'platinum',
    xpReward: 300,
    requirement: { type: 'vocabulary_count', value: 500 },
    progressType: 'count',
    sortOrder: 4
  },
  {
    code: 'master_10',
    name: 'Memory Pro',
    description: 'Master 10 vocabulary words',
    icon: '🧠',
    category: 'vocabulary',
    tier: 'silver',
    xpReward: 50,
    requirement: { type: 'vocabulary_mastered', value: 10 },
    progressType: 'count',
    sortOrder: 5
  },
  {
    code: 'master_50',
    name: 'Memory Master',
    description: 'Master 50 vocabulary words',
    icon: '🎓',
    category: 'vocabulary',
    tier: 'gold',
    xpReward: 150,
    requirement: { type: 'vocabulary_mastered', value: 50 },
    progressType: 'count',
    sortOrder: 6
  },
  {
    code: 'master_100',
    name: 'Vocabulary Legend',
    description: 'Master 100 vocabulary words',
    icon: '👑',
    category: 'vocabulary',
    tier: 'diamond',
    xpReward: 500,
    requirement: { type: 'vocabulary_mastered', value: 100 },
    progressType: 'count',
    sortOrder: 7
  },

  // ===================== LESSONS CATEGORY =====================
  {
    code: 'lessons_5',
    name: 'Eager Learner',
    description: 'Complete 5 lessons',
    icon: '📖',
    category: 'lessons',
    tier: 'bronze',
    xpReward: 40,
    requirement: { type: 'lesson_count', value: 5 },
    progressType: 'count',
    sortOrder: 1
  },
  {
    code: 'lessons_20',
    name: 'Dedicated Student',
    description: 'Complete 20 lessons',
    icon: '📚',
    category: 'lessons',
    tier: 'silver',
    xpReward: 100,
    requirement: { type: 'lesson_count', value: 20 },
    progressType: 'count',
    sortOrder: 2
  },
  {
    code: 'lessons_50',
    name: 'Scholar',
    description: 'Complete 50 lessons',
    icon: '🎒',
    category: 'lessons',
    tier: 'gold',
    xpReward: 200,
    requirement: { type: 'lesson_count', value: 50 },
    progressType: 'count',
    sortOrder: 3
  },
  {
    code: 'lessons_100',
    name: 'Academic',
    description: 'Complete 100 lessons',
    icon: '🏛️',
    category: 'lessons',
    tier: 'platinum',
    xpReward: 400,
    requirement: { type: 'lesson_count', value: 100 },
    progressType: 'count',
    sortOrder: 4
  },
  {
    code: 'perfect_5',
    name: 'Perfectionist',
    description: 'Get 100% on 5 lessons',
    icon: '💯',
    category: 'lessons',
    tier: 'silver',
    xpReward: 75,
    requirement: { type: 'perfect_lesson', value: 5 },
    progressType: 'count',
    sortOrder: 5
  },
  {
    code: 'perfect_20',
    name: 'Flawless',
    description: 'Get 100% on 20 lessons',
    icon: '⭐',
    category: 'lessons',
    tier: 'gold',
    xpReward: 200,
    requirement: { type: 'perfect_lesson', value: 20 },
    progressType: 'count',
    sortOrder: 6
  },

  // ===================== STREAKS CATEGORY =====================
  {
    code: 'streak_3',
    name: 'Getting Started',
    description: 'Maintain a 3-day streak',
    icon: '🔥',
    category: 'streaks',
    tier: 'bronze',
    xpReward: 30,
    requirement: { type: 'streak_days', value: 3 },
    progressType: 'count',
    sortOrder: 1
  },
  {
    code: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    icon: '🔥',
    category: 'streaks',
    tier: 'silver',
    xpReward: 75,
    requirement: { type: 'streak_days', value: 7 },
    progressType: 'count',
    sortOrder: 2
  },
  {
    code: 'streak_14',
    name: 'Two Week Champion',
    description: 'Maintain a 14-day streak',
    icon: '🔥',
    category: 'streaks',
    tier: 'gold',
    xpReward: 150,
    requirement: { type: 'streak_days', value: 14 },
    progressType: 'count',
    sortOrder: 3
  },
  {
    code: 'streak_30',
    name: 'Month Master',
    description: 'Maintain a 30-day streak',
    icon: '🔥',
    category: 'streaks',
    tier: 'platinum',
    xpReward: 300,
    requirement: { type: 'streak_days', value: 30 },
    progressType: 'count',
    sortOrder: 4
  },
  {
    code: 'streak_100',
    name: 'Unstoppable',
    description: 'Maintain a 100-day streak',
    icon: '💎',
    category: 'streaks',
    tier: 'diamond',
    xpReward: 1000,
    requirement: { type: 'streak_days', value: 100 },
    progressType: 'count',
    sortOrder: 5
  },
  {
    code: 'streak_365',
    name: 'Year of Dedication',
    description: 'Maintain a 365-day streak',
    icon: '🏆',
    category: 'streaks',
    tier: 'diamond',
    xpReward: 5000,
    requirement: { type: 'streak_days', value: 365 },
    progressType: 'count',
    sortOrder: 6
  },

  // ===================== SOCIAL CATEGORY =====================
  {
    code: 'corrections_10',
    name: 'Helper',
    description: 'Give 10 corrections',
    icon: '🤝',
    category: 'social',
    tier: 'bronze',
    xpReward: 40,
    requirement: { type: 'correction_given', value: 10 },
    progressType: 'count',
    sortOrder: 1
  },
  {
    code: 'corrections_50',
    name: 'Teacher',
    description: 'Give 50 corrections',
    icon: '👨‍🏫',
    category: 'social',
    tier: 'silver',
    xpReward: 100,
    requirement: { type: 'correction_given', value: 50 },
    progressType: 'count',
    sortOrder: 2
  },
  {
    code: 'corrections_100',
    name: 'Language Mentor',
    description: 'Give 100 corrections',
    icon: '🎖️',
    category: 'social',
    tier: 'gold',
    xpReward: 250,
    requirement: { type: 'correction_given', value: 100 },
    progressType: 'count',
    sortOrder: 3
  },
  {
    code: 'messages_100',
    name: 'Chatterbox',
    description: 'Send 100 messages in target language',
    icon: '💬',
    category: 'social',
    tier: 'bronze',
    xpReward: 50,
    requirement: { type: 'message_count', value: 100 },
    progressType: 'count',
    sortOrder: 4
  },
  {
    code: 'messages_500',
    name: 'Conversationalist',
    description: 'Send 500 messages in target language',
    icon: '🗣️',
    category: 'social',
    tier: 'silver',
    xpReward: 150,
    requirement: { type: 'message_count', value: 500 },
    progressType: 'count',
    sortOrder: 5
  },
  {
    code: 'messages_1000',
    name: 'Communication Expert',
    description: 'Send 1000 messages in target language',
    icon: '🌟',
    category: 'social',
    tier: 'gold',
    xpReward: 300,
    requirement: { type: 'message_count', value: 1000 },
    progressType: 'count',
    sortOrder: 6
  },
  {
    code: 'partners_5',
    name: 'Making Friends',
    description: 'Chat with 5 different partners',
    icon: '👥',
    category: 'social',
    tier: 'bronze',
    xpReward: 40,
    requirement: { type: 'conversations_count', value: 5 },
    progressType: 'count',
    sortOrder: 7
  },
  {
    code: 'partners_20',
    name: 'Social Butterfly',
    description: 'Chat with 20 different partners',
    icon: '🦋',
    category: 'social',
    tier: 'silver',
    xpReward: 100,
    requirement: { type: 'conversations_count', value: 20 },
    progressType: 'count',
    sortOrder: 8
  },

  // ===================== MILESTONES CATEGORY =====================
  {
    code: 'xp_1000',
    name: 'Rising Star',
    description: 'Earn 1,000 XP',
    icon: '⭐',
    category: 'milestones',
    tier: 'bronze',
    xpReward: 50,
    requirement: { type: 'total_xp', value: 1000 },
    progressType: 'count',
    sortOrder: 1
  },
  {
    code: 'xp_5000',
    name: 'Language Apprentice',
    description: 'Earn 5,000 XP',
    icon: '🌟',
    category: 'milestones',
    tier: 'silver',
    xpReward: 100,
    requirement: { type: 'total_xp', value: 5000 },
    progressType: 'count',
    sortOrder: 2
  },
  {
    code: 'xp_10000',
    name: 'Language Expert',
    description: 'Earn 10,000 XP',
    icon: '💫',
    category: 'milestones',
    tier: 'gold',
    xpReward: 200,
    requirement: { type: 'total_xp', value: 10000 },
    progressType: 'count',
    sortOrder: 3
  },
  {
    code: 'xp_50000',
    name: 'Language Master',
    description: 'Earn 50,000 XP',
    icon: '🏆',
    category: 'milestones',
    tier: 'platinum',
    xpReward: 500,
    requirement: { type: 'total_xp', value: 50000 },
    progressType: 'count',
    sortOrder: 4
  },
  {
    code: 'level_10',
    name: 'Level 10',
    description: 'Reach level 10',
    icon: '🔟',
    category: 'milestones',
    tier: 'silver',
    xpReward: 100,
    requirement: { type: 'level_reached', value: 10 },
    progressType: 'count',
    sortOrder: 5
  },
  {
    code: 'level_25',
    name: 'Level 25',
    description: 'Reach level 25',
    icon: '🎯',
    category: 'milestones',
    tier: 'gold',
    xpReward: 250,
    requirement: { type: 'level_reached', value: 25 },
    progressType: 'count',
    sortOrder: 6
  },
  {
    code: 'level_50',
    name: 'Level 50',
    description: 'Reach level 50',
    icon: '👑',
    category: 'milestones',
    tier: 'platinum',
    xpReward: 500,
    requirement: { type: 'level_reached', value: 50 },
    progressType: 'count',
    sortOrder: 7
  },
  {
    code: 'daily_challenge_7',
    name: 'Challenge Seeker',
    description: 'Complete 7 daily challenges',
    icon: '🎯',
    category: 'milestones',
    tier: 'bronze',
    xpReward: 50,
    requirement: { type: 'challenge_daily', value: 7 },
    progressType: 'count',
    sortOrder: 8
  },
  {
    code: 'daily_challenge_30',
    name: 'Challenge Champion',
    description: 'Complete 30 daily challenges',
    icon: '🏅',
    category: 'milestones',
    tier: 'silver',
    xpReward: 150,
    requirement: { type: 'challenge_daily', value: 30 },
    progressType: 'count',
    sortOrder: 9
  },
  {
    code: 'weekly_challenge_4',
    name: 'Weekly Warrior',
    description: 'Complete 4 weekly challenges',
    icon: '🗓️',
    category: 'milestones',
    tier: 'silver',
    xpReward: 100,
    requirement: { type: 'challenge_weekly', value: 4 },
    progressType: 'count',
    sortOrder: 10
  }
];

const seedAchievements = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing achievements
    await Achievement.deleteMany({});
    console.log('Cleared existing achievements');

    // Insert new achievements
    await Achievement.insertMany(achievements);
    console.log(`Seeded ${achievements.length} achievements`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding achievements:', error);
    process.exit(1);
  }
};

// Run the seed
seedAchievements();
