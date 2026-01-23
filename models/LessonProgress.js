const mongoose = require('mongoose');

/**
 * LessonProgress Model
 * Tracks user's progress on lessons
 */
const LessonProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true,
    index: true
  },

  // Progress tracking
  currentExercise: {
    type: Number,
    default: 0
  },
  totalExercises: {
    type: Number,
    required: true
  },
  progress: {
    type: Number, // 0-100
    default: 0
  },

  // Exercise answers
  answers: [{
    exerciseIndex: Number,
    answer: mongoose.Schema.Types.Mixed,
    isCorrect: Boolean,
    responseTime: Number, // ms
    attempts: {
      type: Number,
      default: 1
    },
    answeredAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Score tracking
  correctAnswers: {
    type: Number,
    default: 0
  },
  incorrectAnswers: {
    type: Number,
    default: 0
  },
  score: {
    type: Number, // 0-100
    default: 0
  },
  earnedPoints: {
    type: Number,
    default: 0
  },
  maxPoints: {
    type: Number,
    default: 0
  },

  // Time tracking
  startedAt: {
    type: Date,
    default: null
  },
  timeSpent: {
    type: Number, // seconds
    default: 0
  },

  // Completion status
  isCompleted: {
    type: Boolean,
    default: false,
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  },
  isPerfect: {
    type: Boolean,
    default: false
  },

  // XP awarded
  xpAwarded: {
    type: Number,
    default: 0
  },

  // Attempt tracking
  attemptNumber: {
    type: Number,
    default: 1
  },

  // Denormalized lesson info for queries
  lessonSlug: String,
  lessonLevel: String,
  lessonCategory: String

}, { timestamps: true });

// Compound indexes
LessonProgressSchema.index({ user: 1, lesson: 1 });
LessonProgressSchema.index({ user: 1, isCompleted: 1, completedAt: -1 });
LessonProgressSchema.index({ user: 1, lessonLevel: 1, isCompleted: 1 });
LessonProgressSchema.index({ user: 1, lessonCategory: 1, isCompleted: 1 });

/**
 * Start or resume a lesson
 */
LessonProgressSchema.statics.startLesson = async function(userId, lessonId) {
  const Lesson = mongoose.model('Lesson');
  const lesson = await Lesson.findById(lessonId);

  if (!lesson) {
    throw new Error('Lesson not found');
  }

  // Check for existing progress
  let progress = await this.findOne({ user: userId, lesson: lessonId });

  if (progress && progress.isCompleted) {
    // Create new attempt
    progress = new this({
      user: userId,
      lesson: lessonId,
      totalExercises: lesson.exercises.length,
      maxPoints: lesson.exercises.reduce((sum, ex) => sum + (ex.points || 10), 0),
      startedAt: new Date(),
      attemptNumber: progress.attemptNumber + 1,
      lessonSlug: lesson.slug,
      lessonLevel: lesson.level,
      lessonCategory: lesson.category
    });
    await progress.save();
  } else if (!progress) {
    // First attempt
    progress = await this.create({
      user: userId,
      lesson: lessonId,
      totalExercises: lesson.exercises.length,
      maxPoints: lesson.exercises.reduce((sum, ex) => sum + (ex.points || 10), 0),
      startedAt: new Date(),
      lessonSlug: lesson.slug,
      lessonLevel: lesson.level,
      lessonCategory: lesson.category
    });
  } else if (!progress.startedAt) {
    // Resume incomplete lesson
    progress.startedAt = new Date();
    await progress.save();
  }

  return {
    progress,
    lesson: {
      _id: lesson._id,
      title: lesson.title,
      introduction: lesson.introduction,
      content: lesson.content,
      exercises: lesson.exercises.map((ex, i) => ({
        ...ex.toObject(),
        index: i,
        // Hide correct answers
        correctAnswer: undefined,
        acceptedAnswers: undefined
      })),
      xpReward: lesson.xpReward,
      perfectBonus: lesson.perfectBonus
    }
  };
};

/**
 * Submit an answer for an exercise
 */
