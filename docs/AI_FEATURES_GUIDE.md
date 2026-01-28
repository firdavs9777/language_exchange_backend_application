# BanaTalk AI Features Guide

This document covers all AI-powered features available in the BanaTalk language learning platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [AI Conversation Partner](#1-ai-conversation-partner)
4. [Grammar Feedback](#2-grammar-feedback)
5. [Adaptive Recommendations](#3-adaptive-recommendations)
6. [AI-Generated Quizzes](#4-ai-generated-quizzes)
7. [Speech Features (TTS/STT)](#5-speech-features)
8. [Enhanced Translation](#6-enhanced-translation)
9. [Rate Limits](#rate-limits)
10. [XP Rewards](#xp-rewards)
11. [Socket.IO Events](#socketio-events)

---

## Overview

BanaTalk uses OpenAI's GPT-4o-mini for chat, Whisper for speech-to-text, and TTS-1 for text-to-speech. All AI features are designed to enhance language learning through personalized, interactive experiences.

### Base URL
```
https://api.banatalk.com/api/v1
```

### Authentication
All endpoints require a Bearer token:
```
Authorization: Bearer <your_jwt_token>
```

---

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_TTS_MODEL=tts-1
OPENAI_WHISPER_MODEL=whisper-1

# Feature Flags (set to 'false' to disable)
AI_CONVERSATION_ENABLED=true
AI_GRAMMAR_FEEDBACK_ENABLED=true
AI_RECOMMENDATIONS_ENABLED=true
AI_QUIZ_GENERATION_ENABLED=true
SPEECH_FEATURES_ENABLED=true
AI_TRANSLATION_ENABLED=true

# Storage (for audio files)
DO_SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
DO_SPACES_BUCKET=bananatalk
DO_SPACES_KEY=your-spaces-key
DO_SPACES_SECRET=your-spaces-secret
DO_SPACES_CDN_ENDPOINT=cdn.banatalk.com
```

---

## 1. AI Conversation Partner

Practice conversations with an AI tutor that adapts to your CEFR level.

### Endpoints

#### Start Conversation
```http
POST /ai-conversation/start
```

**Request Body:**
```json
{
  "targetLanguage": "es",
  "cefrLevel": "B1",
  "nativeLanguage": "en",
  "topicId": "travel",
  "scenarioId": "hotel_checkin",
  "settings": {
    "correctionStyle": "gentle",
    "responseLength": "medium"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationId": "64f...",
    "initialMessage": {
      "role": "assistant",
      "content": "¡Hola! Bienvenido al Hotel Sol. ¿En qué puedo ayudarle?",
      "translation": "Hello! Welcome to Hotel Sol. How can I help you?"
    },
    "topic": "Hotel Check-in",
    "cefrLevel": "B1"
  }
}
```

#### Send Message
```http
POST /ai-conversation/:id/message
```

**Request Body:**
```json
{
  "content": "Hola, tengo una reservación para dos noches.",
  "responseTime": 5200
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": {
      "role": "assistant",
      "content": "Perfecto. ¿Puede darme su nombre, por favor?",
      "translation": "Perfect. Can you give me your name, please?"
    },
    "feedback": {
      "grammarCorrections": [],
      "vocabularySuggestions": [],
      "encouragement": "Great job using formal 'usted' form!"
    },
    "xpAwarded": 3
  }
}
```

#### End Conversation
```http
POST /ai-conversation/:id/end
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "duration": 320,
      "messageCount": 12,
      "vocabularyUsed": ["reservación", "habitación", "desayuno"],
      "grammarPoints": ["formal vs informal", "verb conjugation"],
      "overallPerformance": "good"
    },
    "xpAwarded": 20
  }
}
```

#### Get Conversation History
```http
GET /ai-conversation
```

**Query Parameters:**
- `limit` (default: 10)
- `offset` (default: 0)
- `status` (active, completed, all)

#### Get Topics
```http
GET /ai-conversation/topics?level=B1
```

#### Get Practice Scenarios
```http
GET /ai-conversation/scenarios?level=B1
```

---

## 2. Grammar Feedback

Get detailed grammar analysis and corrections for your writing.

### Endpoints

#### Analyze Text
```http
POST /grammar-feedback
```

**Request Body:**
```json
{
  "text": "Yo soy ir al mercado ayer.",
  "targetLanguage": "es",
  "nativeLanguage": "en",
  "cefrLevel": "A2"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feedbackId": "64f...",
    "overallScore": 45,
    "errors": [
      {
        "type": "grammar",
        "severity": "major",
        "originalSegment": "soy ir",
        "correctedSegment": "fui",
        "startIndex": 3,
        "explanation": "Use the preterite tense 'fui' (I went) for completed past actions, not 'soy ir'.",
        "rule": "Past tense: ir → fui/fue/fuimos/fueron",
        "examples": [
          "Ayer fui al cine. (Yesterday I went to the cinema)",
          "Ella fue a la tienda. (She went to the store)"
        ]
      }
    ],
    "suggestions": [
      {
        "type": "native_speaker",
        "text": "Ayer fui al mercado.",
        "explanation": "More natural word order with time at the beginning"
      }
    ],
    "positives": [
      "Good use of 'al' (a + el) contraction"
    ],
    "correctedText": "Ayer fui al mercado.",
    "summary": "You're making good progress! Focus on past tense verb forms."
  }
}
```

#### Get Feedback Details
```http
GET /grammar-feedback/:id
```

#### Get Feedback History
```http
GET /grammar-feedback/history?limit=20&offset=0
```

#### Mark Feedback as Viewed
```http
PUT /grammar-feedback/:id/viewed
```

#### Explain Grammar Rule
```http
POST /grammar-feedback/explain-rule
```

**Request Body:**
```json
{
  "rule": "subjunctive mood",
  "targetLanguage": "es",
  "nativeLanguage": "en",
  "cefrLevel": "B1"
}
```

---

## 3. Adaptive Recommendations

Get personalized lesson recommendations based on your learning patterns.

### Endpoints

#### Get Adaptive Recommendations
```http
GET /learning/recommendations/adaptive
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "lessonId": "64f...",
        "title": "Past Tense Verbs",
        "category": "grammar",
        "topic": "verbs",
        "score": 95,
        "reasons": [
          "You made 3 past tense errors this week",
          "This builds on your recent vocabulary"
        ],
        "priority": 1,
        "type": "weak_area",
        "estimatedMinutes": 15
      }
    ],
    "weakAreas": [
      {
        "topic": "past_tense",
        "category": "grammar",
        "score": 0.45,
        "mistakeCount": 8
      }
    ],
    "learningInsight": "You're progressing well in vocabulary but need more practice with verb conjugations.",
    "generatedAt": "2024-01-15T10:30:00Z",
    "expiresAt": "2024-01-15T22:30:00Z"
  }
}
```

#### Force Refresh Recommendations
```http
POST /learning/recommendations/refresh
```

#### Get Weak Areas
```http
GET /learning/progress/weak-areas
```

**Response:**
```json
{
  "success": true,
  "data": {
    "weakAreas": [
      {
        "topic": "subjunctive",
        "category": "grammar",
        "score": 0.35,
        "mistakeCount": 12,
        "lastPracticed": "2024-01-10T15:00:00Z",
        "recommendedAction": "Complete 'Subjunctive Basics' lesson"
      }
    ]
  }
}
```

---

## 4. AI-Generated Quizzes

Get custom quizzes targeting your weak areas.

### Endpoints

#### Generate Quiz
```http
POST /learning/quizzes/generate
```

**Request Body:**
```json
{
  "type": "weak_areas",
  "questionCount": 10,
  "difficulty": "adaptive",
  "focusAreas": ["past_tense", "vocabulary"],
  "vocabularyIds": []
}
```

**Quiz Types:**
- `weak_areas` - Targets your weakest topics
- `vocabulary` - Tests specific vocabulary items
- `recent_content` - Reviews recently learned material
- `mixed` - Combination of all types

**Response:**
```json
{
  "success": true,
  "data": {
    "quiz": {
      "_id": "64f...",
      "title": "Practice Quiz: Past Tense",
      "description": "AI-generated quiz targeting your weak areas",
      "questionCount": 10,
      "estimatedMinutes": 5,
      "targetAreas": [
        {
          "type": "grammar",
          "identifier": "past_tense",
          "weaknessScore": 0.55
        }
      ],
      "difficulty": "adaptive",
      "xpReward": 25,
      "expiresAt": "2024-01-16T10:30:00Z"
    }
  }
}
```

#### Start Quiz
```http
POST /learning/quizzes/ai/:id/start
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quiz": {
      "_id": "64f...",
      "questions": [
        {
          "type": "multiple_choice",
          "question": "Complete the sentence: Ayer yo ___ al parque.",
          "options": [
            { "text": "voy" },
            { "text": "fui" },
            { "text": "iba" },
            { "text": "iré" }
          ],
          "difficulty": "medium",
          "points": 10,
          "tags": ["past_tense", "ir"]
        },
        {
          "type": "fill_blank",
          "question": "Translate: 'She ate breakfast.'",
          "targetText": "Ella ___ el desayuno.",
          "difficulty": "medium",
          "points": 10,
          "tags": ["past_tense", "comer"]
        }
      ]
    },
    "attemptNumber": 1
  }
}
```

#### Submit Answer
```http
POST /learning/quizzes/ai/:id/answer
```

**Request Body:**
```json
{
  "questionIndex": 0,
  "answer": "fui"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isCorrect": true,
    "correctAnswer": "fui",
    "explanation": "'Fui' is the preterite (past) form of 'ir' for yo. Used for completed actions.",
    "points": 10
  }
}
```

#### Complete Quiz
```http
POST /learning/quizzes/ai/:id/complete
```

**Request Body:**
```json
{
  "answers": ["fui", "comió", "hablaron"],
  "timeSpent": 245
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 80,
    "totalPoints": 100,
    "earnedPoints": 80,
    "correctCount": 8,
    "totalQuestions": 10,
    "isPerfect": false,
    "xpAwarded": 25,
    "results": [
      {
        "questionIndex": 0,
        "isCorrect": true,
        "correctAnswer": "fui",
        "userAnswer": "fui",
        "points": 10
      }
    ]
  }
}
```

#### Get Quiz Stats
```http
GET /learning/quizzes/ai/stats
```

---

## 5. Speech Features

Text-to-speech, speech-to-text, and pronunciation evaluation.

### Endpoints

#### Generate TTS Audio
```http
POST /speech/tts
```

**Request Body:**
```json
{
  "text": "Hola, ¿cómo estás?",
  "language": "es",
  "voice": "nova",
  "speed": 1.0,
  "format": "mp3"
}
```

**Available Voices:** `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

