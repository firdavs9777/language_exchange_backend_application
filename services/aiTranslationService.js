/**
 * AI Translation Service
 * Handles enhanced translations with educational context
 */

const EnhancedTranslation = require('../models/EnhancedTranslation');
const {
  chatCompletion,
  buildEnhancedTranslationPrompt,
  parseJSONResponse,
  trackUsage
} = require('./aiProviderService');
const { AI_FEATURES, CACHE_TTL } = require('../config/aiConfig');
const { XP_REWARDS } = require('../config/xpRewards');

/**
 * Get enhanced translation with explanations
 * @param {Object} options - Translation options
 * @returns {Promise<Object>} Translation with context
 */
const getEnhancedTranslation = async (options) => {
  const {
    text,
    sourceLanguage,
    targetLanguage,
    nativeLanguage,
    userId,
    includeBreakdown = true,
    includeGrammar = true,
    includeIdioms = true
  } = options;

  if (!AI_FEATURES.aiTranslation) {
    throw new Error('AI translation is not enabled');
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for translation');
  }

  if (text.length > 5000) {
    throw new Error('Text exceeds maximum length of 5000 characters');
  }

  // Check cache first
  const cached = await EnhancedTranslation.getCached(text, sourceLanguage, targetLanguage);
  if (cached) {
    return {
      translation: cached.translation,
      alternatives: cached.alternatives,
      breakdown: includeBreakdown ? cached.breakdown : [],
      grammar: includeGrammar ? cached.grammar : [],
      idioms: includeIdioms ? cached.idioms : [],
      cultural: cached.cultural,
      analysis: cached.analysis,
      cached: true,
      usageCount: cached.usageCount
    };
  }

  const startTime = Date.now();

  try {
    // Build prompt
    const systemPrompt = buildEnhancedTranslationPrompt({
      sourceLanguage,
      targetLanguage,
      nativeLanguage
    });

    const response = await chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Translate and analyze: "${text}"` }
      ],
      feature: 'translation',
      json: true
    });

    const result = parseJSONResponse(response.content);

    // Save to cache
    await EnhancedTranslation.saveToCache({
      sourceText: text,
      sourceLanguage,
      targetLanguage,
      translation: result.translation,
      alternatives: result.alternatives || [],
      breakdown: result.breakdown || [],
      grammar: result.grammar || [],
      idioms: result.idioms || [],
      cultural: result.cultural || {},
      analysis: result.analysis || {},
      tokensUsed: {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      },
      provider: 'openai'
    });

    // Track usage
    if (userId) {
      await trackUsage({
        userId,
        feature: 'translation',
        tokensUsed: response.usage,
        provider: 'openai'
      });
    }

    return {
      translation: result.translation,
      alternatives: result.alternatives || [],
      breakdown: includeBreakdown ? (result.breakdown || []) : [],
      grammar: includeGrammar ? (result.grammar || []) : [],
      idioms: includeIdioms ? (result.idioms || []) : [],
      cultural: result.cultural || {},
      analysis: result.analysis || {},
      cached: false,
      processingTimeMs: Date.now() - startTime
    };
  } catch (error) {
    console.error('Enhanced translation failed:', error.message);
    throw error;
  }
};

/**
 * Detect and explain idioms in text
 * @param {Object} options - Detection options
 * @returns {Promise<Object>} Idioms with explanations
 */
const detectIdioms = async (options) => {
  const {
    text,
    sourceLanguage,
    targetLanguage,
    userId
  } = options;

  if (!AI_FEATURES.aiTranslation) {
    throw new Error('AI translation is not enabled');
  }

  try {
    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are an expert linguist. Identify and explain any idioms, expressions, or figures of speech in the given ${sourceLanguage} text.

Return a JSON response:
{
  "idioms": [
    {
      "expression": "<the idiom>",
      "meaning": "<what it means>",
      "literal": "<literal translation to ${targetLanguage}>",
      "equivalent": "<equivalent expression in ${targetLanguage} if exists>",
      "usage": "<when/how to use it>",
      "origin": "<origin if known>",
      "formality": "<formal|neutral|informal|slang>"
    }
  ],
  "hasIdioms": <boolean>,
  "summary": "<brief summary of findings>"
}`
        },
        { role: 'user', content: `Analyze for idioms: "${text}"` }
      ],
      feature: 'translation',
      json: true
    });

    const result = parseJSONResponse(response.content);

    // Track usage
    if (userId) {
      await trackUsage({
        userId,
        feature: 'idiomDetection',
        tokensUsed: response.usage,
        provider: 'openai'
      });
    }

    return {
      idioms: result.idioms || [],
      hasIdioms: result.hasIdioms || false,
      summary: result.summary || 'No idioms detected'
    };
  } catch (error) {
    console.error('Idiom detection failed:', error.message);
    throw error;
  }
};

/**
 * Explain grammar differences between languages
 * @param {Object} options - Grammar options
 * @returns {Promise<Object>} Grammar explanations
 */
