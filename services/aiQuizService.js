/**
 * AI Quiz Service
 * Handles AI-generated quiz creation and management
 */

const AIGeneratedQuiz = require('../models/AIGeneratedQuiz');
const Vocabulary = require('../models/Vocabulary');
const LearningProgress = require('../models/LearningProgress');
const {
  chatCompletion,
  buildQuizGenerationPrompt,
  parseJSONResponse,
  trackUsage
} = require('./aiProviderService');
const { identifyWeakAreas } = require('./recommendationService');
const { XP_REWARDS } = require('../config/xpRewards');
const { AI_FEATURES, CACHE_TTL, QUIZ_SETTINGS } = require('../config/aiConfig');

/**
 * Generate a practice quiz based on user's weak areas
 * @param {String} userId - User ID
 * @param {Object} options - Quiz options
 * @returns {Promise<Object>} Generated quiz
 */
const generatePracticeQuiz = async (userId, options = {}) => {
  const {
    type = 'weak_areas',
    questionCount = QUIZ_SETTINGS.defaultQuestions,
    difficulty = 'adaptive',
    focusAreas = [],
    vocabularyIds = [],
    language
  } = options;

  if (!AI_FEATURES.quizGeneration) {
    throw new Error('AI quiz generation is not enabled');
  }

  const startTime = Date.now();

  // Get user's learning context
  const learningProgress = await LearningProgress.findOne({ user: userId });
  const targetLanguage = language || learningProgress?.targetLanguage || 'es';
  const proficiencyLevel = learningProgress?.proficiencyLevel || 'A1';
  const nativeLanguage = 'en'; // Could be fetched from user profile

  // Gather content for quiz generation
  let quizContext = {
    targetLanguage,
    proficiencyLevel,
    nativeLanguage,
    questionCount: Math.min(questionCount, QUIZ_SETTINGS.maxQuestions),
    focusAreas: [],
    vocabulary: []
  };

  // Get focus areas based on type
  if (type === 'weak_areas') {
    const weakAreas = await identifyWeakAreas(userId);
    quizContext.focusAreas = weakAreas.map(w => ({
      topic: w.topic,
      category: w.category,
      masteryScore: Math.round(w.score * 100)
    }));
  } else if (type === 'vocabulary' && vocabularyIds.length > 0) {
    // Get specific vocabulary
    const vocab = await Vocabulary.find({
      _id: { $in: vocabularyIds },
      user: userId
    }).lean();
    quizContext.vocabulary = vocab.map(v => ({
      word: v.word,
      translation: v.translation,
      srsLevel: v.srsLevel
    }));
    quizContext.focusAreas = [{ topic: 'vocabulary', category: 'vocabulary', masteryScore: 50 }];
  } else if (type === 'recent_content') {
    // Get recently learned vocabulary
    const recentVocab = await Vocabulary.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    quizContext.vocabulary = recentVocab.map(v => ({
      word: v.word,
      translation: v.translation,
      srsLevel: v.srsLevel
    }));
    quizContext.focusAreas = [{ topic: 'recent', category: 'mixed', masteryScore: 60 }];
  } else {
    // Mixed - get weak vocabulary
    const weakVocab = await Vocabulary.find({
      user: userId,
      srsLevel: { $lt: 4 }
    })
      .sort({ srsLevel: 1 })
      .limit(15)
      .lean();
    quizContext.vocabulary = weakVocab.map(v => ({
      word: v.word,
      translation: v.translation,
      srsLevel: v.srsLevel
    }));

    const weakAreas = await identifyWeakAreas(userId);
    quizContext.focusAreas = weakAreas.slice(0, 3).map(w => ({
      topic: w.topic,
      category: w.category,
      masteryScore: Math.round(w.score * 100)
    }));
  }

  // Add custom focus areas if provided
  if (focusAreas.length > 0) {
    quizContext.focusAreas = focusAreas.map(f => ({
      topic: f,
      category: 'custom',
      masteryScore: 50
    }));
  }

  // If no content to quiz on, generate a beginner-friendly quiz
  if (quizContext.focusAreas.length === 0 && quizContext.vocabulary.length === 0) {
    // Fallback for new users - generate a general language quiz
    quizContext.focusAreas = [{
      topic: 'basics',
      category: 'beginner',
      masteryScore: 0
    }];
    quizContext.isBeginnerQuiz = true;
  }

  try {
    // Build and send prompt
    const prompt = buildQuizGenerationPrompt(quizContext);

    const response = await chatCompletion({
      messages: [{ role: 'user', content: prompt }],
      feature: 'quizGeneration',
      json: true
    });

    const result = parseJSONResponse(response.content);

    // Validate and sanitize questions
    const validatedQuestions = validateQuizQuestions(result.questions || []);

    if (validatedQuestions.length === 0) {
      throw new Error('Failed to generate valid quiz questions');
    }

    // Calculate expiry
    const expiresAt = new Date(Date.now() + CACHE_TTL.aiQuiz);

    // Create quiz
    const quiz = await AIGeneratedQuiz.create({
      user: userId,
      language: targetLanguage,
      proficiencyLevel,
      title: result.title || `Practice Quiz: ${quizContext.focusAreas[0]?.topic || 'Mixed'}`,
      description: result.description || 'AI-generated practice quiz targeting your weak areas',
      targetAreas: quizContext.focusAreas.map(f => ({
        type: f.category === 'vocabulary' ? 'vocabulary' : 'grammar',
        identifier: f.topic,
        weaknessScore: (100 - f.masteryScore) / 100
      })),
      sourceVocabulary: vocabularyIds,
      questions: validatedQuestions,
      settings: {
        questionCount: validatedQuestions.length,
        difficulty,
        shuffleQuestions: true,
        shuffleOptions: true
      },
      estimatedMinutes: Math.ceil(validatedQuestions.length * 0.5),
      xpReward: XP_REWARDS.COMPLETE_AI_QUIZ,
      expiresAt,
      tokensUsed: {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      },
      generationTimeMs: Date.now() - startTime
    });

    // Track usage
    await trackUsage({
      userId,
      feature: 'quizGeneration',
      tokensUsed: response.usage,
      provider: 'openai'
    });

    return {
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.questions.length,
        estimatedMinutes: quiz.estimatedMinutes,
        targetAreas: quiz.targetAreas,
        difficulty: quiz.settings.difficulty,
        xpReward: quiz.xpReward,
        expiresAt: quiz.expiresAt
      },
      message: 'Quiz generated successfully'
    };
  } catch (error) {
    console.error('Quiz generation failed:', error.message);
    throw error;
  }
};

