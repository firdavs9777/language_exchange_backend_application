const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const LearningProgress = require('../models/LearningProgress');
const Vocabulary = require('../models/Vocabulary');
const VocabPack = require('../models/VocabPack');
const Lesson = require('../models/Lesson');
const LessonProgress = require('../models/LessonProgress');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Challenge = require('../models/Challenge');
const ChallengeProgress = require('../models/ChallengeProgress');
const Achievement = require('../models/Achievement');
const UserAchievement = require('../models/UserAchievement');
const ConversationActivity = require('../models/ConversationActivity');
const User = require('../models/User');
const { DAILY_GOALS, calculateLevel, levelProgress, xpForLevel } = require('../config/xpRewards');
const learningTrackingService = require('../services/learningTrackingService');
const recommendationService = require('../services/recommendationService');
const aiQuizService = require('../services/aiQuizService');
const aiLessonAssistantService = require('../services/aiLessonAssistantService');
const { chatCompletion } = require('../services/aiProviderService');

// ===================== PROGRESS =====================

/**
 * @desc    Get user's learning progress/dashboard
 * @route   GET /api/v1/learning/progress
 * @access  Private
 */
exports.getProgress = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  let progress = await LearningProgress.findOne({ user: userId });

  if (!progress) {
    // Initialize progress for new user
    const user = await User.findById(userId).select('language_to_learn');
    progress = await LearningProgress.create({
      user: userId,
      targetLanguage: user?.language_to_learn || 'en'
    });
  }

  // Get additional data
  const [dailySummary, weeklySummary, vocabularyStats] = await Promise.all([
    ConversationActivity.getDailySummary(userId),
    ConversationActivity.getWeeklySummary(userId),
    Vocabulary.getReviewStats(userId)
  ]);

  res.status(200).json({
    success: true,
    data: {
      level: progress.level,
      totalXP: progress.totalXP,
      weeklyXP: progress.weeklyXP,
      dailyXP: progress.dailyXP,
      xpToNextLevel: progress.xpToNextLevel,
      levelProgressPercent: progress.levelProgressPercent,
      currentStreak: progress.currentStreak,
      longestStreak: progress.longestStreak,
      streakFreezes: progress.streakFreezes,
      dailyGoal: progress.dailyGoal,
      dailyGoalProgress: progress.dailyGoalProgress,
      dailyGoalTarget: DAILY_GOALS[progress.dailyGoal]?.xpTarget || 30,
      proficiencyLevel: progress.proficiencyLevel,
      placementTestTaken: progress.placementTestTaken,
      stats: progress.stats,
      preferences: progress.preferences,
      dailySummary,
      weeklySummary,
      vocabularyStats
    }
  });
});

/**
 * @desc    Get leaderboard
 * @route   GET /api/v1/learning/progress/leaderboard
 * @access  Private
 */
exports.getLeaderboard = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { type = 'weekly', language, limit = 50, page = 1 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [leaderboard, userRank] = await Promise.all([
    LearningProgress.getLeaderboard(language, type, parseInt(limit), skip),
    LearningProgress.getUserRank(userId, language, type)
  ]);

  res.status(200).json({
    success: true,
    data: {
      leaderboard,
      userRank,
      type,
      language
    }
  });
});

/**
 * @desc    Update daily goal
 * @route   PUT /api/v1/learning/progress/daily-goal
 * @access  Private
 */
exports.updateDailyGoal = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { dailyGoal } = req.body;

  if (!DAILY_GOALS[dailyGoal]) {
    return next(new ErrorResponse('Invalid daily goal', 400));
  }

  const progress = await LearningProgress.findOneAndUpdate(
    { user: userId },
    { dailyGoal },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: {
      dailyGoal: progress.dailyGoal,
      dailyGoalTarget: DAILY_GOALS[dailyGoal].xpTarget
    }
  });
});

/**
 * @desc    Update learning preferences
 * @route   PUT /api/v1/learning/progress/preferences
 * @access  Private
 */
exports.updatePreferences = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { preferences } = req.body;

  const allowedFields = ['reminderEnabled', 'reminderTime', 'soundEffects', 'showStreakReminders', 'weeklyReportEnabled'];
  const updateFields = {};

  for (const field of allowedFields) {
    if (preferences[field] !== undefined) {
      updateFields[`preferences.${field}`] = preferences[field];
    }
  }

  const progress = await LearningProgress.findOneAndUpdate(
    { user: userId },
    { $set: updateFields },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: { preferences: progress.preferences }
  });
});

// ===================== VOCABULARY =====================

/**
 * @desc    Get user's vocabulary
 * @route   GET /api/v1/learning/vocabulary
 * @access  Private
 */
