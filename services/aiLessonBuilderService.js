/**
 * AI Lesson Builder Service
 * Generates complete lessons, exercises, and vocabulary using AI
 *
 * Cost-efficient using gpt-4o-mini (~$0.003 per lesson)
 */

const Lesson = require('../models/Lesson');
const LearningProgress = require('../models/LearningProgress');
const {
  chatCompletion,
  parseJSONResponse,
  trackUsage
} = require('./aiProviderService');
const { AI_FEATURES, CEFR_MODIFIERS } = require('../config/aiConfig');

// ============================================================
// LESSON TEMPLATES BY CATEGORY
// ============================================================

const LESSON_TEMPLATES = {
  grammar: {
    contentStructure: [
      { type: 'text', purpose: 'introduction' },
      { type: 'text', purpose: 'rule_explanation' },
      { type: 'example', purpose: 'positive_examples' },
      { type: 'example', purpose: 'negative_examples' },
      { type: 'tip', purpose: 'memory_tip' }
    ],
    exerciseTypes: ['multiple_choice', 'fill_blank', 'translation', 'ordering'],
    exerciseDistribution: { multiple_choice: 3, fill_blank: 3, translation: 2, ordering: 2 }
  },
  vocabulary: {
    contentStructure: [
      { type: 'text', purpose: 'introduction' },
      { type: 'text', purpose: 'vocabulary_list' },
      { type: 'example', purpose: 'usage_examples' },
      { type: 'tip', purpose: 'memory_tip' }
    ],
    exerciseTypes: ['multiple_choice', 'matching', 'translation', 'typing'],
    exerciseDistribution: { multiple_choice: 3, matching: 2, translation: 3, typing: 2 }
  },
  conversation: {
    contentStructure: [
      { type: 'text', purpose: 'scenario_introduction' },
      { type: 'example', purpose: 'dialogue_example' },
      { type: 'text', purpose: 'key_phrases' },
      { type: 'tip', purpose: 'cultural_tip' }
    ],
    exerciseTypes: ['multiple_choice', 'fill_blank', 'ordering', 'translation'],
    exerciseDistribution: { multiple_choice: 3, fill_blank: 3, ordering: 2, translation: 2 }
  },
  pronunciation: {
    contentStructure: [
      { type: 'text', purpose: 'sound_introduction' },
      { type: 'example', purpose: 'pronunciation_examples' },
      { type: 'tip', purpose: 'mouth_position_tip' }
    ],
    exerciseTypes: ['multiple_choice', 'listening', 'speaking'],
    exerciseDistribution: { multiple_choice: 4, listening: 3, speaking: 3 }
  },
  reading: {
    contentStructure: [
      { type: 'text', purpose: 'reading_passage' },
      { type: 'text', purpose: 'vocabulary_notes' }
    ],
    exerciseTypes: ['multiple_choice', 'fill_blank', 'translation'],
    exerciseDistribution: { multiple_choice: 5, fill_blank: 3, translation: 2 }
  },
  listening: {
    contentStructure: [
      { type: 'text', purpose: 'context_introduction' },
      { type: 'audio', purpose: 'listening_content' }
    ],
    exerciseTypes: ['multiple_choice', 'fill_blank', 'typing'],
    exerciseDistribution: { multiple_choice: 5, fill_blank: 3, typing: 2 }
  },
  writing: {
    contentStructure: [
      { type: 'text', purpose: 'writing_introduction' },
      { type: 'example', purpose: 'sample_writing' },
      { type: 'tip', purpose: 'writing_tips' }
    ],
    exerciseTypes: ['translation', 'ordering', 'typing'],
    exerciseDistribution: { translation: 4, ordering: 3, typing: 3 }
  },
  culture: {
    contentStructure: [
      { type: 'text', purpose: 'cultural_introduction' },
      { type: 'text', purpose: 'cultural_details' },
      { type: 'example', purpose: 'cultural_examples' },
      { type: 'tip', purpose: 'dos_and_donts' }
    ],
    exerciseTypes: ['multiple_choice', 'matching', 'fill_blank'],
    exerciseDistribution: { multiple_choice: 5, matching: 3, fill_blank: 2 }
  }
};

