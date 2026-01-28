const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const grammarFeedbackService = require('../services/grammarFeedbackService');
const User = require('../models/User');

/**
 * @desc    Request grammar feedback for text
 * @route   POST /api/v1/grammar-feedback
 * @access  Private
 */
exports.requestFeedback = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const {
    text,
    targetLanguage,
    nativeLanguage,
    cefrLevel,
    messageId,
    aiConversationId
  } = req.body;

  if (!text || text.trim().length === 0) {
    return next(new ErrorResponse('Text to analyze is required', 400));
  }

  // Get user's default settings if not provided
  const user = await User.findById(userId).select('language_to_learn native_language learningStats');

  // Check rate limits
  const userTier = req.user.subscription?.tier || 'free';
  const rateLimit = await grammarFeedbackService.checkRateLimit(userId, userTier);

  if (!rateLimit.allowed) {
    return next(new ErrorResponse(
      `Rate limit exceeded. Daily: ${rateLimit.daily.used}/${rateLimit.daily.limit}`,
      429
    ));
  }

  const result = await grammarFeedbackService.analyzeGrammar({
    userId,
    text,
    targetLanguage: targetLanguage || user?.language_to_learn || 'es',
    nativeLanguage: nativeLanguage || user?.native_language || 'en',
    cefrLevel: cefrLevel || user?.learningStats?.proficiencyLevel || 'A1',
    messageId,
    aiConversationId,
    requestedBy: 'user'
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get grammar feedback by ID
 * @route   GET /api/v1/grammar-feedback/:id
 * @access  Private
 */
exports.getFeedback = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const feedbackId = req.params.id;

  const feedback = await grammarFeedbackService.getFeedback(feedbackId, userId);

  res.status(200).json({
    success: true,
    data: feedback
  });
});

/**
 * @desc    Get user's feedback history
 * @route   GET /api/v1/grammar-feedback/history
 * @access  Private
 */
exports.getHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { targetLanguage, status, limit = 20, offset = 0 } = req.query;

  const result = await grammarFeedbackService.getUserHistory(userId, {
    targetLanguage,
    status,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.status(200).json({
    success: true,
    data: result.feedbacks,
    pagination: {
      total: result.total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: result.hasMore
    }
  });
});

/**
 * @desc    Mark feedback as viewed
 * @route   PUT /api/v1/grammar-feedback/:id/viewed
 * @access  Private
 */
exports.markViewed = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const feedbackId = req.params.id;

  const feedback = await grammarFeedbackService.markViewed(feedbackId, userId);

  res.status(200).json({
    success: true,
    data: feedback
  });
});

/**
 * @desc    Mark corrections as applied
 * @route   PUT /api/v1/grammar-feedback/:id/applied
 * @access  Private
 */
exports.markApplied = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const feedbackId = req.params.id;

  const result = await grammarFeedbackService.markApplied(feedbackId, userId);

  res.status(200).json({
    success: true,
    data: {
      feedback: result.feedback,
      xpAwarded: result.xpAwarded
    }
  });
});

/**
 * @desc    Get explanation for a grammar rule
 * @route   POST /api/v1/grammar-feedback/explain-rule
 * @access  Private
 */
exports.explainRule = asyncHandler(async (req, res, next) => {
  const { rule, targetLanguage, nativeLanguage, cefrLevel, context } = req.body;

  if (!rule) {
    return next(new ErrorResponse('Grammar rule is required', 400));
  }

  const user = await User.findById(req.user.id).select('language_to_learn native_language learningStats');

  const explanation = await grammarFeedbackService.explainRule({
    rule,
    targetLanguage: targetLanguage || user?.language_to_learn || 'es',
    nativeLanguage: nativeLanguage || user?.native_language || 'en',
    cefrLevel: cefrLevel || user?.learningStats?.proficiencyLevel || 'A1',
    context
  });

  res.status(200).json({
    success: true,
    data: explanation
  });
});

/**
 * @desc    Get user's grammar stats
 * @route   GET /api/v1/grammar-feedback/stats
 * @access  Private
 */
exports.getStats = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { targetLanguage } = req.query;

  const stats = await grammarFeedbackService.getUserStats(userId, targetLanguage);

  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Get user's common errors
 * @route   GET /api/v1/grammar-feedback/common-errors
 * @access  Private
 */
exports.getCommonErrors = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { limit = 10 } = req.query;

  const errors = await grammarFeedbackService.getCommonErrors(userId, parseInt(limit));

  res.status(200).json({
    success: true,
    data: errors
  });
});

/**
 * @desc    Check rate limits for grammar feedback
 * @route   GET /api/v1/grammar-feedback/rate-limit
 * @access  Private
 */
exports.checkRateLimit = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const userTier = req.user.subscription?.tier || 'free';

  const rateLimit = await grammarFeedbackService.checkRateLimit(userId, userTier);

  res.status(200).json({
    success: true,
    data: rateLimit
  });
});