exports.getVocabulary = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { query, language, tags, srsLevel, isMastered, isFavorite, limit = 50, page = 1, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const result = await Vocabulary.searchVocabulary(userId, query, {
    language,
    tags: tags ? tags.split(',') : null,
    srsLevel: srsLevel !== undefined ? parseInt(srsLevel) : undefined,
    isMastered: isMastered !== undefined ? isMastered === 'true' : undefined,
    isFavorite: isFavorite !== undefined ? isFavorite === 'true' : undefined,
    limit: parseInt(limit),
    skip: (parseInt(page) - 1) * parseInt(limit),
    sortBy,
    sortOrder: sortOrder === 'asc' ? 1 : -1
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Add vocabulary word
 * @route   POST /api/v1/learning/vocabulary
 * @access  Private
 */
exports.addVocabulary = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { word, translation, language, partOfSpeech, examples, pronunciation, notes, tags, context } = req.body;

  if (!word || !translation) {
    return next(new ErrorResponse('Word and translation are required', 400));
  }

  const user = await User.findById(userId).select('language_to_learn native_language');

  const vocabulary = await Vocabulary.findOneAndUpdate(
    { user: userId, word },
    {
      $setOnInsert: {
        user: userId,
        word,
        translation,
        language: language || user.language_to_learn,
        nativeLanguage: user.native_language,
        partOfSpeech,
        examples,
        pronunciation,
        notes,
        tags,
        context,
        srsLevel: 0,
        easeFactor: 2.5,
        interval: 0,
        nextReview: new Date(),
        isArchived: false,
        isMastered: false,
      },
    },
    { upsert: true, new: true }
  );

  // Track for XP
  await learningTrackingService.awardXP(userId, 2, 'add_vocabulary');

  // Update stats
  await LearningProgress.updateOne(
    { user: userId },
    { $inc: { 'stats.vocabularyAdded': 1 } }
  );

  res.status(201).json({
    success: true,
    data: vocabulary
  });
});

// ===================== VOCAB PACKS =====================

/**
 * @desc    List curated vocab packs (lightweight — no word bodies)
 * @route   GET /api/v1/learning/vocab-packs
 * @access  Private
 * @query   level=intermediate|advanced (optional), language (optional, default English)
 */
exports.getVocabPacks = asyncHandler(async (req, res, next) => {
  const { level, language } = req.query;
  const filter = { isActive: true };
  if (level) {
    if (!['intermediate', 'advanced'].includes(level)) {
      return next(new ErrorResponse('level must be intermediate or advanced', 400));
    }
    filter.level = level;
  }
  if (language) filter.language = language;

  const packs = await VocabPack.find(filter)
    .select('level topic language words exercises updatedAt')
    .sort({ level: 1, topic: 1 })
    .lean();

  const data = packs.map((p) => ({
    id: p._id,
    level: p.level,
    topic: p.topic,
    language: p.language,
    wordCount: Array.isArray(p.words) ? p.words.length : 0,
    exerciseCount: Array.isArray(p.exercises) ? p.exercises.length : 0,
    updatedAt: p.updatedAt,
  }));

  res.status(200).json({ success: true, count: data.length, data });
});

/**
 * @desc    Get a single vocab pack with full words + exercises
 * @route   GET /api/v1/learning/vocab-packs/:id
 * @access  Private
 */
exports.getVocabPack = asyncHandler(async (req, res, next) => {
  const pack = await VocabPack.findOne({ _id: req.params.id, isActive: true }).lean();
  if (!pack) {
    return next(new ErrorResponse('Vocab pack not found', 404));
  }
  res.status(200).json({ success: true, data: pack });
});

/**
 * @desc    Bulk-add a pack's words into the user's personal Vocabulary
 * @route   POST /api/v1/learning/vocab-packs/:id/add
 * @access  Private
 */
exports.addVocabPackToVocabulary = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const pack = await VocabPack.findOne({ _id: req.params.id, isActive: true }).lean();
  if (!pack) {
    return next(new ErrorResponse('Vocab pack not found', 404));
  }

  const user = await User.findById(userId).select('native_language');
  const nativeLanguage = user ? user.native_language : undefined;

  // Upsert each word — never clobber an existing personal entry (setOnInsert),
  // so re-adding a pack is idempotent and won't reset a user's SRS progress.
  const now = new Date();
  const ops = pack.words.map((w) => ({
    updateOne: {
      filter: { user: userId, word: w.word },
      update: {
        $setOnInsert: {
          user: userId,
          word: w.word,
          translation: w.translationHint || w.definition,
          language: pack.language || 'English',
          nativeLanguage,
          notes: w.definition,
          examples: w.example ? [{ sentence: w.example }] : [],
          context: { source: 'vocab_pack' },
          srsLevel: 0,
          easeFactor: 2.5,
          interval: 0,
          nextReview: now,
          isArchived: false,
          isMastered: false,
        },
      },
      upsert: true,
    },
  }));

  const result = await Vocabulary.bulkWrite(ops, { ordered: false });
  const added = result.upsertedCount || 0;

  if (added > 0) {
    await learningTrackingService.awardXP(userId, added * 2, 'add_vocab_pack');
    await LearningProgress.updateOne(
      { user: userId },
      { $inc: { 'stats.vocabularyAdded': added } }
    );
  }

  res.status(201).json({
    success: true,
    data: {
      packId: pack._id,
      topic: pack.topic,
      level: pack.level,
      totalWords: pack.words.length,
      added,
      alreadyHad: pack.words.length - added,
    },
  });
});

/**
 * @desc    Get vocabulary due for review
 * @route   GET /api/v1/learning/vocabulary/review
 * @access  Private
 */
exports.getVocabularyReview = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { limit = 20 } = req.query;

  const [dueWords, stats, forecast] = await Promise.all([
    Vocabulary.getDueForReview(userId, parseInt(limit)),
    Vocabulary.getReviewStats(userId),
    Vocabulary.getReviewForecast(userId)
  ]);

  res.status(200).json({
    success: true,
    data: {
      words: dueWords,
      stats,
      forecast
    }
  });
});

/**
 * @desc    Submit vocabulary review
 * @route   POST /api/v1/learning/vocabulary/:id/review
 * @access  Private
 */
