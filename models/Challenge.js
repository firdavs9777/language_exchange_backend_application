const mongoose = require('mongoose');

/**
 * Challenge Model
 * Defines daily, weekly, and special challenges
 */
const ChallengeSchema = new mongoose.Schema({
  // Display info
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },

  // Challenge type
  type: {
    type: String,
    enum: ['daily', 'weekly', 'special'],
    required: true,
    index: true
  },

  // Target language (null = any language)
  targetLanguage: {
    type: String,
    default: null,
    index: true
  },

  // Challenge category
  category: {
    type: String,
    enum: ['messaging', 'vocabulary', 'lessons', 'corrections', 'social', 'streak', 'mixed'],
    required: true
  },

  // Requirement
  requirement: {
    type: {
      type: String,
      enum: [
        'send_messages',          // Send X messages
        'send_target_messages',   // Send X messages in target language
        'give_corrections',       // Give X corrections
        'accept_corrections',     // Accept X corrections
        'add_vocabulary',         // Add X vocabulary words
        'review_vocabulary',      // Review X vocabulary words
        'complete_lessons',       // Complete X lessons
        'earn_xp',                // Earn X XP
        'maintain_streak',        // Maintain streak
        'talk_to_partners',       // Talk to X different partners
        'perfect_reviews'         // Get X perfect vocabulary reviews
      ],
      required: true
    },
    value: {
      type: Number,
      required: true
    }
  },

  // XP reward
  xpReward: {
    type: Number,
    required: true,
    default: 50
  },

  // Bonus reward (optional)
  bonusReward: {
    type: {
      type: String,
      enum: ['streak_freeze', 'xp_boost', 'badge']
    },
    value: mongoose.Schema.Types.Mixed
  },

  // Icon/emoji
  icon: {
    type: String,
    default: '⭐'
  },

  // Difficulty
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },

  // Active period
  startsAt: {
    type: Date,
    required: true,
    index: true
  },
  endsAt: {
    type: Date,
    required: true,
    index: true
  },

  // Is this a template for auto-generation?
  isTemplate: {
    type: Boolean,
    default: false
  },

  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }

}, { timestamps: true });

// Indexes
ChallengeSchema.index({ type: 1, isActive: 1, startsAt: 1, endsAt: 1 });
ChallengeSchema.index({ category: 1, isActive: 1 });

/**
 * Get active challenges
 */
ChallengeSchema.statics.getActiveChallenges = async function(type = null, targetLanguage = null) {
  const now = new Date();

  const filter = {
    isActive: true,
    isTemplate: false,
    startsAt: { $lte: now },
    endsAt: { $gt: now }
  };

  if (type) filter.type = type;
  if (targetLanguage) {
    filter.$or = [
      { targetLanguage: null },
      { targetLanguage: targetLanguage }
    ];
  }

  return this.find(filter).sort({ type: 1, difficulty: 1 }).lean();
};

/**
 * Get challenge templates for auto-generation
 */
ChallengeSchema.statics.getTemplates = async function(type = 'daily') {
  return this.find({
    isTemplate: true,
    isActive: true,
    type: type
  }).lean();
};

/**
 * Create daily challenges from templates
 */
ChallengeSchema.statics.generateDailyChallenges = async function(count = 3) {
  const templates = await this.getTemplates('daily');
  if (templates.length === 0) return [];

  // Shuffle and pick templates
  const shuffled = templates.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  const now = new Date();
  const startsAt = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + 1);

  const challenges = selected.map(template => ({
    title: template.title,
    description: template.description,
    type: 'daily',
    targetLanguage: template.targetLanguage,
    category: template.category,
    requirement: template.requirement,
    xpReward: template.xpReward,
    bonusReward: template.bonusReward,
    icon: template.icon,
    difficulty: template.difficulty,
    startsAt,
    endsAt,
    isTemplate: false,
    isActive: true
  }));

  return this.insertMany(challenges);
};

/**
 * Create weekly challenge
 */
ChallengeSchema.statics.generateWeeklyChallenge = async function() {
  const templates = await this.getTemplates('weekly');
  if (templates.length === 0) return null;

  // Pick random template
  const template = templates[Math.floor(Math.random() * templates.length)];

  // Find next Monday
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

  const startsAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
  startsAt.setHours(0, 0, 0, 0);

  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + 7);

  return this.create({
    title: template.title,
    description: template.description,
    type: 'weekly',
    targetLanguage: template.targetLanguage,
    category: template.category,
    requirement: template.requirement,
    xpReward: template.xpReward,
    bonusReward: template.bonusReward,
    icon: template.icon,
    difficulty: template.difficulty,
    startsAt,
    endsAt,
    isTemplate: false,
    isActive: true
  });
};

module.exports = mongoose.model('Challenge', ChallengeSchema);
