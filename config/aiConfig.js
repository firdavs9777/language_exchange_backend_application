/**
 * AI Configuration
 * Centralized configuration for all AI-powered features
 */

const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: {
      chat: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      tts: process.env.OPENAI_TTS_MODEL || 'tts-1',
      stt: process.env.OPENAI_WHISPER_MODEL || 'whisper-1'
    },
    maxTokens: {
      conversation: 1024,
      grammarFeedback: 1500,
      recommendation: 2000,
      quizGeneration: 2500,
      translation: 1500,
      pronunciationFeedback: 1000,
      lessonAssistant: 1500,
      lessonBuilder: 4000
    },
    temperature: {
      conversation: 0.7,
      grammarFeedback: 0.3,
      recommendation: 0.4,
      quizGeneration: 0.5,
      translation: 0.3,
      pronunciationFeedback: 0.3,
      lessonAssistant: 0.4,
      lessonBuilder: 0.6
    }
  }
};

/**
 * Rate Limits by User Tier
 */
const AI_RATE_LIMITS = {
  free: {
    conversation: { perDay: 20, perMonth: 200 },
    grammarFeedback: { perDay: 10, perMonth: 100 },
    recommendation: { perDay: 10, perMonth: 100 },
    quizGeneration: { perDay: 5, perMonth: 50 },
    tts: { perDay: 50, perMonth: 500 },
    stt: { perDay: 20, perMonth: 200 },
    translation: { perDay: 30, perMonth: 300 },
    lessonAssistant: { perDay: 30, perMonth: 300 },
    lessonBuilder: { perDay: 5, perMonth: 50 }
  },
  regular: {
    conversation: { perDay: 50, perMonth: 500 },
    grammarFeedback: { perDay: 30, perMonth: 300 },
    recommendation: { perDay: 20, perMonth: 200 },
    quizGeneration: { perDay: 15, perMonth: 150 },
    tts: { perDay: 100, perMonth: 1000 },
    stt: { perDay: 50, perMonth: 500 },
    translation: { perDay: 50, perMonth: 500 },
    lessonAssistant: { perDay: 100, perMonth: 1000 },
    lessonBuilder: { perDay: 20, perMonth: 200 }
  },
  vip: {
    conversation: { perDay: -1, perMonth: -1 },
    grammarFeedback: { perDay: -1, perMonth: -1 },
    recommendation: { perDay: -1, perMonth: -1 },
    quizGeneration: { perDay: -1, perMonth: -1 },
    tts: { perDay: -1, perMonth: -1 },
    stt: { perDay: -1, perMonth: -1 },
    translation: { perDay: -1, perMonth: -1 },
    lessonAssistant: { perDay: -1, perMonth: -1 },
    lessonBuilder: { perDay: -1, perMonth: -1 }
  }
};

/**
 * CEFR Level Modifiers for AI Prompts
 */
const CEFR_MODIFIERS = {
  A1: {
    vocabulary: 'basic, everyday words only',
    grammar: 'simple present and past tense, basic sentence structures',
    responseLength: 'short (1-2 sentences)',
    complexity: 'very simple',
    speed: 'slow and clear'
  },
  A2: {
    vocabulary: 'common everyday vocabulary',
    grammar: 'present, past, and future tenses, simple connectors',
    responseLength: 'short to medium (2-3 sentences)',
    complexity: 'simple',
    speed: 'moderate'
  },
  B1: {
    vocabulary: 'intermediate vocabulary with some idioms',
    grammar: 'most common tenses, conditional structures',
    responseLength: 'medium (3-4 sentences)',
    complexity: 'moderate',
    speed: 'normal'
  },
  B2: {
    vocabulary: 'varied vocabulary including abstract concepts',
    grammar: 'complex structures, passive voice, reported speech',
    responseLength: 'medium to long (4-5 sentences)',
    complexity: 'moderate to complex',
    speed: 'normal to fast'
  },
  C1: {
    vocabulary: 'advanced vocabulary, idioms, and expressions',
    grammar: 'nuanced grammar, all structures',
    responseLength: 'natural length as needed',
    complexity: 'complex',
    speed: 'native-like'
  },
  C2: {
    vocabulary: 'sophisticated, native-like vocabulary',
    grammar: 'full range of grammatical structures',
    responseLength: 'natural, unrestricted',
    complexity: 'native-level',
    speed: 'native'
  }
};