exports.submitVocabularyReview = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const vocabularyId = req.params.id;
  const { quality, responseTime } = req.body;

  if (quality === undefined || quality < 0 || quality > 5) {
    return next(new ErrorResponse('Quality must be between 0 and 5', 400));
  }

  const vocabulary = await Vocabulary.findOne({ _id: vocabularyId, user: userId });

  if (!vocabulary) {
    return next(new ErrorResponse('Vocabulary not found', 404));
  }

  const result = await vocabulary.processReview(quality, responseTime);

  // Track for XP
  await learningTrackingService.trackVocabularyReview({
    userId,
    vocabularyId,
    correct: result.wasCorrect,
    isMastered: result.justMastered
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Update vocabulary word
 * @route   PUT /api/v1/learning/vocabulary/:id
 * @access  Private
 */
exports.updateVocabulary = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const vocabularyId = req.params.id;

  const allowedFields = ['translation', 'partOfSpeech', 'examples', 'pronunciation', 'notes', 'tags', 'isFavorite'];
  const updateFields = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateFields[field] = req.body[field];
    }
  }

  const vocabulary = await Vocabulary.findOneAndUpdate(
    { _id: vocabularyId, user: userId },
    updateFields,
    { new: true }
  );

  if (!vocabulary) {
    return next(new ErrorResponse('Vocabulary not found', 404));
  }

  res.status(200).json({
    success: true,
    data: vocabulary
  });
});

/**
 * @desc    Delete vocabulary word
 * @route   DELETE /api/v1/learning/vocabulary/:id
 * @access  Private
 */
exports.deleteVocabulary = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const vocabularyId = req.params.id;

  const vocabulary = await Vocabulary.findOneAndUpdate(
    { _id: vocabularyId, user: userId },
    { isArchived: true, archivedAt: new Date() },
    { new: true }
  );

  if (!vocabulary) {
    return next(new ErrorResponse('Vocabulary not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Get vocabulary statistics
 * @route   GET /api/v1/learning/vocabulary/stats
 * @access  Private
 */
exports.getVocabularyStats = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const [reviewStats, srsDistribution, recentActivity] = await Promise.all([
    Vocabulary.getReviewStats(userId),
    Vocabulary.getSrsDistribution(userId),
    Vocabulary.aggregate([
      {
        $match: {
          user: new (require('mongoose').Types.ObjectId)(userId),
          isArchived: false
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          wordsAdded: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 7 }
    ])
  ]);

  // Calculate streak (consecutive days with reviews)
  const reviewHistory = await Vocabulary.aggregate([
    {
      $match: {
        user: new (require('mongoose').Types.ObjectId)(userId),
        lastReviewed: { $ne: null },
        isArchived: false
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$lastReviewed' }
        },
        reviews: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } },
    { $limit: 30 }
  ]);

  // Calculate current streak
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (reviewHistory.length > 0) {
    const lastReviewDate = reviewHistory[0]._id;
    if (lastReviewDate === today || lastReviewDate === yesterday) {
      streak = 1;
      for (let i = 1; i < reviewHistory.length; i++) {
        const currentDate = new Date(reviewHistory[i - 1]._id);
        const prevDate = new Date(reviewHistory[i]._id);
        const diffDays = Math.round((currentDate - prevDate) / 86400000);
        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }
    }
  }

  // Format SRS distribution for frontend
  const srsLevels = {
    new: 0,
    learning: 0,
    review: 0,
    mastered: 0
  };

  srsDistribution.forEach(item => {
    if (item._id === 0) srsLevels.new = item.count;
    else if (item._id >= 1 && item._id <= 3) srsLevels.learning += item.count;
    else if (item._id >= 4 && item._id <= 7) srsLevels.review += item.count;
    else if (item._id >= 8) srsLevels.mastered += item.count;
  });

  res.status(200).json({
    success: true,
    data: {
      total: reviewStats?.total || 0,
      mastered: reviewStats?.mastered || 0,
      learning: reviewStats?.learning || 0,
      new: reviewStats?.new || 0,
      dueNow: reviewStats?.dueNow || 0,
      dueToday: reviewStats?.dueToday || 0,
      reviewAccuracy: reviewStats?.reviewAccuracy || 0,
      averageEase: reviewStats?.averageEase || 2.5,
      srsDistribution: srsLevels,
      recentActivity: recentActivity.reverse(),
      streak,
      lastReviewDate: reviewHistory[0]?._id || null
    }
  });
});

// ===================== LESSONS =====================

/**
 * @desc    Get lesson curriculum
 * @route   GET /api/v1/learning/lessons
 * @access  Private
 */
exports.getLessons = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { language, sourceLanguage, level, category, page = 1, limit = 50 } = req.query;

  const user = await User.findById(userId).select('language_to_learn native_language');
  const targetLanguage = language || user?.language_to_learn;
  const nativeLanguage = sourceLanguage || user?.native_language;

  const result = await Lesson.getLessons({
    language: targetLanguage,
    sourceLanguage: nativeLanguage,
    level,
    category,
    limit: parseInt(limit),
    skip: (parseInt(page) - 1) * parseInt(limit)
  });

  // Get user's progress for these lessons
  const lessonIds = result.lessons.map(l => l._id);
  const progressMap = {};

  const userProgress = await LessonProgress.find({
    user: userId,
    lesson: { $in: lessonIds }
  }).lean();

  userProgress.forEach(p => {
    progressMap[p.lesson.toString()] = {
      progress: p.progress,
      isCompleted: p.isCompleted,
      score: p.score
    };
  });

  // Attach progress to lessons
  result.lessons = result.lessons.map(lesson => ({
    ...lesson,
    userProgress: progressMap[lesson._id.toString()] || null
  }));

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get recommended lessons
 * @route   GET /api/v1/learning/lessons/recommended
 * @access  Private
 */
exports.getRecommendedLessons = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { language, sourceLanguage } = req.query;

  const user = await User.findById(userId).select('language_to_learn native_language languageLevel');
  const targetLanguage = language || user?.language_to_learn;
  const nativeLanguage = sourceLanguage || user?.native_language;
  const userLevel = user?.languageLevel || 'A1';

  const recommended = await Lesson.getRecommended(userId, targetLanguage, userLevel, 5, nativeLanguage);

  res.status(200).json({
    success: true,
    data: recommended
  });
});