/**
 * Validate and sanitize quiz questions
 */
const validateQuizQuestions = (questions) => {
  const validQuestions = [];

  for (const q of questions) {
    // Skip invalid questions
    if (!q.question || !q.type) continue;

    const validQuestion = {
      type: q.type,
      question: sanitizeText(q.question),
      targetText: q.targetText ? sanitizeText(q.targetText) : undefined,
      explanation: q.explanation ? sanitizeText(q.explanation) : '',
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
      points: q.points || 10,
      tags: Array.isArray(q.tags) ? q.tags : []
    };

    // Validate based on type
    if (q.type === 'multiple_choice') {
      if (!Array.isArray(q.options) || q.options.length < 2) continue;

      // Ensure exactly one correct answer
      const correctCount = q.options.filter(o => o.isCorrect).length;
      if (correctCount !== 1) continue;

      validQuestion.options = q.options.map(o => ({
        text: sanitizeText(o.text),
        isCorrect: !!o.isCorrect
      }));
      validQuestion.correctAnswer = q.options.find(o => o.isCorrect)?.text;
    } else if (q.type === 'fill_blank') {
      if (!q.correctAnswer) continue;
      validQuestion.correctAnswer = sanitizeText(q.correctAnswer);
      validQuestion.acceptedAnswers = Array.isArray(q.acceptedAnswers)
        ? q.acceptedAnswers.map(sanitizeText)
        : [validQuestion.correctAnswer];
    } else if (q.type === 'translation') {
      if (!q.correctAnswer) continue;
      validQuestion.correctAnswer = sanitizeText(q.correctAnswer);
      validQuestion.acceptedAnswers = Array.isArray(q.acceptedAnswers)
        ? q.acceptedAnswers.map(sanitizeText)
        : [validQuestion.correctAnswer];
    } else if (q.type === 'matching') {
      if (!Array.isArray(q.pairs) || q.pairs.length < 2) continue;
      validQuestion.correctAnswer = q.pairs;
    } else {
      continue; // Skip unknown types
    }

    validQuestions.push(validQuestion);
  }

  return validQuestions;
};

/**
 * Sanitize text content
 */
const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, 1000);
};

/**
 * Get quiz by ID
 */
const getQuiz = async (quizId, userId) => {
  const quiz = await AIGeneratedQuiz.findOne({
    _id: quizId,
    user: userId
  });

  if (!quiz) {
    throw new Error('Quiz not found');
  }

  return quiz;
};