/**
 * Conversation Topics by Level
 */
const CONVERSATION_TOPICS = {
  A1: [
    { id: 'greetings', name: 'Greetings & Introductions', icon: 'hand-wave' },
    { id: 'family', name: 'Family & Friends', icon: 'users' },
    { id: 'numbers', name: 'Numbers & Counting', icon: 'hash' },
    { id: 'colors', name: 'Colors & Shapes', icon: 'palette' },
    { id: 'food_basic', name: 'Basic Food & Drinks', icon: 'utensils' },
    { id: 'daily_routine', name: 'Daily Routine', icon: 'clock' }
  ],
  A2: [
    { id: 'shopping', name: 'Shopping', icon: 'shopping-bag' },
    { id: 'directions', name: 'Asking for Directions', icon: 'map' },
    { id: 'hobbies', name: 'Hobbies & Interests', icon: 'heart' },
    { id: 'weather', name: 'Weather', icon: 'cloud' },
    { id: 'restaurant', name: 'At a Restaurant', icon: 'utensils' },
    { id: 'travel_basic', name: 'Basic Travel', icon: 'plane' }
  ],
  B1: [
    { id: 'work', name: 'Work & Career', icon: 'briefcase' },
    { id: 'health', name: 'Health & Wellness', icon: 'heart-pulse' },
    { id: 'travel', name: 'Travel & Tourism', icon: 'globe' },
    { id: 'culture', name: 'Culture & Traditions', icon: 'landmark' },
    { id: 'technology', name: 'Technology', icon: 'laptop' },
    { id: 'education', name: 'Education', icon: 'graduation-cap' }
  ],
  B2: [
    { id: 'current_events', name: 'Current Events', icon: 'newspaper' },
    { id: 'environment', name: 'Environment', icon: 'leaf' },
    { id: 'business', name: 'Business & Economy', icon: 'chart-line' },
    { id: 'arts', name: 'Arts & Entertainment', icon: 'palette' },
    { id: 'society', name: 'Society & Social Issues', icon: 'users' },
    { id: 'science', name: 'Science & Innovation', icon: 'flask' }
  ],
  C1: [
    { id: 'philosophy', name: 'Philosophy & Ethics', icon: 'lightbulb' },
    { id: 'politics', name: 'Politics & Government', icon: 'landmark' },
    { id: 'literature', name: 'Literature & Writing', icon: 'book' },
    { id: 'psychology', name: 'Psychology & Behavior', icon: 'brain' },
    { id: 'history', name: 'History & Historical Events', icon: 'scroll' },
    { id: 'debate', name: 'Debate & Argumentation', icon: 'message-square' }
  ],
  C2: [
    { id: 'any', name: 'Any Topic (Native Conversation)', icon: 'message-circle' },
    { id: 'abstract', name: 'Abstract Concepts', icon: 'cloud' },
    { id: 'specialized', name: 'Specialized Topics', icon: 'star' },
    { id: 'humor', name: 'Humor & Wordplay', icon: 'smile' },
    { id: 'nuance', name: 'Nuanced Discussions', icon: 'layers' }
  ]
};

/**
 * Practice Scenarios
 */
