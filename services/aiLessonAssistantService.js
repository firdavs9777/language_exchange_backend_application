/**
 * AI Lesson Assistant Service
 * Provides intelligent assistance during lesson learning
 */

const Lesson = require('../models/Lesson');
const LessonProgress = require('../models/LessonProgress');
const LearningProgress = require('../models/LearningProgress');
const {
  chatCompletion,
  parseJSONResponse,
  trackUsage
} = require('./aiProviderService');
const { AI_FEATURES, CEFR_MODIFIERS } = require('../config/aiConfig');

/**
 * Get a hint for an exercise
 * @param {String} userId - User ID
 * @param {String} lessonId - Lesson ID
 * @param {Number} exerciseIndex - Exercise index
 * @param {Number} hintLevel - Hint level (1-3, higher = more helpful)
 * @returns {Promise<Object>} Hint response
 */
const getExerciseHint = async (userId, lessonId, exerciseIndex, hintLevel = 1) => {
  if (!AI_FEATURES.lessonAssistant) {
    throw new Error('AI lesson assistant is not enabled');
  }

  // Get lesson and exercise
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  const exercise = lesson.exercises[exerciseIndex];
  if (!exercise) {
    throw new Error('Exercise not found');
  }

  // Get user's learning context
  const learningProgress = await LearningProgress.findOne({ user: userId });
  const proficiencyLevel = learningProgress?.proficiencyLevel || 'A1';
  const cefrModifiers = CEFR_MODIFIERS[proficiencyLevel];

  // Build hint prompt based on level
  const hintPrompt = buildHintPrompt(exercise, hintLevel, lesson.language, proficiencyLevel, cefrModifiers);

  const response = await chatCompletion({
    messages: [{ role: 'user', content: hintPrompt }],
    feature: 'lessonAssistant',
    json: true
  });

  const result = parseJSONResponse(response.content);

  // Track usage
  await trackUsage({
    userId,
    feature: 'lessonAssistant',
    tokensUsed: response.usage,
    provider: 'openai'
  });

  return {
    hint: result.hint,
    hintLevel,
    hasMoreHints: hintLevel < 3,
    encouragement: result.encouragement
  };
};

/**
 * Build hint prompt based on exercise type and hint level
 */
const buildHintPrompt = (exercise, hintLevel, language, proficiencyLevel, cefrModifiers) => {
  const hintStrength = {
    1: 'Give a subtle hint without revealing the answer. Point them in the right direction.',
    2: 'Give a more helpful hint. You can mention the type of answer or narrow down options.',
    3: 'Give a strong hint that almost reveals the answer, but still requires them to think.'
  };

  return `You are a friendly language learning assistant helping a ${proficiencyLevel} level student with ${language}.

EXERCISE TYPE: ${exercise.type}
QUESTION: ${exercise.question}
${exercise.targetText ? `TARGET TEXT: ${exercise.targetText}` : ''}
${exercise.options ? `OPTIONS: ${exercise.options.map(o => o.text).join(', ')}` : ''}
CORRECT ANSWER: ${exercise.correctAnswer}

HINT LEVEL: ${hintLevel}/3
HINT INSTRUCTION: ${hintStrength[hintLevel]}

USER LEVEL: ${proficiencyLevel}
- Use ${cefrModifiers.vocabulary}
- Keep explanations ${cefrModifiers.complexity}

Respond in JSON:
{
  "hint": "<your hint in the user's learning language>",
  "encouragement": "<brief encouraging message>"
}

IMPORTANT: Never reveal the exact answer. Help them discover it themselves.`;
};

/**
 * Explain a concept from the lesson
 * @param {String} userId - User ID
 * @param {String} lessonId - Lesson ID
 * @param {String} concept - Concept to explain (word, grammar rule, etc.)
 * @param {String} context - Additional context
 * @returns {Promise<Object>} Explanation response
 */