LessonProgressSchema.methods.submitAnswer = async function(exerciseIndex, answer) {
  const Lesson = mongoose.model('Lesson');
  const lesson = await Lesson.findById(this.lesson);

  if (!lesson || exerciseIndex >= lesson.exercises.length) {
    throw new Error('Invalid exercise');
  }

  const exercise = lesson.exercises[exerciseIndex];

  // Check if already answered
  const existingAnswer = this.answers.find(a => a.exerciseIndex === exerciseIndex);
  if (existingAnswer) {
    existingAnswer.attempts += 1;
    existingAnswer.answer = answer;
    existingAnswer.answeredAt = new Date();
  }

  // Check correctness
  let isCorrect = false;

  switch (exercise.type) {
    case 'multiple_choice':
      isCorrect = answer === exercise.correctAnswer;
      break;
    case 'fill_blank':
    case 'translation':
    case 'typing':
      const normalizedAnswer = answer.toString().toLowerCase().trim();
      const normalizedCorrect = exercise.correctAnswer.toString().toLowerCase().trim();
      isCorrect = normalizedAnswer === normalizedCorrect ||
                  exercise.acceptedAnswers?.some(a => a.toLowerCase().trim() === normalizedAnswer);
      break;
    case 'ordering':
      isCorrect = JSON.stringify(answer) === JSON.stringify(exercise.correctAnswer);
      break;
    case 'matching':
      isCorrect = JSON.stringify(answer.sort()) === JSON.stringify(exercise.correctAnswer.sort());
      break;
    default:
      isCorrect = answer === exercise.correctAnswer;
  }

  const points = isCorrect ? (exercise.points || 10) : 0;

  if (existingAnswer) {
    existingAnswer.isCorrect = isCorrect;
  } else {
    this.answers.push({
      exerciseIndex,
      answer,
      isCorrect,
      responseTime: 0,
      attempts: 1
    });
  }

  // Update scores
  if (isCorrect) {
    if (!existingAnswer || !existingAnswer.isCorrect) {
      this.correctAnswers += 1;
      this.earnedPoints += points;
    }
  } else {
    if (!existingAnswer) {
      this.incorrectAnswers += 1;
    }
  }

  // Update progress
  this.currentExercise = exerciseIndex + 1;
  this.progress = Math.floor((this.answers.length / this.totalExercises) * 100);
  this.score = Math.floor((this.earnedPoints / this.maxPoints) * 100);

  await this.save();

  return {
    isCorrect,
    correctAnswer: exercise.correctAnswer,
    explanation: exercise.explanation,
    points: isCorrect ? points : 0,
    progress: this.progress,
    score: this.score,
    currentExercise: this.currentExercise,
    totalExercises: this.totalExercises
  };
};

/**
 * Complete the lesson
 */
LessonProgressSchema.methods.completeLesson = async function() {
  const Lesson = mongoose.model('Lesson');
  const lesson = await Lesson.findById(this.lesson);

  if (!lesson) {
    throw new Error('Lesson not found');
  }

  // Calculate final score
  this.score = Math.floor((this.earnedPoints / this.maxPoints) * 100);
  this.isPerfect = this.score === 100;
  this.isCompleted = true;
  this.completedAt = new Date();

  // Calculate time spent
  if (this.startedAt) {
    this.timeSpent = Math.floor((new Date() - this.startedAt) / 1000);
  }

  // Calculate XP
  let xp = lesson.xpReward;
  if (this.isPerfect) {
    xp += lesson.perfectBonus;
  }
  this.xpAwarded = xp;

  await this.save();

  // Update lesson stats
  await Lesson.updateOne(
    { _id: this.lesson },
    {
      $inc: { 'stats.totalCompletions': 1 },
      $set: {
        'stats.averageScore': await this.constructor.getAverageScore(this.lesson),
        'stats.averageTime': await this.constructor.getAverageTime(this.lesson)
      }
    }
  );

  return {
    score: this.score,
    isPerfect: this.isPerfect,
    xpAwarded: this.xpAwarded,
    timeSpent: this.timeSpent,
    correctAnswers: this.correctAnswers,
    incorrectAnswers: this.incorrectAnswers
  };
};

/**
 * Get user's lesson history
 */
LessonProgressSchema.statics.getUserHistory = async function(userId, options = {}) {
  const { level, category, completed, limit = 50, skip = 0 } = options;

  const filter = { user: new mongoose.Types.ObjectId(userId) };
  if (level) filter.lessonLevel = level;
  if (category) filter.lessonCategory = category;
  if (completed !== undefined) filter.isCompleted = completed;

  return this.aggregate([
    { $match: filter },
    { $sort: { updatedAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'lessons',
        localField: 'lesson',
        foreignField: '_id',
        as: 'lessonDetails'
      }
    },
    { $unwind: '$lessonDetails' },
    {
      $project: {
        _id: 1,
        progress: 1,
        score: 1,
        isCompleted: 1,
        isPerfect: 1,
        completedAt: 1,
        xpAwarded: 1,
        timeSpent: 1,
        attemptNumber: 1,
        lesson: {
          _id: '$lessonDetails._id',
          title: '$lessonDetails.title',
          slug: '$lessonDetails.slug',
          level: '$lessonDetails.level',
          category: '$lessonDetails.category',
          topic: '$lessonDetails.topic',
          icon: '$lessonDetails.icon'
        }
      }
    }
  ]);
};

/**
 * Get statistics by level
 */
LessonProgressSchema.statics.getStatsByLevel = async function(userId) {
  return this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        isCompleted: true
      }
    },
    {
      $group: {
        _id: '$lessonLevel',
        completed: { $sum: 1 },
        averageScore: { $avg: '$score' },
        totalXP: { $sum: '$xpAwarded' },
        perfectCount: { $sum: { $cond: ['$isPerfect', 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

/**
 * Get average score for a lesson
 */
LessonProgressSchema.statics.getAverageScore = async function(lessonId) {
  const [result] = await this.aggregate([
    { $match: { lesson: new mongoose.Types.ObjectId(lessonId), isCompleted: true } },
    { $group: { _id: null, avg: { $avg: '$score' } } }
  ]);
  return result?.avg || 0;
};

/**
 * Get average time for a lesson
 */
LessonProgressSchema.statics.getAverageTime = async function(lessonId) {
  const [result] = await this.aggregate([
    { $match: { lesson: new mongoose.Types.ObjectId(lessonId), isCompleted: true } },
    { $group: { _id: null, avg: { $avg: '$timeSpent' } } }
  ]);
  return result?.avg || 0;
};

module.exports = mongoose.model('LessonProgress', LessonProgressSchema);