// ============================================================
// EXERCISE TYPE ICONS
// ============================================================

const CATEGORY_ICONS = {
  grammar: '📝',
  vocabulary: '📚',
  conversation: '💬',
  pronunciation: '🗣️',
  reading: '📖',
  listening: '🎧',
  writing: '✍️',
  culture: '🌍'
};

// ============================================================
// MAIN FUNCTIONS
// ============================================================

/**
 * Generate a complete lesson with content and exercises
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated lesson
 */
const generateLesson = async (options = {}) => {
  const {
    language,
    nativeLanguage = 'en',
    topic,
    level = 'A1',
    category = 'vocabulary',
    exerciseCount = 10,
    unitNumber,
    unitName,
    generateAudio = false,
    userId
  } = options;

  if (!AI_FEATURES.lessonBuilder) {
    throw new Error('AI lesson builder is not enabled');
  }

  if (!language || !topic) {
    throw new Error('Language and topic are required');
  }

  const startTime = Date.now();
  const cefrModifiers = CEFR_MODIFIERS[level] || CEFR_MODIFIERS.A1;
  const template = LESSON_TEMPLATES[category] || LESSON_TEMPLATES.vocabulary;

  // Build the comprehensive prompt
  const prompt = buildLessonPrompt({
    language,
    nativeLanguage,
    topic,
    level,
    category,
    cefrModifiers,
    template,
    exerciseCount
  });

  try {
    const response = await chatCompletion({
      messages: [{ role: 'user', content: prompt }],
      feature: 'lessonBuilder',
      json: true
    });

    const result = parseJSONResponse(response.content);

    // Validate and sanitize the lesson
    const validatedLesson = validateGeneratedLesson(result, {
      language,
      level,
      category,
      topic,
      template,
      exerciseCount
    });

    // Create slug
    const slug = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
      '-' + Date.now().toString(36);

    // Create the lesson document
    const lesson = await Lesson.create({
      title: validatedLesson.title,
      description: validatedLesson.description,
      slug,
      language,
      level,
      category,
      topic,
      icon: CATEGORY_ICONS[category] || '📚',
      introduction: validatedLesson.introduction,
      content: validatedLesson.content,
      exercises: validatedLesson.exercises,
      xpReward: calculateXPReward(level, exerciseCount),
      perfectBonus: 5,
      estimatedMinutes: Math.ceil(exerciseCount * 1.5),
      unit: unitNumber ? { number: unitNumber, name: unitName || `Unit ${unitNumber}` } : undefined,
      tags: validatedLesson.tags || [topic, category, level],
      isPublished: true,
      publishedAt: new Date(),
      // AI generation metadata
      aiGenerated: {
        isAIGenerated: true,
        generatedAt: new Date(),
        model: 'gpt-4o-mini',
        tokensUsed: response.usage.totalTokens,
        generationTimeMs: Date.now() - startTime,
        prompt: topic
      }
    });

    // Track usage
    if (userId) {
      await trackUsage({
        userId,
        feature: 'lessonBuilder',
        tokensUsed: response.usage,
        provider: 'openai'
      });
    }

    return {
      success: true,
      lesson: {
        _id: lesson._id,
        title: lesson.title,
        description: lesson.description,
        slug: lesson.slug,
        language: lesson.language,
        level: lesson.level,
        category: lesson.category,
        topic: lesson.topic,
        exerciseCount: lesson.exercises.length,
        estimatedMinutes: lesson.estimatedMinutes,
        xpReward: lesson.xpReward
      },
      generation: {
        tokensUsed: response.usage.totalTokens,
        estimatedCost: calculateCost(response.usage),
        timeMs: Date.now() - startTime
      }
    };

  } catch (error) {
    console.error('Lesson generation failed:', error.message);
    throw error;
  }
};

/**
 * Generate exercises for an existing topic
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated exercises
 */
