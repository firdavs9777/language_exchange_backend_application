/**
 * Recommendation Service
 * Handles AI-powered lesson recommendations
 */

const LessonRecommendation = require('../models/LessonRecommendation');
const Lesson = require('../models/Lesson');
const LessonProgress = require('../models/LessonProgress');
const QuizAttempt = require('../models/QuizAttempt');
const Vocabulary = require('../models/Vocabulary');
const LearningProgress = require('../models/LearningProgress');
const {
  chatCompletion,
  buildRecommendationPrompt,
  parseJSONResponse,
  trackUsage
} = require('./aiProviderService');
const { AI_FEATURES, CACHE_TTL } = require('../config/aiConfig');

/**
 * Get adaptive lesson recommendations
 * @param {String} userId - User ID
 * @param {Object} options - Options
 * @returns {Promise<Object>} Recommendations
 */
const getAdaptiveRecommendations = async (userId, options = {}) => {
  const {
    language,
    limit = 10,
    forceRefresh = false
  } = options;

  if (!AI_FEATURES.recommendations) {
    return getFallbackRecommendations(userId, language, limit);
  }

  // Check for valid cached recommendations
  if (!forceRefresh) {
    const cached = await LessonRecommendation.getValidRecommendations(userId, language);
    if (cached) {
      return {
        recommendations: cached.recommendations,
        weakAreas: cached.weakAreas,
        learningInsight: cached.learningInsight,
        generatedAt: cached.generatedAt,
        expiresAt: cached.expiresAt,
        cached: true
      };
    }
  }

  // Gather learning context
  const context = await gatherLearningContext(userId, language);

  // If no context or no available lessons, use fallback
  if (!context.availableLessons || context.availableLessons.length === 0) {
    return getFallbackRecommendations(userId, language, limit);
  }

  try {
    // Generate AI recommendations
    const prompt = buildRecommendationPrompt({
      ...context,
      count: limit
    });

    const response = await chatCompletion({
      messages: [{ role: 'user', content: prompt }],
      feature: 'recommendation',
      json: true
    });

    const result = parseJSONResponse(response.content);

    // Map AI recommendations to lessons
    const recommendations = [];
    for (const rec of (result.recommendations || []).slice(0, limit)) {
      const lesson = context.availableLessons.find(l =>
        l._id.toString() === rec.lessonId || l._id.toString() === rec.lesson_id
      );
      if (lesson) {
        recommendations.push({
          lesson: lesson._id,
          score: rec.score || 50,
          reasons: rec.reasons || ['Recommended for your level'],
          priority: rec.priority || recommendations.length + 1,
          recommendationType: rec.type || rec.recommendation_type || 'next_in_sequence'
        });
      }
    }

    // If AI didn't return enough, supplement with fallback
    if (recommendations.length < limit) {
      const fallback = await getFallbackRecommendations(userId, language, limit - recommendations.length);
      const existingIds = recommendations.map(r => r.lesson.toString());
      for (const rec of fallback.recommendations) {
        if (!existingIds.includes(rec.lesson.toString())) {
          recommendations.push(rec);
        }
      }
    }

    // Calculate expiry
    const expiresAt = new Date(Date.now() + CACHE_TTL.recommendations);

    // Save to cache
    const savedRec = await LessonRecommendation.create({
      user: userId,
      language: language || context.targetLanguage,
      proficiencyLevel: context.proficiencyLevel,
      recommendations,
      weakAreas: context.weakAreas,
      context: {
        completedLessonCount: context.lessonsCompleted,
        averageScore: context.averageScore,
        learningPace: determineLearningPace(context),
        recentTopics: context.recentTopics,
        dailyGoal: context.dailyGoal,
        currentStreak: context.currentStreak
      },
      learningInsight: result.learning_insight || result.learningInsight,
      expiresAt,
      tokensUsed: {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      },
      generationType: 'ai'
    });

    // Track usage
    await trackUsage({
      userId,
      feature: 'recommendation',
      tokensUsed: response.usage,
      provider: 'openai'
    });

    // Populate lessons for response
    await savedRec.populate('recommendations.lesson', 'title slug level category topic icon estimatedMinutes xpReward isPremium unit');

    return {
      recommendations: savedRec.recommendations,
      weakAreas: savedRec.weakAreas,
      learningInsight: savedRec.learningInsight,
      generatedAt: savedRec.generatedAt,
      expiresAt: savedRec.expiresAt,
      cached: false
    };
  } catch (error) {
    console.error('AI recommendation failed, using fallback:', error.message);
    return getFallbackRecommendations(userId, language, limit);
  }
};