/**
 * @desc    Get lesson curriculum grouped by units
 * @route   GET /api/v1/learning/lessons/curriculum
 * @access  Private
 */
exports.getCurriculum = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { language, sourceLanguage, level } = req.query;

  const user = await User.findById(userId).select('language_to_learn native_language');
  const targetLanguage = language || user?.language_to_learn;
  const nativeLanguage = sourceLanguage || user?.native_language;

  const curriculum = await Lesson.getCurriculum(targetLanguage, level, nativeLanguage);

  res.status(200).json({
    success: true,
    data: curriculum
  });
});

/**
 * @desc    Start a lesson
 * @route   POST /api/v1/learning/lessons/:id/start
 * @access  Private
 */
exports.startLesson = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const lessonId = req.params.id;

  const result = await LessonProgress.startLesson(userId, lessonId);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Submit lesson answer
 * @route   POST /api/v1/learning/lessons/:id/answer
 * @access  Private
 */
exports.submitLessonAnswer = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const lessonId = req.params.id;
  const { exerciseIndex, answer } = req.body;

  const progress = await LessonProgress.findOne({
    user: userId,
    lesson: lessonId,
    isCompleted: false
  });

  if (!progress) {
    return next(new ErrorResponse('Lesson progress not found', 404));
  }

  const result = await progress.submitAnswer(exerciseIndex, answer);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Complete a lesson
 * @route   POST /api/v1/learning/lessons/:id/complete
 * @access  Private
 */
exports.completeLesson = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const lessonId = req.params.id;

  const progress = await LessonProgress.findOne({
    user: userId,
    lesson: lessonId,
    isCompleted: false
  });

  if (!progress) {
    return next(new ErrorResponse('Lesson progress not found', 404));
  }

  const result = await progress.completeLesson();

  // Track for XP and stats
  await learningTrackingService.trackLessonCompletion({
    userId,
    lessonId,
    score: result.score,
    isPerfect: result.isPerfect
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

// ===================== QUIZZES =====================

/**
 * @desc    Get available quizzes
 * @route   GET /api/v1/learning/quizzes
 * @access  Private
 */
exports.getQuizzes = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { language, type, level } = req.query;

  const user = await User.findById(userId).select('language_to_learn');
  const targetLanguage = language || user?.language_to_learn;

  const quizzes = await Quiz.getQuizzes({
    language: targetLanguage,
    type,
    level
  });

  // Get user's best attempts for each quiz
  const quizIds = quizzes.map(q => q._id);
  const bestAttempts = await QuizAttempt.find({
    user: userId,
    quiz: { $in: quizIds },
    status: 'completed'
  })
    .sort({ score: -1 })
    .lean();

  const bestAttemptsMap = {};
  bestAttempts.forEach(a => {
    if (!bestAttemptsMap[a.quiz.toString()]) {
      bestAttemptsMap[a.quiz.toString()] = a;
    }
  });

  const quizzesWithProgress = quizzes.map(quiz => ({
    ...quiz,
    bestAttempt: bestAttemptsMap[quiz._id.toString()] || null
  }));

  res.status(200).json({
    success: true,
    data: quizzesWithProgress
  });
});

/**
 * @desc    Start a quiz
 * @route   POST /api/v1/learning/quizzes/:id/start
 * @access  Private
 */
exports.startQuiz = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const quizId = req.params.id;

  const result = await QuizAttempt.startAttempt(userId, quizId);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Submit quiz answer
 * @route   POST /api/v1/learning/quizzes/:id/answer
 * @access  Private
 */
exports.submitQuizAnswer = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const quizId = req.params.id;
  const { questionIndex, answer, responseTime } = req.body;

  const attempt = await QuizAttempt.findOne({
    user: userId,
    quiz: quizId,
    status: 'in_progress'
  });

  if (!attempt) {
    return next(new ErrorResponse('Quiz attempt not found', 404));
  }

  const result = await attempt.submitAnswer(questionIndex, answer, responseTime);

  // Best-effort: bump TutorMemory.weakAreas when the user got it wrong, using
  // the quiz's category as the topic. Fire-and-forget; never blocks the
  // response.
  if (result && result.isCorrect === false) {
    (async () => {
      try {
        const TutorMemory = require('../models/TutorMemory');
        const Quiz = require('../models/Quiz');
        const quizDoc = await Quiz.findById(quizId).select('category').lean();
        const topic = (quizDoc?.category || 'quiz').toString().trim();
        const upd = await TutorMemory.updateOne(
          { user: userId, 'weakAreas.topic': topic },
          { $inc: { 'weakAreas.$.frequency': 1 }, $set: { 'weakAreas.$.lastSeen': new Date() } }
        );
        if (upd.matchedCount === 0) {
          await TutorMemory.updateOne(
            { user: userId },
            {
              $push: {
                weakAreas: { $each: [{ topic, frequency: 1, lastSeen: new Date() }], $slice: -10 },
              },
            },
            { upsert: true }
          );
        }
      } catch (e) {
        console.error('[tutor-memory] weakArea update failed (quiz):', e.message);
      }
    })();
  }

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Complete a quiz
 * @route   POST /api/v1/learning/quizzes/:id/complete
 * @access  Private
 */
