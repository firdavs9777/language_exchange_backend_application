const mongoose = require('mongoose');

/**
 * Exercise subdocument schema
 */
const ExerciseSchema = new mongoose.Schema({
  // Exercise type
  type: {
    type: String,
    enum: [
      'multiple_choice',    // Select correct answer
      'fill_blank',         // Fill in the blank
      'matching',           // Match pairs
      'translation',        // Translate sentence
      'ordering',           // Put words in order
      'listening',          // Listen and answer
      'speaking',           // Speak and verify
      'typing'              // Type the answer
    ],
    required: true
  },

  // Question/prompt
  question: {
    type: String,
    required: true
  },

  // For exercises with text in target language
  targetText: String,

  // Audio URL (for listening exercises)
  audioUrl: String,

  // Image URL (for visual exercises)
  imageUrl: String,

  // Options (for multiple choice, matching)
  options: [{
    text: String,
    isCorrect: Boolean,
    matchWith: String // For matching exercises
  }],

  // Correct answer(s)
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Alternative accepted answers
  acceptedAnswers: [String],

  // Hint
  hint: String,

  // Explanation shown after answer
  explanation: String,

  // Points for this exercise
  points: {
    type: Number,
    default: 10
  },

  // Order in lesson
  order: {
    type: Number,
    default: 0
  }
}, { _id: true });

/**
 * Lesson Model
 * Structured curriculum content
 */
const LessonSchema = new mongoose.Schema({
  // Display info
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },

  // Slug for URL
  slug: {
    type: String,
    unique: true,
    index: true
  },

  // Target language
  language: {
    type: String,
    required: true,
    index: true
  },

  // CEFR proficiency level
  level: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    required: true,
    index: true
  },

  // Category
  category: {
    type: String,
    enum: ['grammar', 'vocabulary', 'conversation', 'pronunciation', 'reading', 'listening', 'writing', 'culture'],
    required: true,
    index: true
  },

  // Sub-category/topic
  topic: {
    type: String,
    required: true
  },

  // Icon/image
  icon: {
    type: String,
    default: '📚'
  },
  imageUrl: String,

  // Lesson content introduction
  introduction: {
    type: String,
    maxlength: 2000
  },

  // Teaching content (before exercises)
  content: [{
    type: {
      type: String,
      enum: ['text', 'example', 'tip', 'image', 'audio', 'video'],
      required: true
    },
    title: String,
    body: String,
    mediaUrl: String,
    translation: String,
    order: Number
  }],

  // Exercises
  exercises: [ExerciseSchema],

  // XP reward for completion
  xpReward: {
    type: Number,
    default: 20
  },

  // Perfect score bonus
  perfectBonus: {
    type: Number,
    default: 5
  },

  // Estimated time (minutes)
  estimatedMinutes: {
    type: Number,
    default: 10
  },

  // Prerequisites (other lessons to complete first)
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  }],

  // Recommended next lessons
  nextLessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  }],

  // Unit/module grouping
  unit: {
    number: Number,
    name: String
  },

  // Order within unit
  orderInUnit: {
    type: Number,
    default: 0
  },

  // Tags for filtering
  tags: [String],

  // Statistics
  stats: {
    totalCompletions: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    averageTime: {
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

  // Premium content?
  isPremium: {
    type: Boolean,
    default: false
  },

  // Version tracking
  version: {
    type: Number,
    default: 1
  },

  // AI Generation Metadata
  aiGenerated: {
    isAIGenerated: {
      type: Boolean,
      default: false
    },
    generatedAt: Date,
    model: String,
    tokensUsed: Number,
    generationTimeMs: Number,
    prompt: String,
    enhancedAt: Date,
    enhancementCount: {
      type: Number,
      default: 0
    }
  }

}, { timestamps: true });

// Indexes
LessonSchema.index({ language: 1, level: 1, category: 1, isPublished: 1 });
LessonSchema.index({ language: 1, 'unit.number': 1, orderInUnit: 1 });
LessonSchema.index({ tags: 1 });
LessonSchema.index({ 'aiGenerated.isAIGenerated': 1, createdAt: -1 });

// Pre-save hook for slug generation
LessonSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
      '-' + Date.now().toString(36);
  }
  next();
});

/**
 * Get lessons for a language and level
 */
LessonSchema.statics.getLessons = async function(options = {}) {
  const {
    language,
    level,
    category,
    isPremium,
    limit = 50,
    skip = 0
  } = options;

  const filter = { isPublished: true };
  if (language) filter.language = language;
  if (level) filter.level = level;
  if (category) filter.category = category;
  if (isPremium !== undefined) filter.isPremium = isPremium;

  const [lessons, total] = await Promise.all([
    this.find(filter)
      .select('-exercises.correctAnswer -exercises.acceptedAnswers')
      .sort({ 'unit.number': 1, orderInUnit: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(filter)
  ]);

  return {
    lessons,
    total,
    page: Math.floor(skip / limit) + 1,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Get lesson curriculum grouped by units
 */
LessonSchema.statics.getCurriculum = async function(language, level = null) {
  const filter = { language, isPublished: true };
  if (level) filter.level = level;

  const lessons = await this.find(filter)
    .select('title slug level category topic unit orderInUnit estimatedMinutes xpReward icon isPremium')
    .sort({ level: 1, 'unit.number': 1, orderInUnit: 1 })
    .lean();

  // Group by level and unit
  const curriculum = {};

  lessons.forEach(lesson => {
    if (!curriculum[lesson.level]) {
      curriculum[lesson.level] = { units: {} };
    }

    const unitKey = lesson.unit?.number || 0;
    if (!curriculum[lesson.level].units[unitKey]) {
      curriculum[lesson.level].units[unitKey] = {
        number: unitKey,
        name: lesson.unit?.name || `Unit ${unitKey}`,
        lessons: []
      };
    }

    curriculum[lesson.level].units[unitKey].lessons.push(lesson);
  });

  // Convert to array format
  return Object.keys(curriculum).map(level => ({
    level,
    units: Object.values(curriculum[level].units).sort((a, b) => a.number - b.number)
  }));
};

/**
 * Get recommended lessons for user
 */
LessonSchema.statics.getRecommended = async function(userId, language, level, limit = 5) {
  const LessonProgress = mongoose.model('LessonProgress');

  // Get completed lesson IDs
  const completedLessons = await LessonProgress.find({
    user: userId,
    isCompleted: true
  }).distinct('lesson');

  // Get in-progress lessons first
  const inProgressLessons = await LessonProgress.find({
    user: userId,
    isCompleted: false,
    progress: { $gt: 0 }
  })
    .populate('lesson', 'title slug level category topic icon xpReward estimatedMinutes')
    .sort({ updatedAt: -1 })
    .limit(2)
    .lean();

  const inProgressIds = inProgressLessons.map(p => p.lesson._id);
  const excludeIds = [...completedLessons, ...inProgressIds];

  // Get new lessons at user's level
  const newLessons = await this.find({
    _id: { $nin: excludeIds },
    language,
    level,
    isPublished: true
  })
    .select('title slug level category topic icon xpReward estimatedMinutes isPremium')
    .sort({ 'unit.number': 1, orderInUnit: 1 })
    .limit(limit - inProgressIds.length)
    .lean();

  return {
    inProgress: inProgressLessons.map(p => ({
      ...p.lesson,
      progress: p.progress,
      lastAttemptAt: p.updatedAt
    })),
    recommended: newLessons
  };
};

module.exports = mongoose.model('Lesson', LessonSchema);
