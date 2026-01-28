/**
 * AI Conversation Service
 * Handles AI conversation partner logic
 */

const AIConversation = require('../models/AIConversation');
const User = require('../models/User');
const {
  chatCompletion,
  streamChatCompletion,
  buildConversationSystemPrompt,
  trackUsage
} = require('./aiProviderService');
const { XP_REWARDS } = require('../config/xpRewards');
const {
  CONVERSATION_TOPICS,
  PRACTICE_SCENARIOS,
  AI_FEATURES,
  AI_RATE_LIMITS
} = require('../config/aiConfig');

/**
 * Start a new AI conversation
 * @param {Object} options - Conversation options
 * @returns {Promise<Object>} New conversation
 */
const startConversation = async (options) => {
  const {
    userId,
    targetLanguage,
    cefrLevel,
    nativeLanguage = 'en',
    topicId,
    scenarioId,
    customTopic,
    settings = {}
  } = options;

  if (!AI_FEATURES.conversation) {
    throw new Error('AI conversation feature is not enabled');
  }

  // Check for existing active conversation
  const existingActive = await AIConversation.getActiveConversation(userId);
  if (existingActive) {
    // End the previous conversation as abandoned
    await existingActive.endConversation('abandoned');
  }

  // Get topic and scenario details
  const levelTopics = CONVERSATION_TOPICS[cefrLevel] || CONVERSATION_TOPICS.A1;
  const topic = topicId ? levelTopics.find(t => t.id === topicId) : null;

  const levelScenarios = PRACTICE_SCENARIOS[cefrLevel] || PRACTICE_SCENARIOS.A1;
  const scenario = scenarioId ? levelScenarios.find(s => s.id === scenarioId) : null;

  // Create new conversation
  const conversation = new AIConversation({
    user: userId,
    targetLanguage,
    cefrLevel,
    nativeLanguage,
    topic: topic ? { id: topic.id, name: topic.name, icon: topic.icon } : null,
    scenario: scenario ? { id: scenario.id, name: scenario.name, description: scenario.description } : null,
    customTopic,
    settings: {
      autoCorrect: settings.autoCorrect !== false,
      formality: settings.formality || 'neutral',
      showTranslations: settings.showTranslations || false
    }
  });

  // Build system prompt
  const systemPrompt = buildConversationSystemPrompt({
    cefrLevel,
    targetLanguage,
    nativeLanguage,
    topic: customTopic || (topic ? topic.name : null),
    scenario: scenario ? scenario.description : null
  });

  // Add system message
  conversation.messages.push({
    role: 'system',
    content: systemPrompt,
    timestamp: new Date()
  });

  // Generate initial AI greeting
  const initialMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Start a friendly conversation with me about ${customTopic || (topic ? topic.name : 'getting to know each other')}. Greet me naturally in ${targetLanguage}.` }
  ];

  try {
    const response = await chatCompletion({
      messages: initialMessages,
      feature: 'conversation'
    });

    // Add AI's greeting
    conversation.messages.push({
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      tokensUsed: {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      }
    });

    // Update token totals
    conversation.totalTokens.input = response.usage.inputTokens;
    conversation.totalTokens.output = response.usage.outputTokens;

    await conversation.save();

    // Track usage
    await trackUsage({
      userId,
      feature: 'conversation',
      tokensUsed: response.usage,
      provider: 'openai'
    });

    return {
      conversation: {
        _id: conversation._id,
        targetLanguage: conversation.targetLanguage,
        cefrLevel: conversation.cefrLevel,
        topic: conversation.topic,
        scenario: conversation.scenario,
        customTopic: conversation.customTopic,
        status: conversation.status,
        settings: conversation.settings,
        startedAt: conversation.startedAt
      },
      initialMessage: {
        role: 'assistant',
        content: response.content,
        timestamp: conversation.messages[conversation.messages.length - 1].timestamp
      }
    };
  } catch (error) {
    // Clean up if AI call fails
    await AIConversation.findByIdAndDelete(conversation._id);
    throw error;
  }
};

/**
 * Send a message in an AI conversation
 * @param {Object} options - Message options
 * @returns {Promise<Object>} AI response
 */
const sendMessage = async (options) => {
  const {
    conversationId,
    userId,
    content,
    responseTime
  } = options;

  const conversation = await AIConversation.findOne({
    _id: conversationId,
    user: userId,
    status: 'active'
  });

  if (!conversation) {
    throw new Error('Conversation not found or not active');
  }

  // Add user message
  const userMessage = {
    role: 'user',
    content,
    timestamp: new Date(),
    responseTime
  };
  conversation.messages.push(userMessage);

  // Get conversation history for context
  const messages = conversation.getMessagesForAI(15);

  try {
    const response = await chatCompletion({
      messages,
      feature: 'conversation'
    });

    // Calculate XP for user message
    let xpAwarded = XP_REWARDS.AI_CONVERSATION_MESSAGE;

    // Add AI response
    const assistantMessage = {
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      tokensUsed: {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      }
    };
    conversation.messages.push(assistantMessage);

    // Update metrics
    conversation.totalTokens.input += response.usage.inputTokens;
    conversation.totalTokens.output += response.usage.outputTokens;
    conversation.xpEarned += xpAwarded;

    // Update user message with XP
    const lastUserMsgIndex = conversation.messages.length - 2;
    conversation.messages[lastUserMsgIndex].xpAwarded = xpAwarded;

    await conversation.save();

    // Track usage
    await trackUsage({
      userId,
      feature: 'conversation',
      tokensUsed: response.usage,
      provider: 'openai'
    });

    return {
      message: {
        role: 'assistant',
        content: response.content,
        timestamp: assistantMessage.timestamp
      },
      xpAwarded,
      messageCount: conversation.messages.length,
      usage: response.usage
    };
  } catch (error) {
    // Remove the user message if AI fails
    conversation.messages.pop();
    await conversation.save();
    throw error;
  }
};

/**
 * Send a message with streaming response
 * @param {Object} options - Message options
 * @param {Function} onChunk - Callback for each chunk
 * @returns {Promise<Object>} Final response
 */
const sendMessageStreaming = async (options, onChunk) => {
  const {
    conversationId,
    userId,
    content,
    responseTime
  } = options;

  const conversation = await AIConversation.findOne({
    _id: conversationId,
    user: userId,
    status: 'active'
  });

  if (!conversation) {
    throw new Error('Conversation not found or not active');
  }

  // Add user message
  conversation.messages.push({
    role: 'user',
    content,
    timestamp: new Date(),
    responseTime
  });

  // Get conversation history
  const messages = conversation.getMessagesForAI(15);

  try {
    const response = await streamChatCompletion({
      messages,
      feature: 'conversation',
      onChunk
    });

    // Calculate XP
    const xpAwarded = XP_REWARDS.AI_CONVERSATION_MESSAGE;

    // Add AI response
    conversation.messages.push({
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      tokensUsed: response.usage
    });

    // Update metrics
    if (response.usage) {
      conversation.totalTokens.input += response.usage.inputTokens || 0;
      conversation.totalTokens.output += response.usage.outputTokens || 0;
    }
    conversation.xpEarned += xpAwarded;

    await conversation.save();

    return {
      message: {
        role: 'assistant',
        content: response.content
      },
      xpAwarded,
      messageCount: conversation.messages.length
    };
  } catch (error) {
    conversation.messages.pop();
    await conversation.save();
    throw error;
  }
};

/**
 * End a conversation
 * @param {String} conversationId - Conversation ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Conversation summary
 */
const endConversation = async (conversationId, userId) => {
  const conversation = await AIConversation.findOne({
    _id: conversationId,
    user: userId
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  await conversation.endConversation('completed');

  // Calculate bonus XP for completing conversation
  let bonusXP = 0;
  const userMessageCount = conversation.performance.userMessages;

  if (userMessageCount >= 10) {
    bonusXP = XP_REWARDS.AI_CONVERSATION_COMPLETE;
  }

  // Check if first conversation
  const conversationCount = await AIConversation.countDocuments({
    user: userId,
    status: 'completed'
  });

  if (conversationCount === 1) {
    bonusXP += XP_REWARDS.AI_CONVERSATION_FIRST;
  }

  if (bonusXP > 0) {
    conversation.xpEarned += bonusXP;
    await conversation.save();
  }

  return {
    summary: {
      _id: conversation._id,
      duration: conversation.duration,
      messageCount: conversation.messages.length,
      userMessageCount,
      xpEarned: conversation.xpEarned,
      bonusXP,
      accuracyRate: conversation.getAccuracyRate(),
      topic: conversation.topic,
      scenario: conversation.scenario
    }
  };
};

/**
 * Get conversation by ID
 * @param {String} conversationId - Conversation ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Conversation
 */
const getConversation = async (conversationId, userId) => {
  const conversation = await AIConversation.findOne({
    _id: conversationId,
    user: userId
  }).lean();

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Filter out system messages for client
  conversation.messages = conversation.messages.filter(m => m.role !== 'system');

  return conversation;
};

/**
 * Get user's conversations
 * @param {String} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Conversations with pagination
 */
const getUserConversations = async (userId, options = {}) => {
  return await AIConversation.getUserConversations(userId, options);
};

/**
 * Get available topics for a level
 * @param {String} cefrLevel - CEFR level
 * @returns {Array} Topics
 */
const getTopics = (cefrLevel = 'A1') => {
  return CONVERSATION_TOPICS[cefrLevel] || CONVERSATION_TOPICS.A1;
};

/**
 * Get available scenarios for a level
 * @param {String} cefrLevel - CEFR level
 * @returns {Array} Scenarios
 */
const getScenarios = (cefrLevel = 'A1') => {
  return PRACTICE_SCENARIOS[cefrLevel] || PRACTICE_SCENARIOS.A1;
};

/**
 * Get user's conversation stats
 * @param {String} userId - User ID
 * @param {String} targetLanguage - Optional language filter
 * @returns {Promise<Object>} Stats
 */
const getUserStats = async (userId, targetLanguage = null) => {
  return await AIConversation.getUserStats(userId, targetLanguage);
};

/**
 * Check user's rate limits
 * @param {String} userId - User ID
 * @param {String} userTier - User tier
 * @returns {Promise<Object>} Rate limit status
 */
const checkRateLimit = async (userId, userTier = 'free') => {
  const limits = AI_RATE_LIMITS[userTier]?.conversation || AI_RATE_LIMITS.free.conversation;

  // Get today's conversation count
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyCount = await AIConversation.countDocuments({
    user: userId,
    createdAt: { $gte: today }
  });

  // Get this month's count
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthlyCount = await AIConversation.countDocuments({
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
  startConversation,
  sendMessage,
  sendMessageStreaming,
  endConversation,
  getConversation,
  getUserConversations,
  getTopics,
  getScenarios,
  getUserStats,
  checkRateLimit
};