**Response:**
```json
{
  "success": true,
  "data": {
    "audioUrl": "https://cdn.banatalk.com/audio/tts_1705312345_abc123.mp3",
    "duration": 2,
    "cached": false,
    "voice": "nova",
    "characterCount": 18
  }
}
```

#### Transcribe Audio (STT)
```http
POST /speech/stt
Content-Type: multipart/form-data
```

**Form Data:**
- `audio` - Audio file (mp3, wav, webm, m4a, ogg, flac)
- `language` - Language code (optional, auto-detected)

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "Hola, ¿cómo estás?",
    "language": "es",
    "duration": 2.5
  }
}
```

#### Evaluate Pronunciation
```http
POST /speech/pronunciation/evaluate
Content-Type: multipart/form-data
```

**Form Data:**
- `audio` - Audio file of user's pronunciation
- `targetText` - Text that should be pronounced
- `language` - Language code
- `source` - Context (vocabulary, lesson, practice)
- `vocabularyId` - Optional vocabulary ID

**Response:**
```json
{
  "success": true,
  "data": {
    "attemptId": "64f...",
    "transcription": "Ola como estas",
    "score": {
      "overall": 72,
      "accuracy": 75,
      "fluency": 80,
      "completeness": 60,
      "wordScores": [
        { "word": "Hola", "score": 85, "feedback": "Good" },
        { "word": "cómo", "score": 70, "feedback": "Work on the accent" },
        { "word": "estás", "score": 60, "feedback": "Needs practice" }
      ]
    },
    "feedback": {
      "summary": "Good job! Your pronunciation is clear with minor areas to improve.",
      "improvements": [
        "Focus on the accent mark in 'cómo' - it changes the vowel sound",
        "Practice the final 's' sound in 'estás'"
      ],
      "strengths": [
        "Good intonation for questions",
        "Clear 'H' sound (silent in Spanish)"
      ]
    },
    "referenceAudioUrl": "https://cdn.banatalk.com/audio/ref_hola_como_estas.mp3",
    "xpAwarded": 10
  }
}
```

#### Get Pronunciation History
```http
GET /speech/pronunciation/history?language=es&limit=20&offset=0
```

#### Get Pronunciation Stats
```http
GET /speech/pronunciation/stats?language=es
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAttempts": 45,
    "averageScore": 78,
    "averageAccuracy": 80,
    "averageFluency": 75,
    "bestScore": 95,
    "totalXP": 450,
    "totalDuration": 1200,
    "recentAverage": 82
  }
}
```

#### Get Best Attempt
```http
GET /speech/pronunciation/best?targetText=Hola
```

#### Get Available Voices
```http
GET /speech/voices?language=es
```

---

## 6. Enhanced Translation

Context-aware translations with educational explanations.

### Endpoints

#### Enhanced Translation
```http
POST /translate/enhanced
```

**Request Body:**
```json
{
  "text": "It's raining cats and dogs",
  "sourceLanguage": "en",
  "targetLanguage": "es",
  "nativeLanguage": "en",
  "includeBreakdown": true,
  "includeGrammar": true,
  "includeIdioms": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "translation": "Está lloviendo a cántaros",
    "alternatives": [
      {
        "text": "Llueve mucho",
        "context": "Simple, everyday expression",
        "formality": "neutral"
      },
      {
        "text": "Está diluviando",
        "context": "More dramatic, emphasizes heavy rain",
        "formality": "informal"
      }
    ],
    "breakdown": [
      {
        "original": "It's raining",
        "translated": "Está lloviendo",
        "partOfSpeech": "verb phrase",
        "notes": "Present progressive form"
      },
      {
        "original": "cats and dogs",
        "translated": "a cántaros",
        "partOfSpeech": "idiom",
        "notes": "Literally 'by pitchers' - Spanish equivalent idiom"
      }
    ],
    "grammar": [
      {
        "aspect": "Progressive tense",
        "sourceRule": "is + verb-ing",
        "targetRule": "estar + gerund (-ando/-iendo)",
        "example": "is raining → está lloviendo"
      }
    ],
    "idioms": [
      {
        "original": "raining cats and dogs",
        "meaning": "Raining very heavily",
        "equivalent": "llover a cántaros",
        "literal": "to rain by pitchers"
      }
    ],
    "cultural": {
      "notes": "Spanish has many regional idioms for heavy rain",
      "formality": "neutral",
      "region": "Universal Spanish"
    },
    "analysis": {
      "isIdiom": true,
      "isSlang": false,
      "isInformal": false,
      "tone": "casual",
      "complexity": "simple"
    }
  }
}
```

#### Detect Idioms
```http
POST /translate/idioms
```

**Request Body:**
```json
{
  "text": "He kicked the bucket last year",
  "sourceLanguage": "en",
  "targetLanguage": "es"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "idioms": [
      {
        "expression": "kicked the bucket",
        "meaning": "Died (informal/euphemism)",
        "literal": "pateó el cubo",
        "equivalent": "estirar la pata",
        "usage": "Informal contexts only, can be considered insensitive",
        "formality": "informal"
      }
    ],
    "hasIdioms": true,
    "summary": "Contains 1 English idiom meaning 'to die'"
  }
}
```

#### Explain Grammar Differences
```http
POST /translate/grammar
```

**Request Body:**
```json
{
  "text": "I have been studying Spanish for two years",
  "sourceLanguage": "en",
  "targetLanguage": "es",
  "nativeLanguage": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "translation": "Llevo dos años estudiando español",
    "grammarPoints": [
      {
        "category": "verb",
        "sourceExample": "I have been studying",
        "targetExample": "Llevo... estudiando",
        "explanation": "Spanish uses 'llevar + time + gerund' for ongoing actions, not present perfect continuous",
        "tip": "Think of 'llevar' as 'to carry (time)'"
      },
      {
        "category": "word_order",
        "sourceExample": "for two years",
        "targetExample": "dos años",
        "explanation": "No preposition needed with 'llevar' construction",
        "tip": "Time duration comes right after 'llevo'"
      }
    ],
    "summary": "Key difference: Spanish expresses duration with 'llevar' construction instead of perfect tenses",
    "difficulty": "medium"
  }
}
```

#### Get Alternative Translations
```http
POST /translate/alternatives
```

**Request Body:**
```json
{
  "text": "Hello",
  "sourceLanguage": "en",
  "targetLanguage": "es",
  "context": "greeting a friend"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "primaryTranslation": "Hola",
    "alternatives": [
      {
        "text": "¡Hola!",
        "formality": "neutral",
        "context": "Standard greeting",
        "nuance": "Exclamation marks add enthusiasm"
      },
      {
        "text": "¡Qué tal!",
        "formality": "informal",
        "context": "Casual greeting among friends",
        "nuance": "More like 'What's up?'"
      },
      {
        "text": "¡Buenas!",
        "formality": "informal",
        "context": "Very casual, any time of day",
        "region": "Common in Spain"
      },
      {
        "text": "¡Ey!",
        "formality": "slang",
        "context": "Very informal, close friends",
        "nuance": "Like 'Hey!'"
      }
    ],
    "recommendation": "Use '¡Qué tal!' for a friendly, casual greeting between friends"
  }
}
```

#### Contextual Translation
```http
POST /translate/contextual
```

**Request Body:**
```json
{
  "text": "Can you help me?",
  "sourceLanguage": "en",
  "targetLanguage": "es",
  "context": "asking a stranger for directions",
  "tone": "polite",
  "audience": "elderly person"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "translation": "Disculpe, ¿podría ayudarme?",
    "adaptations": [
      {
        "original": "Can you",
        "adapted": "¿Podría",
        "reason": "Conditional tense for extra politeness"
      },
      {
        "original": "(none)",
        "adapted": "Disculpe",
        "reason": "Added polite attention-getter for approaching stranger"
      }
    ],
    "toneAnalysis": {
      "original": "neutral/direct",
      "target": "formal/polite",
      "adjustments": "Used usted form and conditional mood"
    },
    "culturalNotes": "In Spanish-speaking cultures, using 'usted' with elderly people shows respect",
    "confidence": 95
  }
}
```

#### Get Popular Translations
```http
GET /translate/popular?language=es&limit=10
```

---

## Rate Limits

Rate limits vary by user tier:

| Feature | Free | Regular | VIP |
|---------|------|---------|-----|
| AI Conversation | 20/hr | 50/hr | 200/hr |
| Grammar Feedback | 30/hr | 100/hr | 500/hr |
| TTS | 50/hr | 200/hr | 1000/hr |
| STT | 20/hr | 100/hr | 500/hr |
| Pronunciation | 30/hr | 150/hr | 500/hr |
| Translation | 50/hr | 200/hr | 1000/hr |
| Quiz Generation | 10/hr | 30/hr | 100/hr |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705315200
```