const explainConcept = async (userId, lessonId, concept, context = '') => {
  if (!AI_FEATURES.lessonAssistant) {
    throw new Error('AI lesson assistant is not enabled');
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  // Get user's learning context
  const learningProgress = await LearningProgress.findOne({ user: userId });
  const proficiencyLevel = learningProgress?.proficiencyLevel || 'A1';
  const cefrModifiers = CEFR_MODIFIERS[proficiencyLevel];
  const nativeLanguage = learningProgress?.nativeLanguage || 'en';

  const prompt = `You are a language learning assistant helping a ${proficiencyLevel} level student learn ${lesson.language}.

LESSON TOPIC: ${lesson.topic}
LESSON CATEGORY: ${lesson.category}
CONCEPT TO EXPLAIN: "${concept}"
${context ? `CONTEXT: ${context}` : ''}

USER LEVEL: ${proficiencyLevel}
- Use ${cefrModifiers.vocabulary}
- Keep explanations ${cefrModifiers.complexity}
- Response length: ${cefrModifiers.responseLength}

Respond in JSON:
{
  "explanation": "<clear explanation of the concept>",
  "examples": [
    {
      "sentence": "<example sentence in ${lesson.language}>",
      "translation": "<translation to ${nativeLanguage}>"
    }
  ],
  "tip": "<helpful learning tip>",
  "relatedConcepts": ["<related concept 1>", "<related concept 2>"]
}

Keep the explanation simple and appropriate for ${proficiencyLevel} level.`;

  const response = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    feature: 'lessonAssistant',
    json: true
  });

  const result = parseJSONResponse(response.content);

  // Track usage
  await trackUsage({
    userId,
    feature: 'lessonAssistant',
    tokensUsed: response.usage,
    provider: 'openai'
  });

  return {
    concept,
    explanation: result.explanation,
    examples: result.examples || [],
    tip: result.tip,
    relatedConcepts: result.relatedConcepts || []
  };
};

/**
 * Get feedback on a wrong answer
 * @param {String} userId - User ID
 * @param {String} lessonId - Lesson ID
 * @param {Number} exerciseIndex - Exercise index
 * @param {String|Array} userAnswer - User's incorrect answer
 * @returns {Promise<Object>} Feedback response
 */
const getAnswerFeedback = async (userId, lessonId, exerciseIndex, userAnswer) => {
  if (!AI_FEATURES.lessonAssistant) {
    throw new Error('AI lesson assistant is not enabled');
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  const exercise = lesson.exercises[exerciseIndex];
  if (!exercise) {
    throw new Error('Exercise not found');
  }

  // Get user's learning context
  const learningProgress = await LearningProgress.findOne({ user: userId });
  const proficiencyLevel = learningProgress?.proficiencyLevel || 'A1';
  const cefrModifiers = CEFR_MODIFIERS[proficiencyLevel];

  const prompt = `You are a supportive language learning assistant helping a ${proficiencyLevel} level student with ${lesson.language}.

EXERCISE TYPE: ${exercise.type}
QUESTION: ${exercise.question}
${exercise.targetText ? `TARGET TEXT: ${exercise.targetText}` : ''}
USER'S ANSWER: ${JSON.stringify(userAnswer)}
CORRECT ANSWER: ${exercise.correctAnswer}
${exercise.acceptedAnswers ? `ALSO ACCEPTED: ${exercise.acceptedAnswers.join(', ')}` : ''}

USER LEVEL: ${proficiencyLevel}
- Use ${cefrModifiers.vocabulary}
- Keep explanations ${cefrModifiers.complexity}

Analyze why the user's answer is incorrect and provide helpful feedback.

Respond in JSON:
{
  "feedback": "<explain why their answer is incorrect>",
  "correction": "<show the correct form>",
  "explanation": "<brief grammar/vocabulary explanation if relevant>",
  "commonMistake": "<if this is a common mistake, mention it>",
  "encouragement": "<encouraging message to keep trying>"
}

Be supportive and constructive, not discouraging.`;

  const response = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    feature: 'lessonAssistant',
    json: true
  });

  const result = parseJSONResponse(response.content);

  // Track usage
  await trackUsage({
    userId,
    feature: 'lessonAssistant',
    tokensUsed: response.usage,
    provider: 'openai'
  });

  return {
    userAnswer,
    correctAnswer: exercise.correctAnswer,
    feedback: result.feedback,
    correction: result.correction,
    explanation: result.explanation,
    commonMistake: result.commonMistake,
    encouragement: result.encouragement
  };
};

/**
 * Get translation help for text in the lesson
 * @param {String} userId - User ID
 * @param {String} text - Text to translate
 * @param {String} sourceLanguage - Source language
 * @param {String} targetLanguage - Target language
 * @param {String} context - Context for better translation
 * @returns {Promise<Object>} Translation response
 */