exports.completeQuiz = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const quizId = req.params.id;

  const attempt = await QuizAttempt.findOne({
    user: userId,
    quiz: quizId,
    status: 'in_progress'
  });

  if (!attempt) {
    return next(new ErrorResponse('Quiz attempt not found', 404));
  }

  const result = await attempt.completeQuiz();

  // Track for XP
  await learningTrackingService.trackQuizCompletion({
    userId,
    quizId,
    score: result.score,
    isPerfect: result.isPerfect,
    isPlacementTest: attempt.quizType === 'placement'
  });

  // Update proficiency level if placement test
  if (result.determinedLevel) {
    await LearningProgress.updateOne(
      { user: userId },
      {
        $set: {
          proficiencyLevel: result.determinedLevel,
          placementTestTaken: true,
          placementTestScore: result.score,
          placementTestDate: new Date()
        }
      }
    );
  }

  res.status(200).json({
    success: true,
    data: result
  });
});

// ===================== CHALLENGES =====================

/**
 * @desc    Get active challenges
 * @route   GET /api/v1/learning/challenges
 * @access  Private
 */
exports.getChallenges = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { type } = req.query;

  // Initialize user's challenges if needed
  const challenges = await ChallengeProgress.initializeUserChallenges(userId);

  // Filter by type if specified
  const filteredChallenges = type
    ? challenges.filter(c => c.challengeType === type)
    : challenges;

  res.status(200).json({
    success: true,
    data: filteredChallenges
  });
});

/**
 * @desc    Get challenge statistics
 * @route   GET /api/v1/learning/challenges/stats
 * @access  Private
 */
exports.getChallengeStats = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const stats = await ChallengeProgress.getStats(userId);

  res.status(200).json({
    success: true,
    data: stats
  });
});

// ===================== ACHIEVEMENTS =====================

/**
 * @desc    Get user's achievements
 * @route   GET /api/v1/learning/achievements
 * @access  Private
 */
exports.getAchievements = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { category, unlockedOnly } = req.query;

  const achievements = await UserAchievement.getUserAchievements(userId, {
    category,
    unlockedOnly: unlockedOnly === 'true'
  });

  const stats = await UserAchievement.getStats(userId);

  res.status(200).json({
    success: true,
    data: {
      achievements,
      stats
    }
  });
});

/**
 * @desc    Get unseen achievement notifications
 * @route   GET /api/v1/learning/achievements/unseen
 * @access  Private
 */
exports.getUnseenAchievements = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const unseen = await UserAchievement.getUnseenAchievements(userId);

  res.status(200).json({
    success: true,
    data: unseen
  });
});

/**
 * @desc    Mark achievements as seen
 * @route   POST /api/v1/learning/achievements/seen
 * @access  Private
 */
exports.markAchievementsSeen = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { achievementIds } = req.body;

  await UserAchievement.markAsSeen(userId, achievementIds);

  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Set featured achievements
 * @route   PUT /api/v1/learning/achievements/featured
 * @access  Private
 */
exports.setFeaturedAchievements = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { achievementIds } = req.body;

  if (!achievementIds || achievementIds.length > 3) {
    return next(new ErrorResponse('Select up to 3 achievements to feature', 400));
  }

  // Clear all featured
  await UserAchievement.updateMany(
    { user: userId },
    { $set: { isFeatured: false } }
  );

  // Set new featured
  await UserAchievement.updateMany(
    {
      user: userId,
      _id: { $in: achievementIds },
      isUnlocked: true
    },
    { $set: { isFeatured: true } }
  );

  const featured = await UserAchievement.getFeaturedAchievements(userId);

  res.status(200).json({
    success: true,
    data: featured
  });
});

// ===================== ACTIVITY =====================

/**
 * @desc    Get conversation activity summary
 * @route   GET /api/v1/learning/activity
 * @access  Private
 */
exports.getActivitySummary = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { days = 7 } = req.query;

  const [dailySummary, weeklySummary, partnerStats, languageUsage] = await Promise.all([
    ConversationActivity.getDailySummary(userId),
    ConversationActivity.getWeeklySummary(userId),
    ConversationActivity.getPartnerStats(userId, 5),
    ConversationActivity.getLanguageUsage(userId, parseInt(days))
  ]);

  res.status(200).json({
    success: true,
    data: {
      today: dailySummary,
      thisWeek: weeklySummary,
      topPartners: partnerStats,
      languageUsage
    }
  });
});

// ===================== AI RECOMMENDATIONS =====================

/**
 * @desc    Get AI-powered adaptive lesson recommendations
 * @route   GET /api/v1/learning/recommendations/adaptive
 * @access  Private
 */