---

## XP Rewards

| Action | XP |
|--------|-----|
| AI Conversation Message | 3 |
| Complete AI Conversation | 20 |
| First AI Conversation | 50 |
| Grammar Feedback Request | 1 |
| Apply Grammar Correction | 5 |
| Perfect Grammar Message | 10 |
| Complete AI Quiz | 25 |
| Perfect AI Quiz Bonus | 10 |
| Improve Weak Area | 15 |
| Pronunciation Excellent (90%+) | 15 |
| Pronunciation Good (70%+) | 10 |
| Pronunciation Attempt | 3 |
| Enhanced Translation Use | 2 |
| Idiom Learned | 5 |

---

## Socket.IO Events

### AI Conversation (Real-time)

**Client → Server:**
```javascript
// Send message with streaming response
socket.emit('aiConversation:sendMessage', {
  conversationId: '64f...',
  content: 'Hola, ¿qué tal?'
});

// End conversation
socket.emit('aiConversation:end', {
  conversationId: '64f...'
});
```

**Server → Client:**
```javascript
// Typing indicator
socket.on('aiConversation:typing', (data) => {
  // { conversationId, isTyping: true }
});

// Streamed response chunks
socket.on('aiConversation:stream', (data) => {
  // { conversationId, chunk: 'Hola', fullContent: 'Hola' }
});

// Complete message
socket.on('aiConversation:message', (data) => {
  // { conversationId, message: {...}, feedback: {...}, xpAwarded: 3 }
});

// Conversation ended
socket.on('aiConversation:ended', (data) => {
  // { conversationId, summary: {...}, xpAwarded: 20 }
});
```