const PRACTICE_SCENARIOS = {
  A1: [
    { id: 'meet_friend', name: 'Meeting a Friend', description: 'Practice introducing yourself' },
    { id: 'buy_coffee', name: 'Buying Coffee', description: 'Order at a coffee shop' },
    { id: 'ask_time', name: 'Asking the Time', description: 'Simple time-related questions' }
  ],
  A2: [
    { id: 'hotel_checkin', name: 'Hotel Check-in', description: 'Check into a hotel' },
    { id: 'ask_directions', name: 'Getting Directions', description: 'Ask for and give directions' },
    { id: 'order_food', name: 'Restaurant Order', description: 'Order food at a restaurant' }
  ],
  B1: [
    { id: 'job_interview', name: 'Job Interview', description: 'Practice interview questions' },
    { id: 'doctor_visit', name: 'Doctor Visit', description: 'Describe symptoms and health' },
    { id: 'phone_call', name: 'Phone Conversation', description: 'Handle a phone call' }
  ],
  B2: [
    { id: 'negotiation', name: 'Negotiation', description: 'Negotiate a deal or agreement' },
    { id: 'presentation', name: 'Giving a Presentation', description: 'Present ideas formally' },
    { id: 'complaint', name: 'Making a Complaint', description: 'Handle a complaint professionally' }
  ],
  C1: [
    { id: 'debate', name: 'Formal Debate', description: 'Argue a position formally' },
    { id: 'academic', name: 'Academic Discussion', description: 'Discuss academic topics' },
    { id: 'mediation', name: 'Conflict Mediation', description: 'Mediate between parties' }
  ],
  C2: [
    { id: 'native_casual', name: 'Native Casual Chat', description: 'Natural conversation with idioms' },
    { id: 'formal_speech', name: 'Formal Speech', description: 'Prepare and deliver a speech' },
    { id: 'improvisation', name: 'Improvisation', description: 'Handle unexpected situations' }
  ]
};

/**
 * TTS Voice Options
 */
const TTS_VOICES = {
  openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  default: 'nova'
};

/**
 * Feature Flags
 */
const AI_FEATURES = {
  conversation: process.env.AI_CONVERSATION_ENABLED !== 'false',
  grammarFeedback: process.env.AI_GRAMMAR_FEEDBACK_ENABLED !== 'false',
  recommendations: process.env.AI_RECOMMENDATIONS_ENABLED !== 'false',
  quizGeneration: process.env.AI_QUIZ_GENERATION_ENABLED !== 'false',
  speechTTS: process.env.SPEECH_TTS_ENABLED !== 'false',
  speechSTT: process.env.SPEECH_STT_ENABLED !== 'false',
  speechFeatures: process.env.SPEECH_FEATURES_ENABLED !== 'false',
  enhancedTranslation: process.env.AI_TRANSLATION_ENABLED !== 'false',
  aiTranslation: process.env.AI_TRANSLATION_ENABLED !== 'false',
  lessonAssistant: process.env.AI_LESSON_ASSISTANT_ENABLED !== 'false',
  lessonBuilder: process.env.AI_LESSON_BUILDER_ENABLED !== 'false'
};

/**
 * Cache TTL Settings (in milliseconds)
 */
const CACHE_TTL = {
  recommendations: 12 * 60 * 60 * 1000, // 12 hours
  ttsAudio: 90 * 24 * 60 * 60 * 1000,   // 90 days
  translation: 30 * 24 * 60 * 60 * 1000, // 30 days
  aiQuiz: 24 * 60 * 60 * 1000            // 24 hours
};

/**
 * Quiz Generation Settings
 */
const QUIZ_SETTINGS = {
  minQuestions: 5,
  maxQuestions: 20,
  defaultQuestions: 10,
  questionTypes: ['multiple_choice', 'fill_blank', 'translation', 'matching', 'ordering'],
  difficulties: ['easy', 'medium', 'hard', 'adaptive']
};

/**
 * Pronunciation Scoring Weights
 */
const PRONUNCIATION_WEIGHTS = {
  accuracy: 0.4,
  completeness: 0.3,
  fluency: 0.3
};

module.exports = {
  AI_PROVIDERS,
  AI_RATE_LIMITS,
  CEFR_MODIFIERS,
  CONVERSATION_TOPICS,
  PRACTICE_SCENARIOS,
  TTS_VOICES,
  AI_FEATURES,
  CACHE_TTL,
  QUIZ_SETTINGS,
  PRONUNCIATION_WEIGHTS
};