exports.getAdaptiveRecommendations = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { language, limit = 10, refresh = 'false' } = req.query;

  const result = await recommendationService.getAdaptiveRecommendations(userId, {
    language,
    limit: parseInt(limit),
    forceRefresh: refresh === 'true'
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Refresh recommendations
 * @route   POST /api/v1/learning/recommendations/refresh
 * @access  Private
 */
exports.refreshRecommendations = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { language } = req.body;

  await recommendationService.invalidateRecommendations(userId);

  const result = await recommendationService.getAdaptiveRecommendations(userId, {
    language,
    forceRefresh: true
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get user's weak areas
 * @route   GET /api/v1/learning/progress/weak-areas
 * @access  Private
 */
exports.getWeakAreas = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const weakAreas = await recommendationService.getWeakAreas(userId);

  res.status(200).json({
    success: true,
    data: { weakAreas }
  });
});

// ===================== AI QUIZZES =====================

/**
 * @desc    Generate AI practice quiz
 * @route   POST /api/v1/learning/quizzes/generate
 * @access  Private
 */
exports.generateAIQuiz = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const {
    type = 'weak_areas',
    questionCount = 10,
    difficulty = 'adaptive',
    focusAreas,
    vocabularyIds,
    language
  } = req.body;

  const result = await aiQuizService.generatePracticeQuiz(userId, {
    type,
    questionCount,
    difficulty,
    focusAreas,
    vocabularyIds,
    language
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get user's AI-generated quizzes
 * @route   GET /api/v1/learning/quizzes/ai
 * @access  Private
 */
exports.getAIQuizzes = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { limit = 5 } = req.query;

  const quizzes = await aiQuizService.getPendingQuizzes(userId, parseInt(limit));

  res.status(200).json({
    success: true,
    data: quizzes
  });
});

/**
 * @desc    Start AI quiz
 * @route   POST /api/v1/learning/quizzes/ai/:id/start
 * @access  Private
 */
exports.startAIQuiz = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const quizId = req.params.id;

  const result = await aiQuizService.startQuiz(quizId, userId);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Submit answer for AI quiz
 * @route   POST /api/v1/learning/quizzes/ai/:id/answer
 * @access  Private
 */
exports.submitAIQuizAnswer = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const quizId = req.params.id;
  const { questionIndex, answer } = req.body;

  const result = await aiQuizService.submitAnswer(quizId, userId, questionIndex, answer);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Complete AI quiz
 * @route   POST /api/v1/learning/quizzes/ai/:id/complete
 * @access  Private
 */
exports.completeAIQuiz = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const quizId = req.params.id;
  const { answers, timeSpent } = req.body;

  const result = await aiQuizService.completeQuiz(quizId, userId, answers, timeSpent);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get AI quiz stats
 * @route   GET /api/v1/learning/quizzes/ai/stats
 * @access  Private
 */
exports.getAIQuizStats = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const stats = await aiQuizService.getUserStats(userId);

  res.status(200).json({
    success: true,
    data: stats
  });
});

// ===================== AI LESSON ASSISTANT =====================

/**
 * @desc    Get AI hint for an exercise
 * @route   POST /api/v1/learning/lessons/:id/assistant/hint
 * @access  Private
 */
exports.getExerciseHint = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const lessonId = req.params.id;
  const { exerciseIndex, hintLevel = 1 } = req.body;

  if (exerciseIndex === undefined) {
    return next(new ErrorResponse('Exercise index is required', 400));
  }

  const result = await aiLessonAssistantService.getExerciseHint(
    userId,
    lessonId,
    exerciseIndex,
    Math.min(Math.max(hintLevel, 1), 3)
  );

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Explain a concept from the lesson
 * @route   POST /api/v1/learning/lessons/:id/assistant/explain
 * @access  Private
 */
exports.explainConcept = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const lessonId = req.params.id;
  const { concept, context } = req.body;

  if (!concept) {
    return next(new ErrorResponse('Concept is required', 400));
  }

  const result = await aiLessonAssistantService.explainConcept(
    userId,
    lessonId,
    concept,
    context
  );

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get feedback on wrong answer
 * @route   POST /api/v1/learning/lessons/:id/assistant/feedback
 * @access  Private
 */
exports.getAnswerFeedback = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const lessonId = req.params.id;
  const { exerciseIndex, userAnswer } = req.body;

  if (exerciseIndex === undefined || userAnswer === undefined) {
    return next(new ErrorResponse('Exercise index and user answer are required', 400));
  }

  const result = await aiLessonAssistantService.getAnswerFeedback(
    userId,
    lessonId,
    exerciseIndex,
    userAnswer
  );

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get translation help
 * @route   POST /api/v1/learning/assistant/translate
 * @access  Private
 */
exports.getTranslationHelp = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { text, sourceLanguage, targetLanguage, context } = req.body;

  if (!text || !sourceLanguage || !targetLanguage) {
    return next(new ErrorResponse('Text, source language, and target language are required', 400));
  }

  const result = await aiLessonAssistantService.getTranslationHelp(
    userId,
    text,
    sourceLanguage,
    targetLanguage,
    context
  );

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Ask AI assistant a question about the lesson
 * @route   POST /api/v1/learning/lessons/:id/assistant/ask
 * @access  Private
 */
exports.askAssistant = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const lessonId = req.params.id;
  const { question } = req.body;

  if (!question) {
    return next(new ErrorResponse('Question is required', 400));
  }

  const result = await aiLessonAssistantService.askQuestion(
    userId,
    lessonId,
    question
  );

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Generate practice variations for an exercise
 * @route   POST /api/v1/learning/lessons/:id/assistant/practice
 * @access  Private
 */
exports.generatePractice = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const lessonId = req.params.id;
  const { exerciseIndex, count = 3 } = req.body;

  if (exerciseIndex === undefined) {
    return next(new ErrorResponse('Exercise index is required', 400));
  }

  const result = await aiLessonAssistantService.generatePracticeVariations(
    userId,
    lessonId,
    exerciseIndex,
    Math.min(count, 5)
  );

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Use a streak freeze
// @route   POST /api/v1/learning/progress/use-freeze
// @access  Private
exports.useStreakFreeze = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  let progress = await LearningProgress.findOne({ user: userId });

  if (!progress) {
    return next(new ErrorResponse('No progress record found', 404));
  }

  if ((progress.streakFreezes || 0) <= 0) {
    return next(new ErrorResponse('No streak freezes available', 400));
  }

  const used = await progress.useStreakFreeze();

  if (!used) {
    return next(new ErrorResponse('Freeze already used today or none available', 400));
  }

  res.status(200).json({ success: true, data: progress });
});