const explainGrammarDifferences = async (options) => {
  const {
    text,
    sourceLanguage,
    targetLanguage,
    nativeLanguage = 'English',
    userId
  } = options;

  if (!AI_FEATURES.aiTranslation) {
    throw new Error('AI translation is not enabled');
  }

  try {
    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are a language teacher explaining grammar differences between ${sourceLanguage} and ${targetLanguage}. Explain in ${nativeLanguage}.

Analyze the given text and explain:
1. Word order differences
2. Verb conjugation/tense usage
3. Gender/number agreement
4. Article usage
5. Preposition differences
6. Any other notable grammatical features

Return a JSON response:
{
  "translation": "<translated text>",
  "grammarPoints": [
    {
      "category": "<word_order|verb|agreement|articles|prepositions|other>",
      "sourceExample": "<example from source>",
      "targetExample": "<equivalent in target>",
      "explanation": "<clear explanation>",
      "tip": "<learning tip>"
    }
  ],
  "summary": "<overall grammar comparison>",
  "difficulty": "<easy|medium|hard>"
}`
        },
        { role: 'user', content: `Explain grammar for: "${text}"` }
      ],
      feature: 'translation',
      json: true
    });

    const result = parseJSONResponse(response.content);

    // Track usage
    if (userId) {
      await trackUsage({
        userId,
        feature: 'grammarExplanation',
        tokensUsed: response.usage,
        provider: 'openai'
      });
    }

    return {
      translation: result.translation,
      grammarPoints: result.grammarPoints || [],
      summary: result.summary,
      difficulty: result.difficulty || 'medium'
    };
  } catch (error) {
    console.error('Grammar explanation failed:', error.message);
    throw error;
  }
};

/**
 * Get alternative translations with context
 * @param {Object} options - Translation options
 * @returns {Promise<Object>} Alternative translations
 */
const getAlternativeTranslations = async (options) => {
  const {
    text,
    sourceLanguage,
    targetLanguage,
    context,
    userId
  } = options;

  if (!AI_FEATURES.aiTranslation) {
    throw new Error('AI translation is not enabled');
  }

  try {
    let contextPrompt = '';
    if (context) {
      contextPrompt = `\n\nCONTEXT: ${context}`;
    }

    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are an expert translator providing multiple translation options from ${sourceLanguage} to ${targetLanguage}.

Provide translations for different contexts and formality levels.${contextPrompt}

Return a JSON response:
{
  "primaryTranslation": "<best general translation>",
  "alternatives": [
    {
      "text": "<translation>",
      "formality": "<formal|neutral|informal|slang>",
      "context": "<when to use this version>",
      "region": "<regional preference if any>",
      "nuance": "<subtle difference in meaning>"
    }
  ],
  "recommendation": "<which to use and why based on context>"
}`
        },
        { role: 'user', content: `Provide alternatives for: "${text}"` }
      ],
      feature: 'translation',
      json: true
    });

    const result = parseJSONResponse(response.content);

    // Track usage
    if (userId) {
      await trackUsage({
        userId,
        feature: 'alternativeTranslations',
        tokensUsed: response.usage,
        provider: 'openai'
      });
    }

    return {
      primaryTranslation: result.primaryTranslation,
      alternatives: result.alternatives || [],
      recommendation: result.recommendation
    };
  } catch (error) {
    console.error('Alternative translations failed:', error.message);
    throw error;
  }
};

/**
 * Context-aware translation
 * @param {Object} options - Translation options
 * @returns {Promise<Object>} Contextual translation
 */
const getContextualTranslation = async (options) => {
  const {
    text,
    sourceLanguage,
    targetLanguage,
    context,
    tone,
    audience,
    userId
  } = options;

  if (!AI_FEATURES.aiTranslation) {
    throw new Error('AI translation is not enabled');
  }

  try {
    let contextDescription = '';
    if (context) contextDescription += `Context: ${context}\n`;
    if (tone) contextDescription += `Desired tone: ${tone}\n`;
    if (audience) contextDescription += `Target audience: ${audience}\n`;

    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are an expert translator specializing in context-aware translations from ${sourceLanguage} to ${targetLanguage}.

${contextDescription}

Adapt the translation to fit the specified context, tone, and audience while maintaining accuracy.

Return a JSON response:
{
  "translation": "<contextually appropriate translation>",
  "adaptations": [
    {
      "original": "<original element>",
      "adapted": "<how it was adapted>",
      "reason": "<why this adaptation>"
    }
  ],
  "toneAnalysis": {
    "original": "<detected tone of source>",
    "target": "<tone of translation>",
    "adjustments": "<what was changed to match tone>"
  },
  "culturalNotes": "<any cultural considerations>",
  "confidence": <0-100 how confident in this translation>
}`
        },
        { role: 'user', content: `Translate with context: "${text}"` }
      ],
      feature: 'translation',
      json: true
    });

    const result = parseJSONResponse(response.content);

    // Track usage
    if (userId) {
      await trackUsage({
        userId,
        feature: 'contextualTranslation',
        tokensUsed: response.usage,
        provider: 'openai'
      });
    }

    return {
      translation: result.translation,
      adaptations: result.adaptations || [],
      toneAnalysis: result.toneAnalysis || {},
      culturalNotes: result.culturalNotes,
      confidence: result.confidence || 80
    };
  } catch (error) {
    console.error('Contextual translation failed:', error.message);
    throw error;
  }
};

/**
 * Get translation cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
const getCacheStats = async () => {
  return await EnhancedTranslation.getStats();
};

/**
 * Get popular translations for a language
 * @param {String} language - Target language
 * @param {Number} limit - Number of results
 * @returns {Promise<Array>} Popular translations
 */
const getPopularTranslations = async (language, limit = 10) => {
  return await EnhancedTranslation.getPopular(language, limit);
};

module.exports = {
  getEnhancedTranslation,
  detectIdioms,
  explainGrammarDifferences,
  getAlternativeTranslations,
  getContextualTranslation,
  getCacheStats,
  getPopularTranslations
};
