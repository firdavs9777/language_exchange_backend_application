const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const aiConversationService = require('../services/aiConversationService');
const User = require('../models/User');

/**
 * @desc    Start a new AI conversation
 * @route   POST /api/v1/ai-conversation/start
 * @access  Private
 */
exports.startConversation = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const {
    targetLanguage,
    cefrLevel,
    nativeLanguage,
    topicId,
    scenarioId,
    customTopic,
    settings
  } = req.body;

  // Get user's default language settings if not provided
  const user = await User.findById(userId).select('language_to_learn native_language learningStats');

  // Check rate limits
  const userTier = req.user.subscription?.tier || 'free';
  const rateLimit = await aiConversationService.checkRateLimit(userId, userTier);

  if (!rateLimit.allowed) {
    return next(new ErrorResponse(
      `Rate limit exceeded. Daily: ${rateLimit.daily.used}/${rateLimit.daily.limit}, Monthly: ${rateLimit.monthly.used}/${rateLimit.monthly.limit}`,
      429
    ));
  }

  const result = await aiConversationService.startConversation({
    userId,
    targetLanguage: targetLanguage || user?.language_to_learn || 'es',
    cefrLevel: cefrLevel || user?.learningStats?.proficiencyLevel || 'A1',
    nativeLanguage: nativeLanguage || user?.native_language || 'en',
    topicId,
    scenarioId,
    customTopic,
    settings
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Send a message in AI conversation
 * @route   POST /api/v1/ai-conversation/:id/message
 * @access  Private
 */
exports.sendMessage = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const conversationId = req.params.id;
  const { content, responseTime } = req.body;

  if (!content || content.trim().length === 0) {
    return next(new ErrorResponse('Message content is required', 400));
  }

  const result = await aiConversationService.sendMessage({
    conversationId,
    userId,
    content: content.trim(),
    responseTime
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    End an AI conversation
 * @route   POST /api/v1/ai-conversation/:id/end
 * @access  Private
 */
exports.endConversation = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const conversationId = req.params.id;

  const result = await aiConversationService.endConversation(conversationId, userId);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get a specific AI conversation
 * @route   GET /api/v1/ai-conversation/:id
 * @access  Private
 */
exports.getConversation = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const conversationId = req.params.id;

  const conversation = await aiConversationService.getConversation(conversationId, userId);

  res.status(200).json({
    success: true,
    data: conversation
  });
});

/**
 * @desc    Get user's AI conversations
 * @route   GET /api/v1/ai-conversation
 * @access  Private
 */
exports.getUserConversations = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { status, targetLanguage, limit = 20, offset = 0 } = req.query;

  const result = await aiConversationService.getUserConversations(userId, {
    status,
    targetLanguage,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.status(200).json({
    success: true,
    data: result.conversations,
    pagination: {
      total: result.total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: result.hasMore
    }
  });
});

/**
 * @desc    Get available conversation topics
 * @route   GET /api/v1/ai-conversation/topics
 * @access  Private
 */
exports.getTopics = asyncHandler(async (req, res, next) => {
  const { cefrLevel = 'A1' } = req.query;

  const topics = aiConversationService.getTopics(cefrLevel);

  res.status(200).json({
    success: true,
    data: topics
  });
});

/**
 * @desc    Get available practice scenarios
 * @route   GET /api/v1/ai-conversation/scenarios
 * @access  Private
 */
exports.getScenarios = asyncHandler(async (req, res, next) => {
  const { cefrLevel = 'A1' } = req.query;

  const scenarios = aiConversationService.getScenarios(cefrLevel);

  res.status(200).json({
    success: true,
    data: scenarios
  });
});

/**
 * @desc    Get user's AI conversation stats
 * @route   GET /api/v1/ai-conversation/stats
 * @access  Private
 */
exports.getStats = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { targetLanguage } = req.query;

  const stats = await aiConversationService.getUserStats(userId, targetLanguage);

  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Check rate limits for AI conversation
 * @route   GET /api/v1/ai-conversation/rate-limit
 * @access  Private
 */
exports.checkRateLimit = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const userTier = req.user.subscription?.tier || 'free';

  const rateLimit = await aiConversationService.checkRateLimit(userId, userTier);

  res.status(200).json({
    success: true,
    data: rateLimit
  });
});
