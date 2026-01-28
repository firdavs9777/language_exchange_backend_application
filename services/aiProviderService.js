/**
 * AI Provider Service
 * Abstraction layer for OpenAI API
 * Handles all AI-related API calls with rate limiting, error handling, and retries
 */

const { AI_PROVIDERS, AI_RATE_LIMITS, CEFR_MODIFIERS } = require('../config/aiConfig');

// Lazy load OpenAI to avoid initialization issues if not configured
let openaiClient = null;

/**
 * Get OpenAI client (lazy initialization)
 */
const getOpenAIClient = () => {
  if (!openaiClient) {
    const OpenAI = require('openai');

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openaiClient;
};

/**
 * Sleep utility for retry logic
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Send a chat completion request to OpenAI
 * @param {Object} options - Request options
 * @param {Array} options.messages - Array of message objects
 * @param {String} options.feature - Feature name for config (conversation, grammarFeedback, etc.)
 * @param {Number} options.maxTokens - Override max tokens
 * @param {Number} options.temperature - Override temperature
 * @param {Boolean} options.json - Request JSON response format
 * @returns {Promise<Object>} Response with content and usage
 */
const chatCompletion = async (options) => {
  const {
    messages,
    feature = 'conversation',
    maxTokens,
    temperature,
    json = false
  } = options;

  const openai = getOpenAIClient();
  const config = AI_PROVIDERS.openai;

  const requestOptions = {
    model: config.models.chat,
    messages,
    max_tokens: maxTokens || config.maxTokens[feature] || 1024,
    temperature: temperature ?? config.temperature[feature] ?? 0.7
  };

  if (json) {
    requestOptions.response_format = { type: 'json_object' };
  }

  let lastError;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create(requestOptions);

      return {
        content: response.choices[0].message.content,
        usage: {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        },
        finishReason: response.choices[0].finish_reason,
        model: response.model
      };
    } catch (error) {
      lastError = error;

      // Rate limit - exponential backoff
      if (error.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`OpenAI rate limit hit, waiting ${waitTime}ms before retry`);
        await sleep(waitTime);
        continue;
      }

      // Server errors - retry with backoff
      if (error.status >= 500) {
        const waitTime = Math.pow(2, attempt) * 500;
        console.warn(`OpenAI server error, waiting ${waitTime}ms before retry`);
        await sleep(waitTime);
        continue;
      }

      // Client errors - don't retry
      throw error;
    }
  }

  throw lastError;
};

/**
 * Stream a chat completion response
 * @param {Object} options - Request options
 * @param {Array} options.messages - Array of message objects
 * @param {String} options.feature - Feature name for config
 * @param {Function} options.onChunk - Callback for each chunk
 * @param {Function} options.onComplete - Callback when complete
 * @returns {Promise<Object>} Final response
 */
const streamChatCompletion = async (options) => {
  const {
    messages,
    feature = 'conversation',
    maxTokens,
    temperature,
    onChunk,
    onComplete
  } = options;

  const openai = getOpenAIClient();
  const config = AI_PROVIDERS.openai;

  const stream = await openai.chat.completions.create({
    model: config.models.chat,
    messages,
    max_tokens: maxTokens || config.maxTokens[feature] || 1024,
    temperature: temperature ?? config.temperature[feature] ?? 0.7,
    stream: true
  });

  let fullContent = '';
  let usage = null;

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullContent += content;
      if (onChunk) {
        onChunk(content, fullContent);
      }
    }

    // Capture usage from final chunk
    if (chunk.usage) {
      usage = {
        inputTokens: chunk.usage.prompt_tokens,
        outputTokens: chunk.usage.completion_tokens,
        totalTokens: chunk.usage.total_tokens
      };
    }
  }

  const result = {
    content: fullContent,
    usage,
    finishReason: 'stop'
  };

  if (onComplete) {
    onComplete(result);
  }

  return result;
};

/**
 * Generate text-to-speech audio
 * @param {Object} options - TTS options
 * @param {String} options.text - Text to convert to speech
 * @param {String} options.voice - Voice to use (alloy, echo, fable, onyx, nova, shimmer)
 * @param {Number} options.speed - Speed multiplier (0.25 to 4.0)
 * @param {String} options.format - Output format (mp3, opus, aac, flac)
 * @returns {Promise<Buffer>} Audio buffer
 */
