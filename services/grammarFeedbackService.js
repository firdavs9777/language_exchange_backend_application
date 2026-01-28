/**
 * Grammar Feedback Service
 * Handles AI-powered grammar analysis and feedback
 */

const GrammarFeedback = require('../models/GrammarFeedback');
const {
  chatCompletion,
  buildGrammarFeedbackPrompt,
  parseJSONResponse,
  trackUsage
} = require('./aiProviderService');
const { XP_REWARDS } = require('../config/xpRewards');
const { AI_FEATURES, AI_RATE_LIMITS } = require('../config/aiConfig');

/**
 * Analyze text and provide grammar feedback
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Grammar feedback
 */
const analyzeGrammar = async (options) => {
  const {
    userId,
    text,
    targetLanguage,
    nativeLanguage = 'en',
    cefrLevel = 'A1',
    messageId,
    aiConversationId,
    requestedBy = 'user'
  } = options;

  if (!AI_FEATURES.grammarFeedback) {
    throw new Error('Grammar feedback feature is not enabled');
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Text to analyze is required');
  }

  if (text.length > 2000) {
    throw new Error('Text exceeds maximum length of 2000 characters');
  }

  // Build the system prompt
  const systemPrompt = buildGrammarFeedbackPrompt({
    targetLanguage,
    nativeLanguage,
    cefrLevel
  });

  // Call AI for analysis
  const response = await chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze this text:\n\n"${text}"` }
    ],
    feature: 'grammarFeedback',
    json: true
  });

  // Parse the JSON response
  let analysis;
  try {
    analysis = parseJSONResponse(response.content);
  } catch (error) {
    console.error('Failed to parse grammar analysis:', error);
    // Return a basic response if parsing fails
    analysis = {
      overallScore: 70,
      errors: [],
      suggestions: [],
      positives: ['Your message was received'],
      summary: 'Unable to fully analyze the text. Please try again.'
    };
  }

  // Calculate XP
  let xpAwarded = XP_REWARDS.GRAMMAR_FEEDBACK_REQUEST;

  // Bonus XP for perfect message
  if (!analysis.errors || analysis.errors.length === 0) {
    xpAwarded += XP_REWARDS.GRAMMAR_PERFECT_MESSAGE;
  }

  // Build corrected text if there are errors
  let correctedText = text;
  if (analysis.errors && analysis.errors.length > 0) {
    // Sort errors by start index in reverse to replace from end to start
    const sortedErrors = [...analysis.errors]
      .filter(e => e.startIndex !== undefined && e.endIndex !== undefined)
      .sort((a, b) => b.startIndex - a.startIndex);

    for (const error of sortedErrors) {
      correctedText =
        correctedText.slice(0, error.startIndex) +
        error.correctedSegment +
        correctedText.slice(error.endIndex);
    }
  }

  // Create feedback record
  const feedback = await GrammarFeedback.create({
    user: userId,
    message: messageId,
    aiConversation: aiConversationId,
    originalText: text,
    targetLanguage,
    nativeLanguage,
    cefrLevel,
    overallScore: analysis.overallScore || 0,
    errors: analysis.errors || [],
    suggestions: analysis.suggestions || [],
    positives: analysis.positives || [],
    summary: analysis.summary || '',
    correctedText,
    requestedBy,
    tokensUsed: {
      input: response.usage.inputTokens,
      output: response.usage.outputTokens
    },
    xpAwarded
  });

  // Track AI usage
  await trackUsage({
    userId,
    feature: 'grammarFeedback',
    tokensUsed: response.usage,
    provider: 'openai'
  });

  return {
    feedback: {
      _id: feedback._id,
      originalText: feedback.originalText,
      correctedText: feedback.correctedText,
      overallScore: feedback.overallScore,
      errors: feedback.errors,
      suggestions: feedback.suggestions,
      positives: feedback.positives,
      summary: feedback.summary,
      errorCount: feedback.errors.length,
      isPerfect: feedback.errors.length === 0
    },
    xpAwarded
  };
};

/**
 * Get detailed explanation for a grammar rule
 * @param {Object} options - Options
 * @returns {Promise<Object>} Explanation
 */
const explainRule = async (options) => {
  const {
    rule,
    targetLanguage,
    nativeLanguage = 'en',
    cefrLevel = 'A1',
    context
  } = options;

  const prompt = `Explain the following ${targetLanguage} grammar rule in ${nativeLanguage}, suitable for a ${cefrLevel} level learner:

Rule: ${rule}
${context ? `Context: "${context}"` : ''}

Provide:
1. A clear, simple explanation
2. 3 example sentences showing correct usage
3. Common mistakes to avoid
4. A memory tip if helpful

Format as JSON:
{
  "explanation": "...",
  "examples": ["...", "...", "..."],
  "commonMistakes": ["..."],
  "memoryTip": "..."
}`;

  const response = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    feature: 'grammarFeedback',
    json: true
  });

  return parseJSONResponse(response.content);
};

/**
 * Get feedback by ID
 * @param {String} feedbackId - Feedback ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Feedback
 */
const getFeedback = async (feedbackId, userId) => {
  const feedback = await GrammarFeedback.findOne({
    _id: feedbackId,
    user: userId
  });

  if (!feedback) {
    throw new Error('Feedback not found');
  }

  return feedback;
};

/**
 * Get user's feedback history
 * @param {String} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Feedback history
 */
const getUserHistory = async (userId, options = {}) => {
  return await GrammarFeedback.getUserHistory(userId, options);
};

/**
 * Mark feedback as viewed
 * @param {String} feedbackId - Feedback ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Updated feedback
 */
const markViewed = async (feedbackId, userId) => {
  const feedback = await GrammarFeedback.findOne({
    _id: feedbackId,
    user: userId
  });

  if (!feedback) {
    throw new Error('Feedback not found');
  }

  await feedback.markViewed();
  return feedback;
};

/**
 * Mark corrections as applied
 * @param {String} feedbackId - Feedback ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Updated feedback with XP info
 */
const markApplied = async (feedbackId, userId) => {
  const feedback = await GrammarFeedback.findOne({
    _id: feedbackId,
    user: userId
  });

  if (!feedback) {
    throw new Error('Feedback not found');
  }

  if (feedback.correctionsApplied) {
    return { feedback, xpAwarded: 0 };
  }

  // Award XP for applying corrections
  const xpAwarded = XP_REWARDS.GRAMMAR_FEEDBACK_APPLY;
  feedback.xpAwarded += xpAwarded;

  await feedback.markApplied();

  return { feedback, xpAwarded };
};

/**
 * Get user's grammar stats
 * @param {String} userId - User ID
 * @param {String} targetLanguage - Optional language filter
 * @returns {Promise<Object>} Stats
 */
const getUserStats = async (userId, targetLanguage = null) => {
  return await GrammarFeedback.getUserStats(userId, targetLanguage);
};

/**
 * Get user's common errors
 * @param {String} userId - User ID
 * @param {Number} limit - Max results
 * @returns {Promise<Array>} Common errors
 */
const getCommonErrors = async (userId, limit = 10) => {
  return await GrammarFeedback.getCommonErrors(userId, limit);
};

/**
 * Check rate limits for grammar feedback
 * @param {String} userId - User ID
 * @param {String} userTier - User tier
 * @returns {Promise<Object>} Rate limit status
 */
const checkRateLimit = async (userId, userTier = 'free') => {
  const limits = AI_RATE_LIMITS[userTier]?.grammarFeedback || AI_RATE_LIMITS.free.grammarFeedback;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyCount = await GrammarFeedback.countDocuments({
    user: userId,
    createdAt: { $gte: today }
  });

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthlyCount = await GrammarFeedback.countDocuments({
    user: userId,
    createdAt: { $gte: monthStart }
  });

  const withinDailyLimit = limits.perDay === -1 || dailyCount < limits.perDay;
  const withinMonthlyLimit = limits.perMonth === -1 || monthlyCount < limits.perMonth;

  return {
    allowed: withinDailyLimit && withinMonthlyLimit,
    daily: {
      used: dailyCount,
      limit: limits.perDay,
      remaining: limits.perDay === -1 ? -1 : Math.max(0, limits.perDay - dailyCount)
    },
    monthly: {
      used: monthlyCount,
      limit: limits.perMonth,
      remaining: limits.perMonth === -1 ? -1 : Math.max(0, limits.perMonth - monthlyCount)
    }
  };
};

module.exports = {
  analyzeGrammar,
  explainRule,
  getFeedback,
  getUserHistory,
  markViewed,
  markApplied,
  getUserStats,
  getCommonErrors,
  checkRateLimit
};