/**
 * @desc    Get AI-generated lesson summary
 * @route   GET /api/v1/learning/lessons/:id/assistant/summary
 * @access  Private
 */
exports.getLessonSummary = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const lessonId = req.params.id;

  const result = await aiLessonAssistantService.getLessonSummary(userId, lessonId);

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Get last-7-day digest of learning activity
// @route   GET /api/v1/learning/weekly-digest
// @access  Private
exports.getWeeklyDigest = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const language = req.query.language || req.user.targetLanguage || null;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  // Find learning progress (per-language if specified)
  const progressQuery = { user: userId };
  if (language) progressQuery.targetLanguage = language;
  const progress = await LearningProgress.findOne(progressQuery);

  if (!progress) {
    return res.status(200).json({
      success: true,
      data: {
        weekStart: weekStart.toISOString(),
        weekEnd: now.toISOString(),
        xpEarned: 0,
        lessonsCompleted: 0,
        vocabularyLearned: 0,
        challengesCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        topAchievement: null,
        daysActive: 0,
      },
    });
  }

  // XP earned this week (rolling weeklyXP counter)
  const xpEarned = progress.weeklyXP || 0;

  // Lessons completed in the 7-day window
  const lessonQuery = { user: userId, isCompleted: true, completedAt: { $gte: weekStart } };
  const lessonsCompleted = await LessonProgress.countDocuments(lessonQuery);

  // Vocabulary words added in the 7-day window
  const vocabQuery = { user: userId, createdAt: { $gte: weekStart } };
  if (language) vocabQuery.language = language;
  const vocabularyLearned = await Vocabulary.countDocuments(vocabQuery);

  // Challenges completed in the 7-day window
  const challengeQuery = { user: userId, isCompleted: true, completedAt: { $gte: weekStart } };
  const challengesCompleted = await ChallengeProgress.countDocuments(challengeQuery);

  // Days active: count distinct days with a completed lesson or challenge in window
  const [lessonDays, challengeDays] = await Promise.all([
    LessonProgress.distinct('completedAt', {
      user: userId,
      isCompleted: true,
      completedAt: { $gte: weekStart },
    }),
    ChallengeProgress.distinct('completedAt', {
      user: userId,
      isCompleted: true,
      completedAt: { $gte: weekStart },
    }),
  ]);
  const activeDaySet = new Set();
  for (const d of [...lessonDays, ...challengeDays]) {
    if (d) activeDaySet.add(new Date(d).toDateString());
  }
  const daysActive = activeDaySet.size;

  // Most recent achievement unlocked in the window
  let topAchievement = null;
  try {
    const ua = await UserAchievement.findOne({
      user: userId,
      isUnlocked: true,
      unlockedAt: { $gte: weekStart },
    })
      .sort({ unlockedAt: -1 })
      .lean();
    if (ua) {
      topAchievement = {
        id: ua._id,
        achievementCode: ua.achievementCode,
        unlockedAt: ua.unlockedAt,
      };
    }
  } catch (e) {
    // Non-fatal: return null for topAchievement
  }

  res.status(200).json({
    success: true,
    data: {
      weekStart: weekStart.toISOString(),
      weekEnd: now.toISOString(),
      xpEarned,
      lessonsCompleted,
      vocabularyLearned,
      challengesCompleted,
      currentStreak: progress.currentStreak || 0,
      longestStreak: progress.longestStreak || 0,
      topAchievement,
      daysActive,
    },
  });
});

// ===================== AI VOCABULARY =====================

// @desc    AI-define a vocabulary word — generate definition, examples, collocations
// @route   POST /api/v1/learning/vocabulary/ai-define
// @access  Private
exports.aiDefineVocabulary = asyncHandler(async (req, res, next) => {
  const { word, language, nativeLanguage } = req.body;

  if (!word || typeof word !== 'string' || word.trim().length === 0) {
    return next(new ErrorResponse('Word is required', 400));
  }
  if (word.length > 100) {
    return next(new ErrorResponse('Word too long', 400));
  }

  const targetLang = language || req.user.language_to_learn || 'English';
  const native = nativeLanguage || req.user.native_language || 'English';

  const prompt = `You are a language-learning assistant for a user studying ${targetLang}, native speaker of ${native}.

Generate vocabulary entry data for the word: "${word.trim()}" (${targetLang})

Return a JSON object with EXACTLY these fields:
{
  "definition": "<concise ${native} definition>",
  "translation": "<simple ${native} translation>",
  "partOfSpeech": "<noun|verb|adjective|adverb|pronoun|preposition|conjunction|interjection|phrase|other>",
  "examples": [
    "<${targetLang} sentence 1>",
    "<${targetLang} sentence 2>",
    "<${targetLang} sentence 3>"
  ],
  "collocations": ["<2-4 common collocations>"],
  "registerNotes": "<brief formal/informal/regional notes, or empty string>",
  "pronunciation": "<IPA or romanization, or empty string>"
}

Return ONLY the JSON, no preamble.`;

  const result = await chatCompletion({
    messages: [
      {
        role: 'system',
        content: 'You are a precise language-learning vocabulary generator. Respond with valid JSON only.'
      },
      { role: 'user', content: prompt }
    ],
    feature: 'translation',
    maxTokens: 600,
    temperature: 0.3,
    json: true
  });

  let parsed;
  try {
    parsed = JSON.parse(result.content);
  } catch (e) {
    return next(new ErrorResponse('AI response could not be parsed', 502));
  }

  res.status(200).json({
    success: true,
    data: {
      word: word.trim(),
      definition: parsed.definition || '',
      translation: parsed.translation || '',
      partOfSpeech: parsed.partOfSpeech || 'other',
      examples: Array.isArray(parsed.examples) ? parsed.examples.slice(0, 3) : [],
      collocations: Array.isArray(parsed.collocations) ? parsed.collocations.slice(0, 4) : [],
      registerNotes: parsed.registerNotes || '',
      pronunciation: parsed.pronunciation || '',
    }
  });
});