const textToSpeech = async (options) => {
  const {
    text,
    voice = 'nova',
    speed = 1.0,
    format = 'mp3'
  } = options;

  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for TTS');
  }

  if (text.length > 4096) {
    throw new Error('Text exceeds maximum length of 4096 characters');
  }

  const openai = getOpenAIClient();
  const config = AI_PROVIDERS.openai;

  const response = await openai.audio.speech.create({
    model: config.models.tts,
    input: text,
    voice,
    speed: Math.max(0.25, Math.min(4.0, speed)),
    response_format: format
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
};

/**
 * Transcribe audio to text using Whisper
 * @param {Object} options - STT options
 * @param {Buffer|Stream} options.audio - Audio data
 * @param {String} options.filename - Filename with extension
 * @param {String} options.language - Language hint (optional)
 * @param {String} options.prompt - Context prompt (optional)
 * @returns {Promise<Object>} Transcription result
 */
const speechToText = async (options) => {
  const {
    audio,
    filename = 'audio.webm',
    language,
    prompt
  } = options;

  if (!audio) {
    throw new Error('Audio data is required for STT');
  }

  const openai = getOpenAIClient();
  const config = AI_PROVIDERS.openai;

  // Create a File object from the buffer
  const file = new File([audio], filename, {
    type: getMimeType(filename)
  });

  const requestOptions = {
    model: config.models.stt,
    file
  };

  if (language) {
    requestOptions.language = language;
  }

  if (prompt) {
    requestOptions.prompt = prompt;
  }

  const response = await openai.audio.transcriptions.create(requestOptions);

  return {
    text: response.text,
    language: response.language || language
  };
};

/**
 * Get MIME type from filename
 */
const getMimeType = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  const mimeTypes = {
    'mp3': 'audio/mpeg',
    'mp4': 'audio/mp4',
    'm4a': 'audio/m4a',
    'wav': 'audio/wav',
    'webm': 'audio/webm',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac'
  };
  return mimeTypes[ext] || 'audio/mpeg';
};

/**
 * Build system prompt for AI conversation partner
 * @param {Object} options - Prompt options
 * @param {String} options.cefrLevel - User's CEFR level (A1-C2)
 * @param {String} options.targetLanguage - Language being learned
 * @param {String} options.nativeLanguage - User's native language
 * @param {String} options.topic - Conversation topic
 * @param {String} options.scenario - Practice scenario (optional)
 * @returns {String} System prompt
 */
const buildConversationSystemPrompt = (options) => {
  const {
    cefrLevel = 'A1',
    targetLanguage,
    nativeLanguage = 'English',
    topic,
    scenario
  } = options;

  const modifiers = CEFR_MODIFIERS[cefrLevel] || CEFR_MODIFIERS.A1;

  let prompt = `You are a friendly and patient language learning partner helping a ${cefrLevel} level student practice ${targetLanguage}.

YOUR ROLE:
- Have natural, encouraging conversations in ${targetLanguage}
- Adapt your vocabulary and grammar to ${cefrLevel} level
- Gently correct mistakes by naturally rephrasing in your responses
- Ask follow-up questions to keep the conversation flowing
- Introduce new vocabulary gradually with context clues
- Be supportive and patient - learning is a journey!

GUIDELINES FOR ${cefrLevel} LEVEL:
- Vocabulary: ${modifiers.vocabulary}
- Grammar: ${modifiers.grammar}
- Response length: ${modifiers.responseLength}
- Complexity: ${modifiers.complexity}
- Speaking pace: ${modifiers.speed}`;

  if (topic) {
    prompt += `\n\nCURRENT TOPIC: ${topic}`;
  }

  if (scenario) {
    prompt += `\n\nSCENARIO: ${scenario}
You are role-playing this scenario. Stay in character while helping the student practice.`;
  }

  prompt += `\n\nIMPORTANT:
- If the student makes an error, subtly model the correct form in your response
- Respond primarily in ${targetLanguage}
- If the student seems stuck, you may briefly explain in ${nativeLanguage}
- Keep responses ${modifiers.responseLength}
- Never break character as a friendly conversation partner`;

  return prompt;
};

/**
 * Build system prompt for grammar feedback
 * @param {Object} options - Prompt options
 * @param {String} options.targetLanguage - Language of the text
 * @param {String} options.nativeLanguage - User's native language for explanations
 * @param {String} options.cefrLevel - User's level
 * @returns {String} System prompt
 */
const buildGrammarFeedbackPrompt = (options) => {
  const {
    targetLanguage,
    nativeLanguage = 'English',
    cefrLevel = 'A1'
  } = options;

  return `You are an expert ${targetLanguage} language teacher analyzing text written by a ${cefrLevel} level learner whose native language is ${nativeLanguage}.

Analyze the provided text and return a JSON response with:

{
  "overallScore": <number 0-100>,
  "errors": [
    {
      "type": "<grammar|spelling|vocabulary|style|punctuation>",
      "severity": "<minor|moderate|major>",
      "originalSegment": "<the incorrect text>",
      "correctedSegment": "<the correction>",
      "startIndex": <position in text>,
      "explanation": "<brief explanation in ${nativeLanguage}>",
      "rule": "<the grammar rule>",
      "examples": ["<example 1>", "<example 2>"]
    }
  ],
  "suggestions": [
    {
      "type": "<improvement|alternative|native_speaker>",
      "text": "<suggested text>",
      "explanation": "<why this is better>"
    }
  ],
  "positives": ["<something they did well>"],
  "summary": "<brief encouraging summary in ${nativeLanguage}>"
}

GUIDELINES:
- Be encouraging but thorough
- Explain WHY things are wrong, not just what
- Tailor explanations to ${cefrLevel} level understanding
- Include at least one positive observation
- Keep explanations in ${nativeLanguage} for clarity`;
};

