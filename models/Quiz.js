const mongoose = require('mongoose');

/**
 * Quiz Question subdocument
 */
const QuizQuestionSchema = new mongoose.Schema({
  // Question type
  type: {
    type: String,
    enum: ['multiple_choice', 'true_false', 'fill_blank', 'translation', 'listening'],
    required: true
  },

  // Question text
  question: {
    type: String,
    required: true
  },

  // Audio URL (for listening questions)
  audioUrl: String,

  // Image URL
  imageUrl: String,

  // Options (for multiple choice)
  options: [{
    text: String,
    isCorrect: Boolean
  }],

  // Correct answer
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Alternative accepted answers
  acceptedAnswers: [String],

  // Explanation
  explanation: String,

  // Difficulty
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },

  // Points
  points: {
    type: Number,
    default: 10
  },

  // Tags for categorization
  tags: [String]
}, { _id: true });

/**
 * Quiz Model
 * Assessment and placement tests
 */
const QuizSchema = new mongoose.Schema({
  // Display info
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },

  // Quiz type
  type: {
    type: String,
    enum: ['placement', 'level_test', 'unit_test', 'practice', 'daily'],
    required: true,
    index: true
  },

  // Target language
  language: {
    type: String,
    required: true,
    index: true
  },

  // CEFR level (null for placement tests)
  level: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', null],
    default: null,
    index: true
  },

  // Category
  category: {
    type: String,
    enum: ['grammar', 'vocabulary', 'reading', 'listening', 'mixed'],
    default: 'mixed'
  },

  // Questions
  questions: [QuizQuestionSchema],

  // Settings
  settings: {
    // Time limit in seconds (null = no limit)
    timeLimit: {
      type: Number,
      default: null
    },
    // Shuffle questions?
    shuffleQuestions: {
      type: Boolean,
      default: true
    },
    // Shuffle options?
    shuffleOptions: {
      type: Boolean,
      default: true
    },
    // Show correct answers after?
    showCorrectAnswers: {
      type: Boolean,
      default: true
    },
    // Allow retake?
    allowRetake: {
      type: Boolean,
      default: true
    },
    // Minimum passing score
    passingScore: {
      type: Number,
      default: 70
    }
  },

  // For placement tests - level thresholds
  levelThresholds: {
    A1: { min: 0, max: 20 },
    A2: { min: 21, max: 40 },
    B1: { min: 41, max: 60 },
    B2: { min: 61, max: 75 },
    C1: { min: 76, max: 90 },
    C2: { min: 91, max: 100 }
  },

  // XP reward
  xpReward: {
    type: Number,
    default: 30
  },

  // Perfect score bonus
  perfectBonus: {
    type: Number,
    default: 10
  },

  // Icon
  icon: {
    type: String,
    default: '📝'
  },

  // Statistics
  stats: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    passRate: {
      type: Number,
      default: 0
    }
  },

  // Status
  isPublished: {
    type: Boolean,
    default: false,
    index: true
  },
  publishedAt: Date,

  // Premium?
  isPremium: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

// Indexes
QuizSchema.index({ language: 1, type: 1, level: 1, isPublished: 1 });

/**
 * Get available quizzes
 */
QuizSchema.statics.getQuizzes = async function(options = {}) {
  const { language, type, level, limit = 50, skip = 0 } = options;

  const filter = { isPublished: true };
  if (language) filter.language = language;
  if (type) filter.type = type;
  if (level) filter.level = level;

  return this.find(filter)
    .select('-questions.correctAnswer -questions.acceptedAnswers')
    .sort({ type: 1, level: 1, title: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

/**
 * Get placement test for a language
 */
QuizSchema.statics.getPlacementTest = async function(language) {
  return this.findOne({
    language,
    type: 'placement',
    isPublished: true
  })
    .select('-questions.correctAnswer -questions.acceptedAnswers')
    .lean();
};

/**
 * Determine level from placement test score
 */
QuizSchema.methods.determineLevel = function(scorePercent) {
  const thresholds = this.levelThresholds;

  for (const [level, range] of Object.entries(thresholds).reverse()) {
    if (scorePercent >= range.min && scorePercent <= range.max) {
      return level;
    }
  }

  return 'A1';
};

module.exports = mongoose.model('Quiz', QuizSchema);