// ===================== AI DAILY PRACTICE =====================

/**
 * @desc    Get today's AI daily practice sentence
 * @route   GET /api/v1/learning/daily-practice
 * @access  Private
 */
exports.getDailyPractice = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const targetLanguage = req.user.language_to_learn || 'English';
  const nativeLanguage = req.user.native_language || 'English';

  // Pick 2-3 words from user's vocab — prefer learning-tier (srsLevel 1-8)
  const vocab = await Vocabulary.find({
    user: userId,
    language: targetLanguage,
    srsLevel: { $gte: 1, $lt: 9 },
  })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();

  // Random sample of 2-3 from the top 20
  const sample = [];
  const pool = [...vocab];
  const targetCount = Math.min(3, Math.max(2, pool.length));
  while (sample.length < targetCount && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    sample.push(pool.splice(idx, 1)[0]);
  }

  if (sample.length === 0) {
    // Fallback: use random recent vocab regardless of mastery
    const fallback = await Vocabulary.find({ user: userId, language: targetLanguage })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    if (fallback.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          sentence: null,
          words: [],
          message: 'Add vocabulary words first',
        },
      });
    }
    sample.push(...fallback.slice(0, Math.min(3, fallback.length)));
  }

  const wordsList = sample.map(v => v.word).join(', ');

  const prompt = `You are a language teacher creating a daily practice sentence.

Target language: ${targetLanguage}
Native language: ${nativeLanguage}
Words to incorporate: ${wordsList}

Create ONE natural, useful sentence in ${nativeLanguage} that the user should translate to ${targetLanguage}. The sentence should naturally use 2 or 3 of the vocabulary words above.

Return JSON with these EXACT fields:
{
  "sentence_native": "<the ${nativeLanguage} sentence to translate>",
  "expected_translation": "<the model ${targetLanguage} translation>",
  "words_used": ["<word1>", "<word2>", ...],
  "difficulty_hint": "<one-line tip about grammar or word usage>"
}

Return ONLY JSON, no preamble.`;

  const messages = [
    { role: 'system', content: 'You are a precise language-learning daily practice generator. Respond with valid JSON only.' },
    { role: 'user', content: prompt },
  ];

  const response = await chatCompletion({
    feature: 'translation',
    messages,
    maxTokens: 500,
    json: true,
  });

  let parsed;
  try {
    parsed = JSON.parse(response.content);
  } catch (e) {
    return next(new ErrorResponse('AI response could not be parsed', 502));
  }

  res.status(200).json({
    success: true,
    data: {
      sentence: parsed.sentence_native || null,
      expectedTranslation: parsed.expected_translation || null,
      wordsUsed: Array.isArray(parsed.words_used) ? parsed.words_used : sample.map(v => v.word),
      difficultyHint: parsed.difficulty_hint || '',
      vocabIds: sample.map(v => v._id),
      targetLanguage,
      nativeLanguage,
    },
  });
});

/**
 * @desc    Grade user's daily practice translation
 * @route   POST /api/v1/learning/daily-practice/grade
 * @access  Private
 */
exports.gradeDailyPractice = asyncHandler(async (req, res, next) => {
  const { sentenceNative, userTranslation, expectedTranslation, targetLanguage, nativeLanguage } = req.body;

  if (!userTranslation || typeof userTranslation !== 'string') {
    return next(new ErrorResponse('userTranslation required', 400));
  }
  if (!sentenceNative) {
    return next(new ErrorResponse('sentenceNative required', 400));
  }

  const tgt = targetLanguage || req.user.language_to_learn || 'English';
  const native = nativeLanguage || req.user.native_language || 'English';

  const prompt = `You are a language teacher grading a translation.

Native sentence (${native}): "${sentenceNative}"
Expected translation (${tgt}): "${expectedTranslation || '<not provided — use your own judgment>'}"
User's translation (${tgt}): "${userTranslation}"

Grade the user's translation. Return JSON:
{
  "score": <integer 0-100>,
  "isCorrect": <boolean — true if score >= 80>,
  "feedback": "<2-3 sentences explaining errors or praising. Be encouraging.>",
  "suggested_translation": "<your suggested correct ${tgt} translation>",
  "errors": [
    { "type": "grammar|vocab|spelling|word_order|other", "explanation": "<short>" }
  ]
}

Return ONLY JSON.`;

  const response = await chatCompletion({
    feature: 'translation',
    messages: [
      { role: 'system', content: 'You are a precise language teacher grader. Respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 600,
    json: true,
  });

  let parsed;
  try {
    parsed = JSON.parse(response.content);
  } catch (e) {
    return next(new ErrorResponse('AI grading response could not be parsed', 502));
  }

  res.status(200).json({
    success: true,
    data: {
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      isCorrect: !!parsed.isCorrect,
      feedback: parsed.feedback || '',
      suggestedTranslation: parsed.suggested_translation || expectedTranslation || '',
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
    },
  });
});
