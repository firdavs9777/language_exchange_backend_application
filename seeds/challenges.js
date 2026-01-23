/**
 * Challenge Templates Seeds
 * Run with: node seeds/challenges.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './config/config.env' });

const Challenge = require('../models/Challenge');

const challengeTemplates = [
  // ===================== DAILY CHALLENGE TEMPLATES =====================
  // Messaging challenges
  {
    title: 'Conversation Starter',
    description: 'Send 5 messages in your target language',
    type: 'daily',
    category: 'messaging',
    requirement: { type: 'send_target_messages', value: 5 },
    xpReward: 50,
    icon: '💬',
    difficulty: 'easy',
    isTemplate: true
  },
  {
    title: 'Active Chatter',
    description: 'Send 15 messages in your target language',
    type: 'daily',
    category: 'messaging',
    requirement: { type: 'send_target_messages', value: 15 },
    xpReward: 75,
    icon: '🗣️',
    difficulty: 'medium',
    isTemplate: true
  },
  {
    title: 'Conversation Master',
    description: 'Send 30 messages in your target language',
    type: 'daily',
    category: 'messaging',
    requirement: { type: 'send_target_messages', value: 30 },
    xpReward: 100,
    icon: '🌟',
    difficulty: 'hard',
    isTemplate: true
  },

  // Correction challenges
  {
    title: 'Helpful Friend',
    description: 'Give 2 corrections to language partners',
    type: 'daily',
    category: 'corrections',
    requirement: { type: 'give_corrections', value: 2 },
    xpReward: 50,
    icon: '✏️',
    difficulty: 'easy',
    isTemplate: true
  },
  {
    title: 'Language Teacher',
    description: 'Give 5 corrections to language partners',
    type: 'daily',
    category: 'corrections',
    requirement: { type: 'give_corrections', value: 5 },
    xpReward: 75,
    icon: '👨‍🏫',
    difficulty: 'medium',
    isTemplate: true
  },
  {
    title: 'Humble Learner',
    description: 'Accept 3 corrections from partners',
    type: 'daily',
    category: 'corrections',
    requirement: { type: 'accept_corrections', value: 3 },
    xpReward: 50,
    icon: '🙏',
    difficulty: 'easy',
    isTemplate: true
  },

  // Vocabulary challenges
  {
    title: 'Word Hunter',
    description: 'Add 3 new vocabulary words',
    type: 'daily',
    category: 'vocabulary',
    requirement: { type: 'add_vocabulary', value: 3 },
    xpReward: 40,
    icon: '📖',
    difficulty: 'easy',
    isTemplate: true
  },
  {
    title: 'Vocabulary Builder',
    description: 'Add 10 new vocabulary words',
    type: 'daily',
    category: 'vocabulary',
    requirement: { type: 'add_vocabulary', value: 10 },
    xpReward: 75,
    icon: '📚',
    difficulty: 'hard',
    isTemplate: true
  },
  {
    title: 'Review Session',
    description: 'Review 10 vocabulary words',
    type: 'daily',
    category: 'vocabulary',
    requirement: { type: 'review_vocabulary', value: 10 },
    xpReward: 50,
    icon: '🔄',
    difficulty: 'easy',
    isTemplate: true
  },
  {
    title: 'Memory Master',
    description: 'Review 25 vocabulary words',
    type: 'daily',
    category: 'vocabulary',
    requirement: { type: 'review_vocabulary', value: 25 },
    xpReward: 75,
    icon: '🧠',
    difficulty: 'medium',
    isTemplate: true
  },

  // Lesson challenges
  {
    title: 'Quick Study',
    description: 'Complete 1 lesson',
    type: 'daily',
    category: 'lessons',
    requirement: { type: 'complete_lessons', value: 1 },
    xpReward: 40,
    icon: '📝',
    difficulty: 'easy',
    isTemplate: true
  },
  {
    title: 'Dedicated Learner',
    description: 'Complete 3 lessons',
    type: 'daily',
    category: 'lessons',
    requirement: { type: 'complete_lessons', value: 3 },
    xpReward: 80,
    icon: '📘',
    difficulty: 'hard',
    isTemplate: true
  },

  // XP challenges
  {
    title: 'XP Hunter',
    description: 'Earn 50 XP today',
    type: 'daily',
    category: 'mixed',
    requirement: { type: 'earn_xp', value: 50 },
    xpReward: 50,
    icon: '⭐',
    difficulty: 'easy',
    isTemplate: true
  },
  {
    title: 'XP Champion',
    description: 'Earn 100 XP today',
    type: 'daily',
    category: 'mixed',
    requirement: { type: 'earn_xp', value: 100 },
    xpReward: 75,
    icon: '🌟',
    difficulty: 'medium',
    isTemplate: true
  },
  {
    title: 'XP Legend',
    description: 'Earn 200 XP today',
    type: 'daily',
    category: 'mixed',
    requirement: { type: 'earn_xp', value: 200 },
    xpReward: 100,
    icon: '💫',
    difficulty: 'hard',
    isTemplate: true
  },

  // Social challenges
  {
    title: 'Social Learner',
    description: 'Chat with 2 different partners',
    type: 'daily',
    category: 'social',
    requirement: { type: 'talk_to_partners', value: 2 },
    xpReward: 50,
    icon: '👥',
    difficulty: 'easy',
    isTemplate: true
  },
  {
    title: 'Networking Pro',
    description: 'Chat with 5 different partners',
    type: 'daily',
    category: 'social',
    requirement: { type: 'talk_to_partners', value: 5 },
    xpReward: 75,
    icon: '🤝',
    difficulty: 'hard',
    isTemplate: true
  },

  // ===================== WEEKLY CHALLENGE TEMPLATES =====================
  {
    title: 'Weekly Messenger',
    description: 'Send 100 messages in your target language this week',
    type: 'weekly',
    category: 'messaging',
    requirement: { type: 'send_target_messages', value: 100 },
    xpReward: 200,
    icon: '📱',
    difficulty: 'medium',
    isTemplate: true
  },
  {
    title: 'Weekly Word Warrior',
    description: 'Add 30 vocabulary words this week',
    type: 'weekly',
    category: 'vocabulary',
    requirement: { type: 'add_vocabulary', value: 30 },
    xpReward: 200,
    icon: '📚',
    difficulty: 'medium',
    isTemplate: true
  },
  {
    title: 'Weekly Review Champion',
    description: 'Review 100 vocabulary words this week',
    type: 'weekly',
    category: 'vocabulary',
    requirement: { type: 'review_vocabulary', value: 100 },
    xpReward: 200,
    icon: '🔄',
    difficulty: 'medium',
    isTemplate: true
  },
  {
    title: 'Weekly Scholar',
    description: 'Complete 10 lessons this week',
    type: 'weekly',
    category: 'lessons',
    requirement: { type: 'complete_lessons', value: 10 },
    xpReward: 250,
    icon: '🎓',
    difficulty: 'hard',
    isTemplate: true
  },
  {
    title: 'Weekly Helper',
    description: 'Give 20 corrections this week',
    type: 'weekly',
    category: 'corrections',
    requirement: { type: 'give_corrections', value: 20 },
    xpReward: 200,
    icon: '🤝',
    difficulty: 'medium',
    isTemplate: true
  },
  {
    title: 'Weekly XP Master',
    description: 'Earn 500 XP this week',
    type: 'weekly',
    category: 'mixed',
    requirement: { type: 'earn_xp', value: 500 },
    xpReward: 200,
    icon: '🏆',
    difficulty: 'medium',
    isTemplate: true
  },
  {
    title: 'Perfect Week',
    description: 'Maintain your streak for 7 days',
    type: 'weekly',
    category: 'streak',
    requirement: { type: 'maintain_streak', value: 7 },
    xpReward: 250,
    bonusReward: { type: 'streak_freeze', value: 1 },
    icon: '🔥',
    difficulty: 'medium',
    isTemplate: true
  }
];

const seedChallenges = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing template challenges
    await Challenge.deleteMany({ isTemplate: true });
    console.log('Cleared existing challenge templates');

    // Add startsAt and endsAt for templates (these will be overridden when generating actual challenges)
    const now = new Date();
    const templatesWithDates = challengeTemplates.map(template => ({
      ...template,
      startsAt: now,
      endsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
    }));

    // Insert new templates
    await Challenge.insertMany(templatesWithDates);
    console.log(`Seeded ${challengeTemplates.length} challenge templates`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding challenges:', error);
    process.exit(1);
  }
};

// Run the seed
seedChallenges();
