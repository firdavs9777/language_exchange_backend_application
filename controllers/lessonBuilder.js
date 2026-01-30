/**
 * Lesson Builder Controller
 * Handles AI-powered lesson generation endpoints
 */

const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const Lesson = require('../models/Lesson');
const aiLessonBuilderService = require('../services/aiLessonBuilderService');

// ============================================================
// LESSON GENERATION
// ============================================================

/**
 * @desc    Generate a complete AI lesson
 * @route   POST /api/v1/lessons/generate
 * @access  Private (Admin/Creator)
 */
exports.generateLesson = asyncHandler(async (req, res, next) => {
  const {
    language,
    nativeLanguage = 'en',
    topic,
    level = 'A1',
    category = 'vocabulary',
    exerciseCount = 10,
    unitNumber,
    unitName
  } = req.body;

  if (!language || !topic) {
    return next(new ErrorResponse('Language and topic are required', 400));
  }

  const result = await aiLessonBuilderService.generateLesson({
    language,
    nativeLanguage,
    topic,
    level,
    category,
    exerciseCount: Math.min(Math.max(exerciseCount, 5), 20),
    unitNumber,
    unitName,
    userId: req.user.id
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Generate exercises for a topic
 * @route   POST /api/v1/lessons/generate/exercises
 * @access  Private (Admin/Creator)
 */
exports.generateExercises = asyncHandler(async (req, res, next) => {
  const {
    language,
    nativeLanguage = 'en',
    topic,
    level = 'A1',
    category = 'vocabulary',
    exerciseTypes,
    count = 10,
    vocabulary = [],
    context
  } = req.body;

  if (!language || !topic) {
    return next(new ErrorResponse('Language and topic are required', 400));
  }

  const result = await aiLessonBuilderService.generateExercises({
    language,
    nativeLanguage,
    topic,
    level,
    category,
    exerciseTypes,
    count: Math.min(Math.max(count, 1), 20),
    vocabulary,
    context,
    userId: req.user.id
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Generate vocabulary list
 * @route   POST /api/v1/lessons/generate/vocabulary
 * @access  Private (Admin/Creator)
 */
exports.generateVocabulary = asyncHandler(async (req, res, next) => {
  const {
    language,
    nativeLanguage = 'en',
    topic,
    level = 'A1',
    count = 20
  } = req.body;

  if (!language || !topic) {
    return next(new ErrorResponse('Language and topic are required', 400));
  }

  const result = await aiLessonBuilderService.generateVocabulary({
    language,
    nativeLanguage,
    topic,
    level,
    count: Math.min(Math.max(count, 5), 50),
    userId: req.user.id
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Generate a complete curriculum
 * @route   POST /api/v1/lessons/generate/curriculum
 * @access  Private (Admin only)
 */
exports.generateCurriculum = asyncHandler(async (req, res, next) => {
  const {
    language,
    nativeLanguage = 'en',
    level = 'A1',
    lessonsPerUnit = 5,
    unitsCount = 3,
    categories = ['vocabulary', 'grammar', 'conversation']
  } = req.body;

  if (!language) {
    return next(new ErrorResponse('Language is required', 400));
  }

  // This is a long-running operation
  const result = await aiLessonBuilderService.generateCurriculum({
    language,
    nativeLanguage,
    level,
    lessonsPerUnit: Math.min(Math.max(lessonsPerUnit, 3), 10),
    unitsCount: Math.min(Math.max(unitsCount, 1), 10),
    categories,
    userId: req.user.id
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Enhance an existing lesson
 * @route   POST /api/v1/lessons/:id/enhance
 * @access  Private (Admin/Creator)
 */
exports.enhanceLesson = asyncHandler(async (req, res, next) => {
  const lessonId = req.params.id;
  const {
    addExercises = 5,
    addContent = true,
    addTips = true
  } = req.body;

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', 404));
  }

  const result = await aiLessonBuilderService.enhanceLesson(lessonId, {
    addExercises: Math.min(Math.max(addExercises, 0), 10),
    addContent,
    addTips,
    userId: req.user.id
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Batch generate lessons
 * @route   POST /api/v1/lessons/generate/batch
 * @access  Private (Admin only)
 */
exports.batchGenerateLessons = asyncHandler(async (req, res, next) => {
  const { lessons, delayMs = 500 } = req.body;

  if (!lessons || !Array.isArray(lessons) || lessons.length === 0) {
    return next(new ErrorResponse('Lessons array is required', 400));
  }

  if (lessons.length > 20) {
    return next(new ErrorResponse('Maximum 20 lessons per batch', 400));
  }

  const result = await aiLessonBuilderService.batchGenerateLessons(lessons, {
    userId: req.user.id,
    delayMs
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

// ============================================================
// LESSON MANAGEMENT
// ============================================================

/**
 * @desc    Get all AI-generated lessons
 * @route   GET /api/v1/lessons/ai-generated
 * @access  Private
 */
exports.getAIGeneratedLessons = asyncHandler(async (req, res, next) => {
  const { language, level, category, page = 1, limit = 20 } = req.query;

  const filter = { 'aiGenerated.isAIGenerated': true };
  if (language) filter.language = language;
  if (level) filter.level = level;
  if (category) filter.category = category;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [lessons, total] = await Promise.all([
    Lesson.find(filter)
      .select('title slug language level category topic icon estimatedMinutes xpReward isPublished aiGenerated.generatedAt createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Lesson.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      lessons,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Get lesson templates info
 * @route   GET /api/v1/lessons/templates
 * @access  Private
 */
exports.getLessonTemplates = asyncHandler(async (req, res, next) => {
  const templates = aiLessonBuilderService.LESSON_TEMPLATES;
  const icons = aiLessonBuilderService.CATEGORY_ICONS;

  const templateInfo = Object.keys(templates).map(category => ({
    category,
    icon: icons[category],
    exerciseTypes: templates[category].exerciseTypes,
    exerciseDistribution: templates[category].exerciseDistribution,
    contentStructure: templates[category].contentStructure
  }));

  res.status(200).json({
    success: true,
    data: {
      templates: templateInfo,
      levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      supportedLanguages: [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'ru', name: 'Russian' },
        { code: 'zh', name: 'Chinese' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'ar', name: 'Arabic' }
      ]
    }
  });
});

/**
 * @desc    Delete an AI-generated lesson
 * @route   DELETE /api/v1/lessons/:id
 * @access  Private (Admin only)
 */
exports.deleteLesson = asyncHandler(async (req, res, next) => {
  const lesson = await Lesson.findById(req.params.id);

  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', 404));
  }

  await lesson.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Update lesson publish status
 * @route   PATCH /api/v1/lessons/:id/publish
 * @access  Private (Admin only)
 */
exports.updatePublishStatus = asyncHandler(async (req, res, next) => {
  const { isPublished } = req.body;

  const lesson = await Lesson.findByIdAndUpdate(
    req.params.id,
    {
      isPublished,
      publishedAt: isPublished ? new Date() : null
    },
    { new: true }
  );

  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      _id: lesson._id,
      title: lesson.title,
      isPublished: lesson.isPublished,
      publishedAt: lesson.publishedAt
    }
  });
});

/**
 * @desc    Get generation statistics
 * @route   GET /api/v1/lessons/stats
 * @access  Private (Admin only)
 */
exports.getGenerationStats = asyncHandler(async (req, res, next) => {
  const [
    totalAILessons,
    lessonsByLevel,
    lessonsByCategory,
    lessonsByLanguage,
    recentLessons
  ] = await Promise.all([
    Lesson.countDocuments({ 'aiGenerated.isAIGenerated': true }),
    Lesson.aggregate([
      { $match: { 'aiGenerated.isAIGenerated': true } },
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Lesson.aggregate([
      { $match: { 'aiGenerated.isAIGenerated': true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Lesson.aggregate([
      { $match: { 'aiGenerated.isAIGenerated': true } },
      { $group: { _id: '$language', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Lesson.find({ 'aiGenerated.isAIGenerated': true })
      .select('title language level category createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
  ]);

  // Calculate total tokens and estimated cost
  const tokenStats = await Lesson.aggregate([
    { $match: { 'aiGenerated.isAIGenerated': true } },
    {
      $group: {
        _id: null,
        totalTokens: { $sum: '$aiGenerated.tokensUsed' },
        avgTokens: { $avg: '$aiGenerated.tokensUsed' },
        avgGenerationTime: { $avg: '$aiGenerated.generationTimeMs' }
      }
    }
  ]);

  const totalTokens = tokenStats[0]?.totalTokens || 0;
  const estimatedCost = (totalTokens * 0.0004 / 1000).toFixed(4);

  res.status(200).json({
    success: true,
    data: {
      totalAILessons,
      byLevel: lessonsByLevel,
      byCategory: lessonsByCategory,
      byLanguage: lessonsByLanguage,
      recentLessons,
      tokenUsage: {
        total: totalTokens,
        average: Math.round(tokenStats[0]?.avgTokens || 0),
        estimatedTotalCost: `$${estimatedCost}`
      },
      averageGenerationTime: Math.round(tokenStats[0]?.avgGenerationTime || 0)
    }
  });
});
