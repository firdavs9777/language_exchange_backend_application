const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const aiTranslationService = require('../services/aiTranslationService');

/**
 * @desc    Get enhanced translation with explanations
 * @route   POST /api/v1/translate/enhanced
 * @access  Private
 */
exports.getEnhancedTranslation = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const {
    text,
    sourceLanguage,
    targetLanguage,
    nativeLanguage,
    includeBreakdown,
    includeGrammar,
    includeIdioms
  } = req.body;

  if (!text) {
    return next(new ErrorResponse('Text is required', 400));
  }

  if (!sourceLanguage || !targetLanguage) {
    return next(new ErrorResponse('Source and target languages are required', 400));
  }

  const result = await aiTranslationService.getEnhancedTranslation({
    text,
    sourceLanguage,
    targetLanguage,
    nativeLanguage,
    userId,
    includeBreakdown,
    includeGrammar,
    includeIdioms
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Detect and explain idioms
 * @route   POST /api/v1/translate/idioms
 * @access  Private
 */
exports.detectIdioms = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { text, sourceLanguage, targetLanguage } = req.body;

  if (!text) {
    return next(new ErrorResponse('Text is required', 400));
  }

  if (!sourceLanguage) {
    return next(new ErrorResponse('Source language is required', 400));
  }

  const result = await aiTranslationService.detectIdioms({
    text,
    sourceLanguage,
    targetLanguage: targetLanguage || 'en',
    userId
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Explain grammar differences
 * @route   POST /api/v1/translate/grammar
 * @access  Private
 */
exports.explainGrammar = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const {
    text,
    sourceLanguage,
    targetLanguage,
    nativeLanguage
  } = req.body;

  if (!text) {
    return next(new ErrorResponse('Text is required', 400));
  }

  if (!sourceLanguage || !targetLanguage) {
    return next(new ErrorResponse('Source and target languages are required', 400));
  }

  const result = await aiTranslationService.explainGrammarDifferences({
    text,
    sourceLanguage,
    targetLanguage,
    nativeLanguage,
    userId
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get alternative translations
 * @route   POST /api/v1/translate/alternatives
 * @access  Private
 */
exports.getAlternatives = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const {
    text,
    sourceLanguage,
    targetLanguage,
    context
  } = req.body;

  if (!text) {
    return next(new ErrorResponse('Text is required', 400));
  }

  if (!sourceLanguage || !targetLanguage) {
    return next(new ErrorResponse('Source and target languages are required', 400));
  }

  const result = await aiTranslationService.getAlternativeTranslations({
    text,
    sourceLanguage,
    targetLanguage,
    context,
    userId
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get contextual translation
 * @route   POST /api/v1/translate/contextual
 * @access  Private
 */
exports.getContextualTranslation = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const {
    text,
    sourceLanguage,
    targetLanguage,
    context,
    tone,
    audience
  } = req.body;

  if (!text) {
    return next(new ErrorResponse('Text is required', 400));
  }

  if (!sourceLanguage || !targetLanguage) {
    return next(new ErrorResponse('Source and target languages are required', 400));
  }

  const result = await aiTranslationService.getContextualTranslation({
    text,
    sourceLanguage,
    targetLanguage,
    context,
    tone,
    audience,
    userId
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get popular translations
 * @route   GET /api/v1/translate/popular
 * @access  Private
 */
exports.getPopularTranslations = asyncHandler(async (req, res, next) => {
  const { language, limit } = req.query;

  if (!language) {
    return next(new ErrorResponse('Language is required', 400));
  }

  const translations = await aiTranslationService.getPopularTranslations(
    language,
    limit ? parseInt(limit) : 10
  );

  res.status(200).json({
    success: true,
    count: translations.length,
    data: translations
  });
});

/**
 * @desc    Get translation cache stats (admin only)
 * @route   GET /api/v1/translate/cache/stats
 * @access  Private/Admin
 */
exports.getCacheStats = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access cache stats', 403));
  }

  const stats = await aiTranslationService.getCacheStats();

  res.status(200).json({
    success: true,
    data: stats
  });
});