/**
 * Build prompt for lesson recommendations
 * @param {Object} context - User learning context
 * @returns {String} System prompt
 */
const buildRecommendationPrompt = (context) => {
  return `You are an expert language learning advisor. Analyze the student's profile and recommend personalized lessons.

STUDENT PROFILE:
- Target Language: ${context.targetLanguage}
- Current Level: ${context.proficiencyLevel}
- Lessons Completed: ${context.lessonsCompleted}
- Average Score: ${context.averageScore}%
- Learning Streak: ${context.currentStreak} days

WEAK AREAS:
${context.weakAreas.map(w => `- ${w.topic} (${w.category}): ${w.mistakeRate}% error rate`).join('\n')}

AVAILABLE LESSONS:
${context.availableLessons.map(l => `- ID: ${l._id} | ${l.title} | Category: ${l.category} | Topic: ${l.topic}`).join('\n')}

Return a JSON response with:
{
  "recommendations": [
    {
      "lessonId": "<lesson _id>",
      "score": <relevance 0-100>,
      "reasons": ["<reason 1>", "<reason 2>"],
      "priority": <1-10>,
      "type": "<weak_area|next_in_sequence|refresh|goal_aligned>"
    }
  ],
  "learningInsight": "<personalized insight about their progress>"
}

GUIDELINES:
- Prioritize lessons that address weak areas
- Consider spaced repetition (topics not practiced recently)
- Balance challenge with achievability
- Mix categories for variety
- Return top 10 recommendations`;
};

/**
 * Build prompt for quiz generation
 * @param {Object} context - Quiz generation context
 * @returns {String} System prompt
 */
const buildQuizGenerationPrompt = (context) => {
  const isBeginnerQuiz = context.isBeginnerQuiz || context.vocabulary.length === 0;

  const vocabularySection = isBeginnerQuiz
    ? `VOCABULARY TO TEST:
(No saved vocabulary - generate questions using common beginner ${context.targetLanguage} vocabulary appropriate for ${context.proficiencyLevel} level. Include basic greetings, numbers, colors, common nouns, and simple phrases.)`
    : `VOCABULARY TO TEST:
${context.vocabulary.map(v => `- "${v.word}" (${v.translation})`).join('\n')}`;

  return `You are a language learning quiz creator for ${context.targetLanguage}.

USER LEVEL: ${context.proficiencyLevel}
NATIVE LANGUAGE: ${context.nativeLanguage}

FOCUS AREAS:
${context.focusAreas.map(f => `- ${f.topic}: mastery ${f.masteryScore}%`).join('\n')}

${vocabularySection}

Generate exactly ${context.questionCount} questions in JSON format:
{
  "title": "<quiz title>",
  "questions": [
    {
      "type": "<multiple_choice|fill_blank|translation|matching>",
      "question": "<question text>",
      "targetText": "<text in target language if applicable>",
      "options": [{"text": "<option>", "isCorrect": <boolean>}],
      "correctAnswer": "<the answer>",
      "acceptedAnswers": ["<alternative 1>"],
      "explanation": "<educational explanation>",
      "difficulty": "<easy|medium|hard>",
      "tags": ["<topic>", "<category>"]
    }
  ]
}

REQUIREMENTS:
- Multiple choice: 4 options, exactly 1 correct
- Fill blank: use ___ for blank, provide accepted alternatives
- Avoid trick questions
- Make explanations educational
- Difficulty should match ${context.proficiencyLevel} level`;
};

/**
 * Build prompt for pronunciation feedback
 * @param {Object} options - Pronunciation context
 * @returns {String} System prompt
 */