### Grammar Feedback (Real-time)

**Client → Server:**
```javascript
socket.emit('grammarFeedback:analyze', {
  text: 'Yo soy ir al mercado',
  targetLanguage: 'es',
  nativeLanguage: 'en'
});
```

**Server → Client:**
```javascript
socket.on('grammarFeedback:result', (data) => {
  // { feedbackId, overallScore, errors: [...], suggestions: [...] }
});
```

---

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common Error Codes:**
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## TypeScript Interfaces

```typescript
interface AIConversation {
  _id: string;
  user: string;
  targetLanguage: string;
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  topic?: string;
  scenario?: string;
  messages: AIMessage[];
  status: 'active' | 'completed' | 'expired';
  performance: {
    messageCount: number;
    averageResponseTime: number;
    vocabularyUsed: string[];
    grammarMistakes: number;
  };
  xpAwarded: number;
  createdAt: Date;
  updatedAt: Date;
}

interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  translation?: string;
  feedback?: {
    corrections: GrammarCorrection[];
    suggestions: string[];
  };
  timestamp: Date;
}

interface GrammarFeedback {
  _id: string;
  user: string;
  originalText: string;
  targetLanguage: string;
  overallScore: number;
  errors: GrammarError[];
  suggestions: Suggestion[];
  positives: string[];
  correctedText: string;
  createdAt: Date;
}

interface GrammarError {
  type: 'grammar' | 'spelling' | 'vocabulary' | 'style' | 'punctuation';
  severity: 'minor' | 'moderate' | 'major';
  originalSegment: string;
  correctedSegment: string;
  startIndex: number;
  explanation: string;
  rule: string;
  examples: string[];
}

interface PronunciationScore {
  overall: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  wordScores: WordScore[];
}

interface WordScore {
  word: string;
  score: number;
  feedback: string;
}

interface EnhancedTranslation {
  translation: string;
  alternatives: TranslationAlternative[];
  breakdown: WordBreakdown[];
  grammar: GrammarPoint[];
  idioms: Idiom[];
  cultural: CulturalContext;
  analysis: TextAnalysis;
}
```

---

## Best Practices

1. **Caching**: TTS audio and translations are cached. Subsequent requests for the same content return cached results instantly.

2. **Error Recovery**: If an AI request fails, the system returns fallback recommendations or basic translations when possible.

3. **Progressive Loading**: Use Socket.IO streaming for AI conversations to provide real-time typing feedback.

4. **Rate Limit Awareness**: Check `X-RateLimit-Remaining` header and show users their remaining quota.

5. **Audio Formats**: For best STT results, use WAV or high-quality MP3. WebM is also well-supported.

---

## Support

For issues or feature requests, contact:
- GitHub: https://github.com/anthropics/claude-code/issues
- Email: support@banatalk.com
