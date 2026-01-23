const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const LearningProgress = require('../models/LearningProgress');
const Vocabulary = require('../models/Vocabulary');
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

  const vocabulary = await Vocabulary.create({
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
    context
  });

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

// ===================== LESSONS =====================

/**
 * @desc    Get lesson curriculum
 * @route   GET /api/v1/learning/lessons
 * @access  Private
 */
exports.getLessons = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { language, level, category, page = 1, limit = 50 } = req.query;

  const user = await User.findById(userId).select('language_to_learn');
  const targetLanguage = language || user?.language_to_learn;

  const result = await Lesson.getLessons({
    language: targetLanguage,
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
  const { language } = req.query;

  const user = await User.findById(userId).select('language_to_learn learningStats');
  const targetLanguage = language || user?.language_to_learn;
  const userLevel = user?.learningStats?.proficiencyLevel || 'A1';

  const recommended = await Lesson.getRecommended(userId, targetLanguage, userLevel);

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
  const { language, level } = req.query;

  const user = await User.findById(userId).select('language_to_learn');
  const targetLanguage = language || user?.language_to_learn;

  const curriculum = await Lesson.getCurriculum(targetLanguage, level);

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