const buildPronunciationFeedbackPrompt = (options) => {
  const { targetText, transcription, language, basicMetrics } = options;

  return `You are an expert pronunciation coach for ${language}. Analyze the student's pronunciation attempt.

TARGET TEXT: "${targetText}"
STUDENT SAID: "${transcription}"

BASIC METRICS:
- Overall: ${basicMetrics.overall}%
- Accuracy: ${basicMetrics.accuracy}%
- Fluency: ${basicMetrics.fluency}%
- Completeness: ${basicMetrics.completeness}%

Provide detailed feedback in JSON format:
{
  "score": {
    "overall": <0-100 refined score>,
    "accuracy": <0-100>,
    "fluency": <0-100>,
    "completeness": <0-100>
  },
  "wordScores": [
    {
      "word": "<word>",
      "score": <0-100>,
      "feedback": "<specific feedback for this word>"
    }
  ],
  "summary": "<encouraging summary of their attempt>",
  "improvements": ["<specific improvement tip 1>", "<tip 2>"],
  "strengths": ["<what they did well>"]
}

GUIDELINES:
- Be encouraging while providing constructive feedback
- Focus on the most impactful improvements
- Note specific sounds or patterns they struggled with
- Recognize what they did well
- Provide actionable tips for improvement`;
};

/**
 * Build prompt for enhanced translation
 * @param {Object} options - Translation options
 * @returns {String} System prompt
 */
const buildEnhancedTranslationPrompt = (options) => {
  const { sourceLanguage, targetLanguage, nativeLanguage } = options;

  return `You are an expert translator and language teacher. Provide enhanced translations with educational context.

SOURCE LANGUAGE: ${sourceLanguage}
TARGET LANGUAGE: ${targetLanguage}
EXPLANATION LANGUAGE: ${nativeLanguage || 'English'}

Return a JSON response:
{
  "translation": "<primary translation>",
  "alternatives": [
    {
      "text": "<alternative translation>",
      "context": "<when to use this>",
      "formality": "<formal|neutral|informal|slang>"
    }
  ],
  "breakdown": [
    {
      "original": "<word/phrase>",
      "translated": "<translation>",
      "partOfSpeech": "<noun|verb|etc>",
      "notes": "<usage notes>"
    }
  ],
  "grammar": [
    {
      "aspect": "<grammar point>",
      "sourceRule": "<how it works in source language>",
      "targetRule": "<how it works in target language>",
      "example": "<example>"
    }
  ],
  "idioms": [
    {
      "original": "<idiomatic expression>",
      "meaning": "<what it means>",
      "equivalent": "<equivalent in target language>",
      "literal": "<literal translation>"
    }
  ],
  "cultural": {
    "notes": "<cultural context if relevant>",
    "formality": "<formality level>",
    "region": "<regional specificity if any>"
  },
  "analysis": {
    "isIdiom": <boolean>,
    "isSlang": <boolean>,
    "isInformal": <boolean>,
    "tone": "<detected tone>",
    "complexity": "<simple|moderate|complex>"
  }
}

GUIDELINES:
- Provide natural, contextually appropriate translations
- Identify and explain idioms
- Note grammar differences between languages
- Include cultural context when relevant
- Offer formal and informal alternatives when applicable`;
};

/**
 * Parse JSON response from AI safely
 * @param {String} content - Response content
 * @returns {Object} Parsed JSON
 */
const parseJSONResponse = (content) => {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse AI JSON response:', error.message);
    throw new Error('Invalid JSON response from AI');
  }
};

/**
 * Check user's AI usage limits
 * @param {String} userId - User ID
 * @param {String} feature - Feature name
 * @param {String} userTier - User tier (free, regular, vip)
 * @returns {Promise<Object>} Usage status
 */
const checkUsageLimit = async (userId, feature, userTier = 'free') => {
  // This would typically check against a database
  // For now, return a simple structure
  const limits = AI_RATE_LIMITS[userTier]?.[feature] || AI_RATE_LIMITS.free[feature];

  return {
    allowed: true,
    dailyLimit: limits.perDay,
    monthlyLimit: limits.perMonth,
    dailyUsed: 0,
    monthlyUsed: 0,
    remaining: {
      daily: limits.perDay,
      monthly: limits.perMonth
    }
  };
};

/**
 * Track AI usage for a user
 * @param {Object} options - Usage options
 */
const trackUsage = async (options) => {
  const {
    userId,
    feature,
    tokensUsed,
    provider = 'openai'
  } = options;

  // This would typically save to a database
  // For now, just log
  console.log(`AI Usage: User ${userId}, Feature: ${feature}, Tokens: ${JSON.stringify(tokensUsed)}`);
};

module.exports = {
  // Core API methods
  chatCompletion,
  streamChatCompletion,
  textToSpeech,
  speechToText,

  // Prompt builders
  buildConversationSystemPrompt,
  buildGrammarFeedbackPrompt,
  buildRecommendationPrompt,
  buildQuizGenerationPrompt,
  buildPronunciationFeedbackPrompt,
  buildEnhancedTranslationPrompt,

  // Utilities
  parseJSONResponse,
  checkUsageLimit,
  trackUsage,
  getOpenAIClient
};