const generateExercises = async (options = {}) => {
  const {
    language,
    nativeLanguage = 'en',
    topic,
    level = 'A1',
    category = 'vocabulary',
    exerciseTypes = ['multiple_choice', 'fill_blank', 'translation'],
    count = 10,
    vocabulary = [],
    context = '',
    userId
  } = options;

  if (!AI_FEATURES.lessonBuilder) {
    throw new Error('AI lesson builder is not enabled');
  }

  const cefrModifiers = CEFR_MODIFIERS[level] || CEFR_MODIFIERS.A1;

  const prompt = buildExercisesPrompt({
    language,
    nativeLanguage,
    topic,
    level,
    category,
    cefrModifiers,
    exerciseTypes,
    count,
    vocabulary,
    context
  });

  const response = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    feature: 'lessonBuilder',
    json: true
  });

  const result = parseJSONResponse(response.content);
  const validatedExercises = validateExercises(result.exercises || [], exerciseTypes);

  if (userId) {
    await trackUsage({
      userId,
      feature: 'lessonBuilder',
      tokensUsed: response.usage,
      provider: 'openai'
    });
  }

  return {
    exercises: validatedExercises,
    count: validatedExercises.length,
    tokensUsed: response.usage.totalTokens,
    estimatedCost: calculateCost(response.usage)
  };
};

/**
 * Generate vocabulary list for a topic
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated vocabulary
 */
const generateVocabulary = async (options = {}) => {
  const {
    language,
    nativeLanguage = 'en',
    topic,
    level = 'A1',
    count = 20,
    includeExamples = true,
    includePronunciation = true,
    userId
  } = options;

  if (!AI_FEATURES.lessonBuilder) {
    throw new Error('AI lesson builder is not enabled');
  }

  const cefrModifiers = CEFR_MODIFIERS[level] || CEFR_MODIFIERS.A1;

  const prompt = `You are a language learning vocabulary expert for ${language}.

Generate a vocabulary list for the topic: "${topic}"
Target level: ${level} (${cefrModifiers.vocabulary})
Native language for translations: ${nativeLanguage}
Number of words: ${count}

For each word, provide:
- word: The word in ${language}
- translation: Translation in ${nativeLanguage}
- partOfSpeech: noun/verb/adjective/adverb/phrase/other
- pronunciation: IPA or phonetic spelling
- examples: 1-2 example sentences with translations
- difficulty: easy/medium/hard

Respond in JSON:
{
  "topic": "${topic}",
  "vocabulary": [
    {
      "word": "<word>",
      "translation": "<translation>",
      "partOfSpeech": "<part of speech>",
      "pronunciation": "<pronunciation>",
      "examples": [
        { "sentence": "<example>", "translation": "<translation>" }
      ],
      "difficulty": "<difficulty>",
      "tags": ["<tag1>", "<tag2>"]
    }
  ]
}

Make vocabulary appropriate for ${level} level:
- ${cefrModifiers.vocabulary}
- ${cefrModifiers.complexity} complexity`;

  const response = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    feature: 'lessonBuilder',
    json: true
  });

  const result = parseJSONResponse(response.content);

  if (userId) {
    await trackUsage({
      userId,
      feature: 'lessonBuilder',
      tokensUsed: response.usage,
      provider: 'openai'
    });
  }

  return {
    topic: result.topic || topic,
    vocabulary: result.vocabulary || [],
    count: result.vocabulary?.length || 0,
    tokensUsed: response.usage.totalTokens,
    estimatedCost: calculateCost(response.usage)
  };
};

/**
 * Generate a complete curriculum (multiple lessons)
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated curriculum
 */