const getTranslationHelp = async (userId, text, sourceLanguage, targetLanguage, context = '') => {
  if (!AI_FEATURES.lessonAssistant) {
    throw new Error('AI lesson assistant is not enabled');
  }

  // Get user's learning context
  const learningProgress = await LearningProgress.findOne({ user: userId });
  const proficiencyLevel = learningProgress?.proficiencyLevel || 'A1';
  const cefrModifiers = CEFR_MODIFIERS[proficiencyLevel];

  const prompt = `You are a language learning translation assistant.

TEXT TO TRANSLATE: "${text}"
FROM: ${sourceLanguage}
TO: ${targetLanguage}
${context ? `CONTEXT: ${context}` : ''}

USER LEVEL: ${proficiencyLevel}

Provide a translation with learning-focused explanations.

Respond in JSON:
{
  "translation": "<translated text>",
  "literal": "<literal word-by-word translation if helpful>",
  "breakdown": [
    {
      "word": "<word from original>",
      "translation": "<translation>",
      "note": "<grammar note if relevant>"
    }
  ],
  "alternatives": ["<alternative translation 1>"],
  "culturalNote": "<cultural context if relevant, otherwise null>"
}`;

  const response = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    feature: 'lessonAssistant',
    json: true
  });

  const result = parseJSONResponse(response.content);

  // Track usage
  await trackUsage({
    userId,
    feature: 'lessonAssistant',
    tokensUsed: response.usage,
    provider: 'openai'
  });

  return {
    originalText: text,
    sourceLanguage,
    targetLanguage,
    translation: result.translation,
    literal: result.literal,
    breakdown: result.breakdown || [],
    alternatives: result.alternatives || [],
    culturalNote: result.culturalNote
  };
};

/**
 * Ask the AI assistant a question about the lesson
 * @param {String} userId - User ID
 * @param {String} lessonId - Lesson ID
 * @param {String} question - User's question
 * @returns {Promise<Object>} Answer response
 */
const askQuestion = async (userId, lessonId, question) => {
  if (!AI_FEATURES.lessonAssistant) {
    throw new Error('AI lesson assistant is not enabled');
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  // Get user's learning context and progress
  const [learningProgress, lessonProgress] = await Promise.all([
    LearningProgress.findOne({ user: userId }),
    LessonProgress.findOne({ user: userId, lesson: lessonId })
  ]);

  const proficiencyLevel = learningProgress?.proficiencyLevel || 'A1';
  const cefrModifiers = CEFR_MODIFIERS[proficiencyLevel];

  // Build lesson context
  const lessonContext = lesson.content.map(c => {
    if (c.type === 'text' || c.type === 'example' || c.type === 'tip') {
      return `${c.type.toUpperCase()}: ${c.body}`;
    }
    return null;
  }).filter(Boolean).join('\n');

  const prompt = `You are a helpful language learning assistant. A ${proficiencyLevel} level student is learning ${lesson.language} and has a question about the current lesson.

LESSON TITLE: ${lesson.title}
LESSON TOPIC: ${lesson.topic}
LESSON CATEGORY: ${lesson.category}

LESSON CONTENT:
${lessonContext.slice(0, 2000)}

STUDENT'S QUESTION: "${question}"

USER LEVEL: ${proficiencyLevel}
- Use ${cefrModifiers.vocabulary}
- Keep explanations ${cefrModifiers.complexity}
- Response length: ${cefrModifiers.responseLength}

Respond in JSON:
{
  "answer": "<direct answer to their question>",
  "examples": [
    {
      "sentence": "<example if helpful>",
      "translation": "<translation>"
    }
  ],
  "additionalInfo": "<any additional helpful information>",
  "suggestedFocus": "<what they should focus on next>"
}

Keep the answer helpful, concise, and appropriate for their level.`;

  const response = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    feature: 'lessonAssistant',
    json: true
  });

  const result = parseJSONResponse(response.content);

  // Track usage
  await trackUsage({
    userId,
    feature: 'lessonAssistant',
    tokensUsed: response.usage,
    provider: 'openai'
  });

  return {
    question,
    answer: result.answer,
    examples: result.examples || [],
    additionalInfo: result.additionalInfo,
    suggestedFocus: result.suggestedFocus
  };
};

/**
 * Generate practice variations for an exercise
 * @param {String} userId - User ID
 * @param {String} lessonId - Lesson ID
 * @param {Number} exerciseIndex - Exercise index
 * @param {Number} count - Number of variations to generate
 * @returns {Promise<Object>} Practice variations
 */