/**
 * Start a quiz attempt
 */
const startQuiz = async (quizId, userId) => {
  const quiz = await AIGeneratedQuiz.findOne({
    _id: quizId,
    user: userId
  });

  if (!quiz) {
    throw new Error('Quiz not found');
  }

  if (!quiz.isValid()) {
    throw new Error('Quiz has expired');
  }

  await quiz.start();

  // Return quiz without answers
  const quizData = quiz.toObject();
  quizData.questions = quizData.questions.map(q => {
    const { correctAnswer, acceptedAnswers, ...rest } = q;
    return rest;
  });

  return {
    quiz: quizData,
    attemptNumber: quiz.attemptCount
  };
};

/**
 * Submit an answer for a quiz question
 */
const submitAnswer = async (quizId, userId, questionIndex, answer) => {
  const quiz = await AIGeneratedQuiz.findOne({
    _id: quizId,
    user: userId
  });

  if (!quiz) {
    throw new Error('Quiz not found');
  }

  if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
    throw new Error('Invalid question index');
  }

  const question = quiz.questions[questionIndex];
  let isCorrect = false;

  // Check answer based on question type
  if (question.type === 'multiple_choice') {
    isCorrect = answer === question.correctAnswer;
  } else if (question.type === 'fill_blank' || question.type === 'translation') {
    const normalizedAnswer = answer.toLowerCase().trim();
    const acceptedAnswers = [
      question.correctAnswer,
      ...(question.acceptedAnswers || [])
    ].map(a => a.toLowerCase().trim());
    isCorrect = acceptedAnswers.includes(normalizedAnswer);
  } else if (question.type === 'matching') {
    // Compare pairs
    isCorrect = JSON.stringify(answer) === JSON.stringify(question.correctAnswer);
  }

  return {
    isCorrect,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    points: isCorrect ? question.points : 0
  };
};

/**
 * Complete a quiz and calculate results
 */
const completeQuiz = async (quizId, userId, answers, timeSpent) => {
  const quiz = await AIGeneratedQuiz.findOne({
    _id: quizId,
    user: userId
  });

  if (!quiz) {
    throw new Error('Quiz not found');
  }

  // Calculate score
  let correctCount = 0;
  let totalPoints = 0;
  let earnedPoints = 0;
  const results = [];

  for (let i = 0; i < quiz.questions.length; i++) {
    const question = quiz.questions[i];
    const userAnswer = answers[i];
    totalPoints += question.points;

    let isCorrect = false;

    if (question.type === 'multiple_choice') {
      isCorrect = userAnswer === question.correctAnswer;
    } else if (question.type === 'fill_blank' || question.type === 'translation') {
      const normalizedAnswer = (userAnswer || '').toLowerCase().trim();
      const acceptedAnswers = [
        question.correctAnswer,
        ...(question.acceptedAnswers || [])
      ].map(a => a.toLowerCase().trim());
      isCorrect = acceptedAnswers.includes(normalizedAnswer);
    }

    if (isCorrect) {
      correctCount++;
      earnedPoints += question.points;
    }

    results.push({
      questionIndex: i,
      isCorrect,
      correctAnswer: question.correctAnswer,
      userAnswer,
      points: isCorrect ? question.points : 0
    });
  }

  const score = Math.round((earnedPoints / totalPoints) * 100);
  const isPerfect = correctCount === quiz.questions.length;

  // Calculate XP
  let xpAwarded = quiz.xpReward;
  if (isPerfect) {
    xpAwarded += XP_REWARDS.PERFECT_AI_QUIZ_BONUS;
  }

  // Update quiz
  await quiz.complete(score);

  return {
    score,
    totalPoints,
    earnedPoints,
    correctCount,
    totalQuestions: quiz.questions.length,
    isPerfect,
    xpAwarded,
    results,
    timeSpent
  };
};

/**
 * Get user's pending quizzes
 */
const getPendingQuizzes = async (userId, limit = 5) => {
  return await AIGeneratedQuiz.getPendingQuizzes(userId, limit);
};

/**
 * Get user's quiz stats
 */
const getUserStats = async (userId) => {
  return await AIGeneratedQuiz.getUserStats(userId);
};

module.exports = {
  generatePracticeQuiz,
  getQuiz,
  startQuiz,
  submitAnswer,
  completeQuiz,
  getPendingQuizzes,
  getUserStats
};