const generateCurriculum = async (options = {}) => {
  const {
    language,
    nativeLanguage = 'en',
    level = 'A1',
    lessonsPerUnit = 5,
    unitsCount = 3,
    categories = ['vocabulary', 'grammar', 'conversation'],
    userId
  } = options;

  if (!AI_FEATURES.lessonBuilder) {
    throw new Error('AI lesson builder is not enabled');
  }

  const cefrModifiers = CEFR_MODIFIERS[level] || CEFR_MODIFIERS.A1;

  // First, generate curriculum structure
  const structurePrompt = `You are a language curriculum designer for ${language} at ${level} level.

Create a structured curriculum with ${unitsCount} units, each containing ${lessonsPerUnit} lessons.
Categories to include: ${categories.join(', ')}

For ${level} level, focus on:
- ${cefrModifiers.vocabulary}
- ${cefrModifiers.grammar}
- ${cefrModifiers.complexity} topics

Respond in JSON:
{
  "curriculumTitle": "<title>",
  "description": "<description>",
  "units": [
    {
      "unitNumber": 1,
      "unitName": "<unit name>",
      "description": "<unit description>",
      "lessons": [
        {
          "topic": "<lesson topic>",
          "category": "<category>",
          "description": "<brief description>",
          "order": 1
        }
      ]
    }
  ]
}

Make it progressive - earlier lessons should be simpler, building to more complex topics.`;

  const structureResponse = await chatCompletion({
    messages: [{ role: 'user', content: structurePrompt }],
    feature: 'lessonBuilder',
    json: true
  });

  const structure = parseJSONResponse(structureResponse.content);

  // Generate each lesson
  const generatedLessons = [];
  let totalTokens = structureResponse.usage.totalTokens;

  for (const unit of structure.units || []) {
    for (const lessonPlan of unit.lessons || []) {
      try {
        const result = await generateLesson({
          language,
          nativeLanguage,
          topic: lessonPlan.topic,
          level,
          category: lessonPlan.category,
          exerciseCount: 10,
          unitNumber: unit.unitNumber,
          unitName: unit.unitName,
          userId
        });

        generatedLessons.push(result.lesson);
        totalTokens += result.generation.tokensUsed;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Failed to generate lesson: ${lessonPlan.topic}`, error.message);
      }
    }
  }

  return {
    curriculum: {
      title: structure.curriculumTitle,
      description: structure.description,
      level,
      language,
      unitsCount: structure.units?.length || 0,
      lessonsCount: generatedLessons.length
    },
    lessons: generatedLessons,
    tokensUsed: totalTokens,
    estimatedCost: calculateCost({ totalTokens })
  };
};

/**
 * Enhance an existing lesson with more content
 * @param {String} lessonId - Lesson ID to enhance
 * @param {Object} options - Enhancement options
 * @returns {Promise<Object>} Enhanced lesson
 */
const enhanceLesson = async (lessonId, options = {}) => {
  const {
    addExercises = 5,
    addContent = true,
    addTips = true,
    userId
  } = options;

  if (!AI_FEATURES.lessonBuilder) {
    throw new Error('AI lesson builder is not enabled');
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  const cefrModifiers = CEFR_MODIFIERS[lesson.level] || CEFR_MODIFIERS.A1;

  const prompt = `You are enhancing an existing ${lesson.language} lesson.

EXISTING LESSON:
Title: ${lesson.title}
Topic: ${lesson.topic}
Category: ${lesson.category}
Level: ${lesson.level}
Current exercises: ${lesson.exercises.length}

CURRENT CONTENT:
${lesson.content.map(c => `${c.type}: ${c.body?.substring(0, 100)}...`).join('\n')}

ENHANCEMENT REQUEST:
${addExercises > 0 ? `- Add ${addExercises} new exercises (different from existing)` : ''}
${addContent ? '- Add 2-3 new content sections (examples, tips)' : ''}
${addTips ? '- Add helpful learning tips' : ''}

Level requirements:
- ${cefrModifiers.vocabulary}
- ${cefrModifiers.complexity}

Respond in JSON:
{
  "newContent": [
    { "type": "example|tip|text", "title": "<title>", "body": "<content>", "translation": "<if applicable>" }
  ],
  "newExercises": [
    {
      "type": "multiple_choice|fill_blank|translation|matching|ordering",
      "question": "<question>",
      "options": [{"text": "<option>", "isCorrect": <boolean>}],
      "correctAnswer": "<answer>",
      "acceptedAnswers": ["<alt1>"],
      "explanation": "<explanation>",
      "hint": "<hint>"
    }
  ],
  "tips": ["<tip1>", "<tip2>"]
}`;

  const response = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    feature: 'lessonBuilder',
    json: true
  });

  const result = parseJSONResponse(response.content);

  // Add new content
  if (result.newContent && result.newContent.length > 0) {
    const startOrder = lesson.content.length;
    result.newContent.forEach((content, index) => {
      lesson.content.push({
        type: content.type,
        title: content.title,
        body: content.body,
        translation: content.translation,
        order: startOrder + index
      });
    });
  }

  // Add new exercises
  if (result.newExercises && result.newExercises.length > 0) {
    const validatedExercises = validateExercises(result.newExercises, null);
    const startOrder = lesson.exercises.length;
    validatedExercises.forEach((exercise, index) => {
      exercise.order = startOrder + index;
      lesson.exercises.push(exercise);
    });
  }

  // Update estimated time
  lesson.estimatedMinutes = Math.ceil(lesson.exercises.length * 1.5);
  lesson.version += 1;

  await lesson.save();

  if (userId) {
    await trackUsage({
      userId,
      feature: 'lessonBuilder',
      tokensUsed: response.usage,
      provider: 'openai'
    });
  }

  return {
    lesson: {
      _id: lesson._id,
      title: lesson.title,
      contentCount: lesson.content.length,
      exerciseCount: lesson.exercises.length,
      version: lesson.version
    },
    added: {
      content: result.newContent?.length || 0,
      exercises: result.newExercises?.length || 0
    },
    tokensUsed: response.usage.totalTokens,
    estimatedCost: calculateCost(response.usage)
  };
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Build the comprehensive lesson generation prompt
 */
const buildLessonPrompt = (options) => {
  const {
    language,
    nativeLanguage,
    topic,
    level,
    category,
    cefrModifiers,
    template,
    exerciseCount
  } = options;

  const exerciseDistribution = template.exerciseDistribution;
  const exerciseTypesStr = Object.entries(exerciseDistribution)
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');

  return `You are an expert language teacher creating a ${language} lesson for ${level} level students.

LESSON REQUIREMENTS:
- Topic: "${topic}"
- Category: ${category}
- Target Language: ${language}
- Native Language: ${nativeLanguage}
- Level: ${level}
- Exercise Count: ${exerciseCount}

LEVEL GUIDELINES (${level}):
- Vocabulary: ${cefrModifiers.vocabulary}
- Grammar: ${cefrModifiers.grammar}
- Response Length: ${cefrModifiers.responseLength}
- Complexity: ${cefrModifiers.complexity}

EXERCISE DISTRIBUTION:
${exerciseTypesStr}

Create a complete lesson with:
1. Title and description
2. Introduction
3. Teaching content (explanations, examples, tips)
4. ${exerciseCount} exercises

Respond in JSON format:
{
  "title": "<engaging lesson title>",
  "description": "<2-3 sentence description>",
  "introduction": "<welcoming introduction explaining what they'll learn>",
  "content": [
    {
      "type": "text|example|tip",
      "title": "<section title>",
      "body": "<content in ${language} with explanations>",
      "translation": "<translation if needed>",
      "order": 0
    }
  ],
  "exercises": [
    {
      "type": "multiple_choice",
      "question": "<question in ${nativeLanguage} or ${language}>",
      "targetText": "<text in ${language} if applicable>",
      "options": [
        {"text": "<option>", "isCorrect": false},
        {"text": "<option>", "isCorrect": true},
        {"text": "<option>", "isCorrect": false},
        {"text": "<option>", "isCorrect": false}
      ],
      "correctAnswer": "<the correct answer>",
      "acceptedAnswers": [],
      "hint": "<helpful hint>",
      "explanation": "<why this is correct>",
      "points": 10,
      "order": 0
    },
    {
      "type": "fill_blank",
      "question": "Complete: Yo ___ (hablar) español.",
      "targetText": "Yo ___ español.",
      "correctAnswer": "hablo",
      "acceptedAnswers": ["hablo"],
      "hint": "<hint>",
      "explanation": "<explanation>",
      "points": 10,
      "order": 1
    },
    {
      "type": "translation",
      "question": "Translate to ${language}:",
      "targetText": "<sentence in ${nativeLanguage}>",
      "correctAnswer": "<correct translation>",
      "acceptedAnswers": ["<alternative translation>"],
      "hint": "<hint>",
      "explanation": "<explanation>",
      "points": 10,
      "order": 2
    },
    {
      "type": "matching",
      "question": "Match the words with their translations:",
      "options": [
        {"text": "<word1>", "matchWith": "<translation1>"},
        {"text": "<word2>", "matchWith": "<translation2>"},
        {"text": "<word3>", "matchWith": "<translation3>"},
        {"text": "<word4>", "matchWith": "<translation4>"}
      ],
      "correctAnswer": [["<word1>", "<translation1>"], ["<word2>", "<translation2>"]],
      "hint": "<hint>",
      "explanation": "<explanation>",
      "points": 10,
      "order": 3
    },
    {
      "type": "ordering",
      "question": "Put the words in the correct order:",
      "targetText": "<jumbled words>",
      "correctAnswer": ["<word1>", "<word2>", "<word3>"],
      "hint": "<hint>",
      "explanation": "<explanation>",
      "points": 10,
      "order": 4
    }
  ],
  "tags": ["<tag1>", "<tag2>", "<tag3>"]
}

IMPORTANT RULES:
1. All content must be appropriate for ${level} level
2. Multiple choice must have exactly 4 options with 1 correct
3. Fill blank must use ___ for the blank
4. Include helpful hints and explanations for all exercises
5. Make exercises progressively challenging
6. Use realistic, practical examples
7. Include cultural context where appropriate`;
};

/**
 * Build exercises generation prompt
 */
const buildExercisesPrompt = (options) => {
  const {
    language,
    nativeLanguage,
    topic,
    level,
    category,
    cefrModifiers,
    exerciseTypes,
    count,
    vocabulary,
    context
  } = options;

  return `You are creating ${language} exercises for ${level} level students.

TOPIC: "${topic}"
CATEGORY: ${category}
EXERCISE TYPES TO USE: ${exerciseTypes.join(', ')}
NUMBER OF EXERCISES: ${count}
${vocabulary.length > 0 ? `VOCABULARY TO USE: ${vocabulary.map(v => v.word || v).join(', ')}` : ''}
${context ? `CONTEXT: ${context}` : ''}

LEVEL GUIDELINES (${level}):
- ${cefrModifiers.vocabulary}
- ${cefrModifiers.complexity}

Generate ${count} exercises. For each type:

MULTIPLE_CHOICE:
{
  "type": "multiple_choice",
  "question": "<question>",
  "options": [{"text": "<opt>", "isCorrect": false}, {"text": "<opt>", "isCorrect": true}, ...],
  "correctAnswer": "<correct option text>",
  "hint": "<hint>",
  "explanation": "<explanation>",
  "points": 10
}

FILL_BLANK:
{
  "type": "fill_blank",
  "question": "<instruction>",
  "targetText": "Sentence with ___ blank",
  "correctAnswer": "<answer>",
  "acceptedAnswers": ["<alt1>", "<alt2>"],
  "hint": "<hint>",
  "explanation": "<explanation>",
  "points": 10
}

TRANSLATION:
{
  "type": "translation",
  "question": "Translate to ${language}:",
  "targetText": "<text to translate>",
  "correctAnswer": "<translation>",
  "acceptedAnswers": ["<alt translation>"],
  "hint": "<hint>",
  "explanation": "<explanation>",
  "points": 10
}

MATCHING:
{
  "type": "matching",
  "question": "Match the pairs:",
  "options": [{"text": "<word>", "matchWith": "<match>"}],
  "correctAnswer": [["<word>", "<match>"]],
  "hint": "<hint>",
  "explanation": "<explanation>",
  "points": 10
}

ORDERING:
{
  "type": "ordering",
  "question": "Put in correct order:",
  "targetText": "<jumbled words>",
  "correctAnswer": ["<word1>", "<word2>", "<word3>"],
  "hint": "<hint>",
  "explanation": "<explanation>",
  "points": 10
}

Respond in JSON:
{
  "exercises": [<exercise objects>]
}`;
};

/**
 * Validate and sanitize generated lesson
 */
const validateGeneratedLesson = (result, options) => {
  const { language, level, category, topic, template, exerciseCount } = options;

  // Validate title
  const title = result.title?.trim() || `${topic} - ${level}`;
  const description = result.description?.trim() || `Learn about ${topic} in ${language}`;
  const introduction = result.introduction?.trim() || `Welcome to this lesson about ${topic}!`;

  // Validate content
  const content = (result.content || [])
    .filter(c => c && c.type && c.body)
    .map((c, index) => ({
      type: ['text', 'example', 'tip', 'image', 'audio', 'video'].includes(c.type) ? c.type : 'text',
      title: c.title?.trim() || '',
      body: c.body?.trim().slice(0, 5000) || '',
      translation: c.translation?.trim() || '',
      order: c.order ?? index
    }));

  // Validate exercises
  const exercises = validateExercises(result.exercises || [], template.exerciseTypes);

  // Validate tags
  const tags = (result.tags || [topic, category, level])
    .filter(t => typeof t === 'string')
    .map(t => t.trim().toLowerCase())
    .slice(0, 10);

  return {
    title,
    description,
    introduction,
    content,
    exercises,
    tags
  };
};

/**
 * Validate exercises array
 */
const validateExercises = (exercises, allowedTypes) => {
  const validTypes = ['multiple_choice', 'fill_blank', 'matching', 'translation', 'ordering', 'listening', 'speaking', 'typing'];

  return exercises
    .filter(ex => {
      if (!ex || !ex.type || !ex.question) return false;
      if (allowedTypes && !allowedTypes.includes(ex.type)) return false;
      if (!validTypes.includes(ex.type)) return false;
      return true;
    })
    .map((ex, index) => {
      const exercise = {
        type: ex.type,
        question: ex.question?.trim().slice(0, 1000) || '',
        targetText: ex.targetText?.trim() || undefined,
        correctAnswer: ex.correctAnswer,
        acceptedAnswers: Array.isArray(ex.acceptedAnswers) ? ex.acceptedAnswers : [],
        hint: ex.hint?.trim().slice(0, 500) || '',
        explanation: ex.explanation?.trim().slice(0, 1000) || '',
        points: ex.points || 10,
        order: ex.order ?? index
      };

      // Validate options for multiple choice
      if (ex.type === 'multiple_choice') {
        exercise.options = (ex.options || [])
          .filter(o => o && o.text)
          .map(o => ({
            text: o.text?.trim() || '',
            isCorrect: !!o.isCorrect
          }));

        // Ensure exactly one correct answer
        const correctCount = exercise.options.filter(o => o.isCorrect).length;
        if (correctCount !== 1 && exercise.options.length >= 2) {
          exercise.options[0].isCorrect = true;
          for (let i = 1; i < exercise.options.length; i++) {
            exercise.options[i].isCorrect = false;
          }
        }

        // Set correctAnswer from options if not set
        if (!exercise.correctAnswer) {
          exercise.correctAnswer = exercise.options.find(o => o.isCorrect)?.text;
        }
      }

      // Validate matching options and add pairs field
      if (ex.type === 'matching') {
        exercise.options = (ex.options || [])
          .filter(o => o && o.text && o.matchWith)
          .map(o => ({
            text: o.text?.trim() || '',
            matchWith: o.matchWith?.trim() || ''
          }));

        // Add pairs array in the format Flutter expects
        exercise.pairs = exercise.options.map(o => ({
          left: o.text,
          right: o.matchWith
        }));

        // Also add matchingPairs as alias
        exercise.matchingPairs = exercise.pairs;
      }

      // Validate ordering exercises - add scrambledItems and correctOrder
      if (ex.type === 'ordering') {
        // Parse correctAnswer to array if it's a string
        let correctOrderArray = [];
        if (Array.isArray(ex.correctAnswer)) {
          correctOrderArray = ex.correctAnswer.map(item =>
            typeof item === 'string' ? item.trim() : String(item)
          );
        } else if (typeof ex.correctAnswer === 'string') {
          // Parse string like "[word1, word2, word3]" or "word1, word2, word3"
          const cleaned = ex.correctAnswer.replace(/^\[|\]$/g, '');
          correctOrderArray = cleaned.split(',').map(item => item.trim());
        }

        // Set correctOrder array
        exercise.correctOrder = correctOrderArray;

        // Create scrambled items (shuffled version of correctOrder)
        exercise.scrambledItems = [...correctOrderArray].sort(() => Math.random() - 0.5);

        // Ensure scrambled is actually different from correct (if more than 1 item)
        if (correctOrderArray.length > 1) {
          let attempts = 0;
          while (
            exercise.scrambledItems.join(',') === exercise.correctOrder.join(',') &&
            attempts < 10
          ) {
            exercise.scrambledItems = [...correctOrderArray].sort(() => Math.random() - 0.5);
            attempts++;
          }
        }

        // Keep correctAnswer as array for consistency
        exercise.correctAnswer = correctOrderArray;
      }

      return exercise;
    });
};

/**
 * Calculate XP reward based on level and exercise count
 */
const calculateXPReward = (level, exerciseCount) => {
  const levelMultiplier = {
    'A1': 1,
    'A2': 1.2,
    'B1': 1.4,
    'B2': 1.6,
    'C1': 1.8,
    'C2': 2
  };

  const baseXP = 15;
  const perExerciseXP = 1;
  const multiplier = levelMultiplier[level] || 1;

  return Math.round((baseXP + (exerciseCount * perExerciseXP)) * multiplier);
};

/**
 * Calculate estimated cost based on token usage
 */
const calculateCost = (usage) => {
  // gpt-4o-mini pricing
  const inputCostPer1K = 0.00015;
  const outputCostPer1K = 0.0006;

  const inputCost = (usage.inputTokens || 0) / 1000 * inputCostPer1K;
  const outputCost = (usage.outputTokens || 0) / 1000 * outputCostPer1K;

  return `$${(inputCost + outputCost).toFixed(6)}`;
};

// ============================================================
// BATCH OPERATIONS
// ============================================================

/**
 * Generate multiple lessons in batch
 * @param {Array} lessonPlans - Array of lesson configurations
 * @param {Object} options - Common options
 * @returns {Promise<Object>} Batch generation results
 */
const batchGenerateLessons = async (lessonPlans, options = {}) => {
  const { userId, delayMs = 500 } = options;

  const results = {
    successful: [],
    failed: [],
    totalTokens: 0,
    totalCost: 0
  };

  for (const plan of lessonPlans) {
    try {
      const result = await generateLesson({
        ...plan,
        userId
      });

      results.successful.push(result.lesson);
      results.totalTokens += result.generation.tokensUsed;

      // Delay between generations
      await new Promise(resolve => setTimeout(resolve, delayMs));

    } catch (error) {
      results.failed.push({
        plan,
        error: error.message
      });
    }
  }

  results.totalCost = `$${(results.totalTokens * 0.0004 / 1000).toFixed(4)}`;

  return results;
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Main functions
  generateLesson,
  generateExercises,
  generateVocabulary,
  generateCurriculum,
  enhanceLesson,
  batchGenerateLessons,

  // Constants
  LESSON_TEMPLATES,
  CATEGORY_ICONS,

  // Helpers (for testing)
  validateExercises,
  calculateXPReward,
  calculateCost
};