const generatePracticeVariations = async (userId, lessonId, exerciseIndex, count = 3) => {
  if (!AI_FEATURES.lessonAssistant) {
    throw new Error('AI lesson assistant is not enabled');
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  const exercise = lesson.exercises[exerciseIndex];
  if (!exercise) {
    throw new Error('Exercise not found');
  }

  // Get user's learning context
  const learningProgress = await LearningProgress.findOne({ user: userId });
  const proficiencyLevel = learningProgress?.proficiencyLevel || 'A1';
  const cefrModifiers = CEFR_MODIFIERS[proficiencyLevel];

  const prompt = `You are a language learning exercise creator for ${lesson.language}.

ORIGINAL EXERCISE:
Type: ${exercise.type}
Question: ${exercise.question}
${exercise.targetText ? `Target Text: ${exercise.targetText}` : ''}
Correct Answer: ${exercise.correctAnswer}
${exercise.options ? `Options: ${JSON.stringify(exercise.options)}` : ''}

LESSON TOPIC: ${lesson.topic}
USER LEVEL: ${proficiencyLevel}

Generate ${count} similar practice exercises that test the same concept but with different content.

Respond in JSON:
{
  "variations": [
    {
      "type": "${exercise.type}",
      "question": "<new question>",
      "targetText": "<target text if applicable>",
      "options": [{"text": "<option>", "isCorrect": <boolean>}],
      "correctAnswer": "<correct answer>",
      "acceptedAnswers": ["<alternative answers>"],
      "explanation": "<brief explanation>"
    }
  ]
}

Make sure:
- Exercises match ${proficiencyLevel} level (${cefrModifiers.complexity})
- Use ${cefrModifiers.vocabulary}
- Each variation tests the same grammar/vocabulary concept
- Multiple choice has exactly 4 options with 1 correct`;

  const response = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    feature: 'lessonAssistant',
    json: true
  });

  const result = parseJSONResponse(response.content);

  // Track usage
  await trackUsage({
    userId,
    feature: 'lessonAssistant',
    tokensUsed: response.usage,
    provider: 'openai'
  });

  return {
    originalExercise: {
      type: exercise.type,
      question: exercise.question
    },
    variations: result.variations || []
  };
};

/**
 * Get a lesson summary/review
 * @param {String} userId - User ID
 * @param {String} lessonId - Lesson ID
 * @returns {Promise<Object>} Lesson summary
 */
const getLessonSummary = async (userId, lessonId) => {
  if (!AI_FEATURES.lessonAssistant) {
    throw new Error('AI lesson assistant is not enabled');
  }

  const [lesson, lessonProgress, learningProgress] = await Promise.all([
    Lesson.findById(lessonId),
    LessonProgress.findOne({ user: userId, lesson: lessonId }),
    LearningProgress.findOne({ user: userId })
  ]);

  if (!lesson) {
    throw new Error('Lesson not found');
  }

  const proficiencyLevel = learningProgress?.proficiencyLevel || 'A1';
  const cefrModifiers = CEFR_MODIFIERS[proficiencyLevel];

  // Build lesson content summary
  const lessonContent = lesson.content.map(c => {
    if (c.type === 'text' || c.type === 'example') {
      return c.body;
    }
    return null;
  }).filter(Boolean).join('\n');

  // Get user's performance
  const wrongAnswers = lessonProgress?.answers?.filter(a => !a.isCorrect) || [];

  const prompt = `You are a language learning assistant creating a lesson summary for a ${proficiencyLevel} level student learning ${lesson.language}.

LESSON: ${lesson.title}
TOPIC: ${lesson.topic}
CATEGORY: ${lesson.category}

LESSON CONTENT:
${lessonContent.slice(0, 2000)}

${wrongAnswers.length > 0 ? `USER'S MISTAKES: ${wrongAnswers.length} incorrect answers` : 'USER PERFORMANCE: No mistakes!'}

USER LEVEL: ${proficiencyLevel}
- Use ${cefrModifiers.vocabulary}
- Keep it ${cefrModifiers.complexity}

Create a concise lesson summary.

Respond in JSON:
{
  "summary": "<brief summary of what was learned>",
  "keyPoints": ["<key point 1>", "<key point 2>", "<key point 3>"],
  "vocabularyToRemember": [
    {
      "word": "<important word>",
      "translation": "<translation>",
      "usage": "<brief usage note>"
    }
  ],
  "grammarRules": ["<grammar rule if applicable>"],
  "practiceRecommendation": "<what to practice next>",
  "encouragement": "<personalized encouragement based on performance>"
}`;

  const response = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    feature: 'lessonAssistant',
    json: true
  });

  const result = parseJSONResponse(response.content);

  // Track usage
  await trackUsage({
    userId,
    feature: 'lessonAssistant',
    tokensUsed: response.usage,
    provider: 'openai'
  });

  return {
    lessonTitle: lesson.title,
    lessonTopic: lesson.topic,
    summary: result.summary,
    keyPoints: result.keyPoints || [],
    vocabularyToRemember: result.vocabularyToRemember || [],
    grammarRules: result.grammarRules || [],
    practiceRecommendation: result.practiceRecommendation,
    encouragement: result.encouragement,
    userScore: lessonProgress?.score,
    isPerfect: lessonProgress?.isPerfect
  };
};

module.exports = {
  getExerciseHint,
  explainConcept,
  getAnswerFeedback,
  getTranslationHelp,
  askQuestion,
  generatePracticeVariations,
  getLessonSummary
};