/**
 * Gather comprehensive learning context for AI
 */
const gatherLearningContext = async (userId, language) => {
  // Get user's learning progress
  const learningProgress = await LearningProgress.findOne({ user: userId });
  const targetLanguage = language || learningProgress?.targetLanguage || 'es';
  const proficiencyLevel = learningProgress?.proficiencyLevel || 'A1';

  // Get completed lessons
  const completedLessonIds = await LessonProgress.find({
    user: userId,
    isCompleted: true
  }).distinct('lesson');

  // Get lesson performance
  const lessonPerformance = await LessonProgress.aggregate([
    { $match: { user: userId.toString ? new (require('mongoose').Types.ObjectId)(userId) : userId } },
    {
      $group: {
        _id: null,
        avgScore: { $avg: '$score' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Get weak areas from quiz attempts
  const weakAreas = await identifyWeakAreas(userId);

  // Get recent topics
  const recentProgress = await LessonProgress.find({ user: userId })
    .sort({ completedAt: -1 })
    .limit(10)
    .populate('lesson', 'topic category');

  const recentTopics = [...new Set(
    recentProgress
      .filter(p => p.lesson?.topic)
      .map(p => p.lesson.topic)
  )];

  // Get available lessons (not completed, matching level)
  const availableLessons = await Lesson.find({
    language: targetLanguage,
    level: { $in: getApplicableLevels(proficiencyLevel) },
    isPublished: true,
    _id: { $nin: completedLessonIds }
  })
    .select('_id title slug level category topic icon estimatedMinutes xpReward isPremium unit')
    .sort({ 'unit.number': 1, orderInUnit: 1 })
    .limit(50)
    .lean();

  return {
    targetLanguage,
    proficiencyLevel,
    lessonsCompleted: completedLessonIds.length,
    averageScore: Math.round(lessonPerformance[0]?.avgScore || 0),
    weakAreas,
    recentTopics,
    availableLessons,
    dailyGoal: learningProgress?.dailyGoal || 'regular',
    currentStreak: learningProgress?.currentStreak || 0
  };
};

/**
 * Identify user's weak areas from performance data
 */
const identifyWeakAreas = async (userId) => {
  // Get quiz performance by topic
  const quizPerformance = await QuizAttempt.aggregate([
    { $match: { user: userId.toString ? new (require('mongoose').Types.ObjectId)(userId) : userId } },
    { $unwind: '$answers' },
    {
      $lookup: {
        from: 'quizzes',
        localField: 'quiz',
        foreignField: '_id',
        as: 'quizData'
      }
    },
    { $unwind: { path: '$quizData', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$quizData.topic',
        totalQuestions: { $sum: 1 },
        correctAnswers: {
          $sum: { $cond: ['$answers.isCorrect', 1, 0] }
        }
      }
    },
    {
      $project: {
        topic: '$_id',
        accuracy: {
          $cond: [
            { $gt: ['$totalQuestions', 0] },
            { $divide: ['$correctAnswers', '$totalQuestions'] },
            0
          ]
        }
      }
    },
    { $match: { accuracy: { $lt: 0.7 } } },
    { $sort: { accuracy: 1 } },
    { $limit: 5 }
  ]);

  // Get vocabulary weak areas (low SRS level, high failure rate)
  const vocabWeakAreas = await Vocabulary.aggregate([
    { $match: { user: userId.toString ? new (require('mongoose').Types.ObjectId)(userId) : userId } },
    {
      $group: {
        _id: '$tags',
        avgSrsLevel: { $avg: '$srsLevel' },
        count: { $sum: 1 }
      }
    },
    { $match: { avgSrsLevel: { $lt: 3 }, count: { $gte: 3 } } },
    { $sort: { avgSrsLevel: 1 } },
    { $limit: 3 }
  ]);

  const weakAreas = [];

  // Add quiz-based weak areas
  for (const perf of quizPerformance) {
    if (perf.topic) {
      weakAreas.push({
        topic: perf.topic,
        category: 'quiz',
        score: perf.accuracy,
        mistakeRate: Math.round((1 - perf.accuracy) * 100)
      });
    }
  }

  // Add vocabulary-based weak areas
  for (const vocab of vocabWeakAreas) {
    if (vocab._id && vocab._id.length > 0) {
      weakAreas.push({
        topic: vocab._id[0],
        category: 'vocabulary',
        score: vocab.avgSrsLevel / 9,
        mistakeRate: Math.round((1 - vocab.avgSrsLevel / 9) * 100)
      });
    }
  }

  return weakAreas;
};

/**
 * Get fallback recommendations (non-AI)
 */
const getFallbackRecommendations = async (userId, language, limit = 10) => {
  // Get user's level
  const learningProgress = await LearningProgress.findOne({ user: userId });
  const targetLanguage = language || learningProgress?.targetLanguage || 'es';
  const proficiencyLevel = learningProgress?.proficiencyLevel || 'A1';

  // Get completed lessons
  const completedLessonIds = await LessonProgress.find({
    user: userId,
    isCompleted: true
  }).distinct('lesson');

  // Get next lessons in sequence
  const lessons = await Lesson.find({
    language: targetLanguage,
    level: { $in: getApplicableLevels(proficiencyLevel) },
    isPublished: true,
    _id: { $nin: completedLessonIds }
  })
    .select('_id title slug level category topic icon estimatedMinutes xpReward isPremium unit')
    .sort({ 'unit.number': 1, orderInUnit: 1 })
    .limit(limit)
    .lean();

  const recommendations = lessons.map((lesson, index) => ({
    lesson: lesson,
    score: 100 - (index * 5),
    reasons: ['Next lesson in your curriculum'],
    priority: index + 1,
    recommendationType: 'next_in_sequence'
  }));

  return {
    recommendations,
    weakAreas: [],
    learningInsight: 'Continue with your curriculum to make progress!',
    generatedAt: new Date(),
    expiresAt: new Date(Date.now() + CACHE_TTL.recommendations),
    cached: false,
    isFallback: true
  };
};

/**
 * Get applicable CEFR levels for recommendations
 */
const getApplicableLevels = (currentLevel) => {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const currentIndex = levels.indexOf(currentLevel);

  // Include current level and one level up
  return levels.slice(Math.max(0, currentIndex), currentIndex + 2);
};

/**
 * Determine learning pace from context
 */
const determineLearningPace = (context) => {
  const { lessonsCompleted, currentStreak, averageScore } = context;

  if (lessonsCompleted > 20 && currentStreak > 7 && averageScore > 80) {
    return 'fast';
  } else if (lessonsCompleted < 5 || currentStreak < 3) {
    return 'slow';
  }
  return 'moderate';
};

/**
 * Invalidate recommendations for user
 */
const invalidateRecommendations = async (userId) => {
  await LessonRecommendation.invalidateForUser(userId);
};

/**
 * Get user's weak areas
 */
const getWeakAreas = async (userId) => {
  return await identifyWeakAreas(userId);
};

module.exports = {
  getAdaptiveRecommendations,
  gatherLearningContext,
  identifyWeakAreas,
  getFallbackRecommendations,
  invalidateRecommendations,
  getWeakAreas
};
