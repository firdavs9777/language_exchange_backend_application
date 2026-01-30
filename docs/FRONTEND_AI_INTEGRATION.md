# Frontend AI Integration Guide

Complete guide for integrating BananaTalk AI features in Flutter/mobile apps.

## Table of Contents
1. [AI Quiz Generation](#1-ai-quiz-generation)
2. [AI Lesson Assistant](#2-ai-lesson-assistant)
3. [AI Recommendations](#3-ai-recommendations)
4. [AI Conversation](#4-ai-conversation)
5. [Translation Service](#5-translation-service)
6. [Text-to-Speech (TTS)](#6-text-to-speech-tts)
7. [Speech-to-Text (STT)](#7-speech-to-text-stt)
8. [Error Handling](#8-error-handling)

---

## 1. AI Quiz Generation

Generate personalized practice quizzes based on user's weak areas or vocabulary.

### Generate Quiz

```http
POST /api/v1/learning/quizzes/generate
```

**Request Body:**
```json
{
  "type": "weak_areas",
  "questionCount": 10,
  "difficulty": "adaptive",
  "language": "es",
  "focusAreas": ["verbs", "greetings"],
  "vocabularyIds": []
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | No | Quiz type: `weak_areas` (default), `vocabulary`, `recent_content`, `mixed` |
| `questionCount` | number | No | Number of questions (5-20, default: 10) |
| `difficulty` | string | No | `easy`, `medium`, `hard`, `adaptive` (default) |
| `language` | string | No | Target language code (e.g., `es`, `fr`, `de`). Uses user's learning language if not specified |
| `focusAreas` | array | No | Specific topics to focus on |
| `vocabularyIds` | array | No | Specific vocabulary IDs (required if type is `vocabulary`) |

**Response:**
```json
{
  "success": true,
  "data": {
    "quiz": {
      "_id": "quiz_id",
      "title": "Practice Quiz: Verbs",
      "description": "AI-generated practice quiz targeting your weak areas",
      "questionCount": 10,
      "estimatedMinutes": 5,
      "targetAreas": [
        { "type": "grammar", "identifier": "verbs", "weaknessScore": 0.4 }
      ],
      "difficulty": "adaptive",
      "xpReward": 25,
      "expiresAt": "2024-01-31T00:00:00.000Z"
    },
    "message": "Quiz generated successfully"
  }
}
```

### Start Quiz

```http
POST /api/v1/learning/quizzes/ai/:quizId/start
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quiz": {
      "_id": "quiz_id",
      "title": "Practice Quiz: Verbs",
      "questions": [
        {
          "type": "multiple_choice",
          "question": "What is the correct conjugation of 'hablar' for 'yo'?",
          "options": [
            { "text": "hablo", "isCorrect": false },
            { "text": "hablas", "isCorrect": false },
            { "text": "habla", "isCorrect": false },
            { "text": "hablamos", "isCorrect": false }
          ],
          "difficulty": "easy",
          "points": 10,
          "tags": ["verbs", "conjugation"]
        }
      ]
    },
    "attemptNumber": 1
  }
}
```

> **Note:** `isCorrect` is hidden in the response. Use the submit answer endpoint to check.

### Submit Answer

```http
POST /api/v1/learning/quizzes/ai/:quizId/answer
```

**Request Body:**
```json
{
  "questionIndex": 0,
  "answer": "hablo"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isCorrect": true,
    "correctAnswer": "hablo",
    "explanation": "The first person singular (yo) form of 'hablar' is 'hablo'.",
    "points": 10
  }
}
```

### Complete Quiz

```http
POST /api/v1/learning/quizzes/ai/:quizId/complete
```

**Request Body:**
```json
{
  "answers": ["hablo", "comes", "vive"],
  "timeSpent": 180
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
        "correctAnswer": "hablo",
        "userAnswer": "hablo",
        "points": 10
      }
    ],
    "timeSpent": 180
  }
}
```

### Flutter Example

```dart
class AIQuizService {
  final ApiClient _api;

  // Generate a new quiz
  Future<Quiz> generateQuiz({
    String type = 'weak_areas',
    int questionCount = 10,
    String? language,
    String difficulty = 'adaptive',
  }) async {
    final response = await _api.post('/learning/quizzes/generate', data: {
      'type': type,
      'questionCount': questionCount,
      'language': language,  // e.g., 'es', 'fr', 'de'
      'difficulty': difficulty,
    });
    return Quiz.fromJson(response.data['data']['quiz']);
  }

  // Start the quiz
  Future<QuizSession> startQuiz(String quizId) async {
    final response = await _api.post('/learning/quizzes/ai/$quizId/start');
    return QuizSession.fromJson(response.data['data']);
  }

  // Submit answer
  Future<AnswerResult> submitAnswer(String quizId, int questionIndex, dynamic answer) async {
    final response = await _api.post('/learning/quizzes/ai/$quizId/answer', data: {
      'questionIndex': questionIndex,
      'answer': answer,
    });
    return AnswerResult.fromJson(response.data['data']);
  }

  // Complete quiz
  Future<QuizResult> completeQuiz(String quizId, List<dynamic> answers, int timeSpent) async {
    final response = await _api.post('/learning/quizzes/ai/$quizId/complete', data: {
      'answers': answers,
      'timeSpent': timeSpent,
    });
    return QuizResult.fromJson(response.data['data']);
  }
}
```

---

## 2. AI Lesson Assistant

Interactive AI helper during lesson learning.

### Get Exercise Hint

Progressive hints (1 = subtle, 2 = helpful, 3 = strong).

```http
POST /api/v1/learning/lessons/:lessonId/assistant/hint
```

**Request Body:**
```json
{
  "exerciseIndex": 0,
  "hintLevel": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hint": "Think about the verb ending for 'yo' in -ar verbs...",
    "hintLevel": 1,
    "hasMoreHints": true,
    "encouragement": "You're getting close!"
  }
}
```

### Explain a Concept

```http
POST /api/v1/learning/lessons/:lessonId/assistant/explain
```

**Request Body:**
```json
{
  "concept": "ser vs estar",
  "context": "I'm confused about when to use each"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "concept": "ser vs estar",
    "explanation": "Both mean 'to be', but 'ser' is for permanent characteristics while 'estar' is for temporary states or locations.",
    "examples": [
      { "sentence": "Yo soy estudiante", "translation": "I am a student (permanent)" },
      { "sentence": "Yo estoy cansado", "translation": "I am tired (temporary)" }
    ],
    "tip": "Remember: If it can change, use 'estar'!",
    "relatedConcepts": ["verb conjugation", "adjective agreement"]
  }
}
```

### Get Feedback on Wrong Answer

```http
POST /api/v1/learning/lessons/:lessonId/assistant/feedback
```

**Request Body:**
```json
{
  "exerciseIndex": 0,
  "userAnswer": "hablas"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userAnswer": "hablas",
    "correctAnswer": "hablo",
    "feedback": "You used the 'tú' (you) form instead of the 'yo' (I) form.",
    "correction": "For 'yo', the ending is '-o', so it's 'hablo'.",
    "explanation": "In Spanish, verb endings change based on the subject pronoun.",
    "commonMistake": "This is a common confusion between 'yo' and 'tú' conjugations.",
    "encouragement": "Keep practicing! Verb conjugations take time to master."
  }
}
```

### Ask a Question

```http
POST /api/v1/learning/lessons/:lessonId/assistant/ask
```

**Request Body:**
```json
{
  "question": "Why do some verbs have accent marks in certain forms?"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "question": "Why do some verbs have accent marks in certain forms?",
    "answer": "Accent marks in Spanish verbs help maintain the correct stress pattern...",
    "examples": [
      { "sentence": "hablé (I spoke)", "translation": "Past tense needs accent to show stress" }
    ],
    "additionalInfo": "This is especially common in preterite tense conjugations.",
    "suggestedFocus": "Practice preterite tense conjugations"
  }
}
```

### Generate Practice Variations

```http
POST /api/v1/learning/lessons/:lessonId/assistant/practice
```

**Request Body:**
```json
{
  "exerciseIndex": 0,
  "count": 3
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "originalExercise": {
      "type": "fill_blank",
      "question": "Yo ___ (hablar) español."
    },
    "variations": [
      {
        "type": "fill_blank",
        "question": "Yo ___ (comer) pizza.",
        "correctAnswer": "como",
        "explanation": "-er verbs use '-o' for yo form"
      },
      {
        "type": "fill_blank",
        "question": "Yo ___ (vivir) en Madrid.",
        "correctAnswer": "vivo",
        "explanation": "-ir verbs also use '-o' for yo form"
      }
    ]
  }
}
```

### Get Lesson Summary

```http
GET /api/v1/learning/lessons/:lessonId/assistant/summary
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lessonTitle": "Present Tense Conjugation",
    "lessonTopic": "verbs",
    "summary": "You learned how to conjugate regular -ar, -er, and -ir verbs in present tense.",
    "keyPoints": [
      "Regular -ar verbs: remove -ar, add -o, -as, -a, -amos, -áis, -an",
      "Regular -er verbs: remove -er, add -o, -es, -e, -emos, -éis, -en",
      "Regular -ir verbs: remove -ir, add -o, -es, -e, -imos, -ís, -en"
    ],
    "vocabularyToRemember": [
      { "word": "hablar", "translation": "to speak", "usage": "Yo hablo español" }
    ],
    "grammarRules": ["Subject pronouns can be omitted in Spanish"],
    "practiceRecommendation": "Practice more -ir verb conjugations",
    "encouragement": "Great job! You scored 90% on this lesson!",
    "userScore": 90,
    "isPerfect": false
  }
}
```

### Translation Help

```http
POST /api/v1/learning/assistant/translate
```

**Request Body:**
```json
{
  "text": "Me gusta mucho la comida mexicana",
  "sourceLanguage": "es",
  "targetLanguage": "en",
  "context": "casual conversation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "originalText": "Me gusta mucho la comida mexicana",
    "sourceLanguage": "es",
    "targetLanguage": "en",
    "translation": "I really like Mexican food",
    "literal": "To me pleases much the food Mexican",
    "breakdown": [
      { "word": "Me gusta", "translation": "I like", "note": "Literally 'it pleases me'" },
      { "word": "mucho", "translation": "a lot/really", "note": "Adverb" },
      { "word": "la comida", "translation": "the food", "note": "Feminine noun" },
      { "word": "mexicana", "translation": "Mexican", "note": "Adjective agrees with feminine noun" }
    ],
    "alternatives": ["I love Mexican food", "Mexican food is my favorite"],
    "culturalNote": "In Spanish, 'gustar' works differently - the thing you like is the subject"
  }
}
```

### Flutter Example

```dart
class AILessonAssistant {
  final ApiClient _api;

  // Get hint for exercise
  Future<HintResponse> getHint(String lessonId, int exerciseIndex, {int level = 1}) async {
    final response = await _api.post('/learning/lessons/$lessonId/assistant/hint', data: {
      'exerciseIndex': exerciseIndex,
      'hintLevel': level.clamp(1, 3),
    });
    return HintResponse.fromJson(response.data['data']);
  }

  // Explain a concept
  Future<ExplanationResponse> explainConcept(String lessonId, String concept, {String? context}) async {
    final response = await _api.post('/learning/lessons/$lessonId/assistant/explain', data: {
      'concept': concept,
      'context': context,
    });
    return ExplanationResponse.fromJson(response.data['data']);
  }

  // Get feedback on wrong answer
  Future<FeedbackResponse> getFeedback(String lessonId, int exerciseIndex, dynamic userAnswer) async {
    final response = await _api.post('/learning/lessons/$lessonId/assistant/feedback', data: {
      'exerciseIndex': exerciseIndex,
      'userAnswer': userAnswer,
    });
    return FeedbackResponse.fromJson(response.data['data']);
  }

  // Ask any question
  Future<AnswerResponse> askQuestion(String lessonId, String question) async {
    final response = await _api.post('/learning/lessons/$lessonId/assistant/ask', data: {
      'question': question,
    });
    return AnswerResponse.fromJson(response.data['data']);
  }

  // Get lesson summary after completion
  Future<LessonSummary> getLessonSummary(String lessonId) async {
    final response = await _api.get('/learning/lessons/$lessonId/assistant/summary');
    return LessonSummary.fromJson(response.data['data']);
  }

  // Translate text
  Future<TranslationResponse> translate(String text, String from, String to, {String? context}) async {
    final response = await _api.post('/learning/assistant/translate', data: {
      'text': text,
      'sourceLanguage': from,
      'targetLanguage': to,
      'context': context,
    });
    return TranslationResponse.fromJson(response.data['data']);
  }
}
```

---

## 3. AI Recommendations

Get personalized lesson recommendations based on user's progress.

### Get Adaptive Recommendations

```http
GET /api/v1/learning/recommendations/adaptive?language=es&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "lesson": {
          "_id": "lesson_id",
          "title": "Past Tense Basics",
          "slug": "past-tense-basics",
          "level": "A2",
          "category": "grammar",
          "topic": "verbs",
          "estimatedMinutes": 15,
          "xpReward": 25
        },
        "score": 95,
        "reasons": ["Targets your weak area: past tense", "Next in your curriculum"],
        "priority": 1,
        "recommendationType": "weak_area"
      }
    ],
    "weakAreas": [
      { "topic": "past tense", "category": "grammar", "score": 0.4, "mistakeRate": 60 }
    ],
    "learningInsight": "You're making great progress! Focus on past tense verbs to level up.",
    "generatedAt": "2024-01-30T10:00:00.000Z",
    "expiresAt": "2024-01-30T22:00:00.000Z",
    "cached": false
  }
}
```

### Refresh Recommendations

```http
POST /api/v1/learning/recommendations/refresh
```

### Get Weak Areas

```http
GET /api/v1/learning/progress/weak-areas
```

---

## 4. AI Conversation

Practice conversational skills with an AI tutor.

### Start Conversation

```http
POST /api/v1/conversations
```

**Request Body:**
```json
{
  "language": "es",
  "scenario": "restaurant",
  "proficiencyLevel": "A2"
}
```

### Send Message

```http
POST /api/v1/conversations/:conversationId/messages
```

**Request Body:**
```json
{
  "content": "Hola, quisiera una mesa para dos personas",
  "type": "text"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": {
      "_id": "msg_id",
      "content": "¡Buenas tardes! Claro, tenemos una mesa disponible junto a la ventana. ¿Les parece bien?",
      "role": "assistant",
      "grammarFeedback": {
        "hasErrors": false,
        "corrections": [],
        "overallFeedback": "Perfect! Your sentence was grammatically correct."
      }
    }
  }
}
```

---

## 5. Translation Service

### Translate Text

```http
POST /api/v1/translate
```

**Request Body:**
```json
{
  "text": "Hello, how are you?",
  "from": "en",
  "to": "es"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "translatedText": "Hola, ¿cómo estás?",
    "from": "en",
    "to": "es"
  }
}
```

---

## 6. Text-to-Speech (TTS)

Convert text to audio for pronunciation practice.

### Generate Audio

```http
POST /api/v1/speech/tts
```

**Request Body:**
```json
{
  "text": "Hola, ¿cómo estás?",
  "language": "es",
  "voice": "nova",
  "speed": 1.0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "audioUrl": "https://cdn.example.com/audio/abc123.mp3",
    "duration": 2.5,
    "cached": false
  }
}
```

**Available Voices:** `alloy`, `echo`, `fable`, `onyx`, `nova` (default), `shimmer`

---

## 7. Speech-to-Text (STT)

Transcribe user speech for speaking exercises.

### Transcribe Audio

```http
POST /api/v1/speech/stt
Content-Type: multipart/form-data
```

**Form Data:**
- `audio`: Audio file (mp3, wav, m4a, webm)
- `language`: Language code (e.g., `es`)

**Response:**
```json
{
  "success": true,
  "data": {
    "transcription": "Hola, cómo estás",
    "confidence": 0.95,
    "language": "es"
  }
}
```

### Pronunciation Feedback

```http
POST /api/v1/speech/pronunciation-feedback
Content-Type: multipart/form-data
```

**Form Data:**
- `audio`: Audio file
- `targetText`: The text user was trying to say
- `language`: Language code

**Response:**
```json
{
  "success": true,
  "data": {
    "transcription": "Hola, como estas",
    "targetText": "Hola, ¿cómo estás?",
    "overallScore": 85,
    "feedback": {
      "accuracy": 90,
      "fluency": 80,
      "pronunciation": 85
    },
    "suggestions": [
      "Pay attention to the accent on 'cómo'",
      "Try to add more intonation for questions"
    ]
  }
}
```

---

## 8. Error Handling

### Common Error Responses

```json
{
  "success": false,
  "error": "Error message here"
}
```

### Error Codes

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Token missing/invalid |
| 403 | Forbidden - Feature not enabled or rate limit exceeded |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Server Error |

### Rate Limits

| Feature | Free (per day) | Premium (per day) |
|---------|---------------|-------------------|
| Quiz Generation | 5 | 15 |
| Lesson Assistant | 30 | 100 |
| Conversation | 20 | 50 |
| TTS | 50 | 100 |
| STT | 20 | 50 |
| Translation | 30 | 50 |

### Flutter Error Handling Example

```dart
try {
  final quiz = await quizService.generateQuiz(language: 'es');
} on DioException catch (e) {
  if (e.response?.statusCode == 429) {
    // Rate limit exceeded
    showSnackBar('Daily limit reached. Try again tomorrow!');
  } else if (e.response?.statusCode == 403) {
    final error = e.response?.data['error'] ?? '';
    if (error.contains('not enabled')) {
      showSnackBar('This feature is not available');
    }
  } else {
    showSnackBar('Something went wrong. Please try again.');
  }
}
```

---

## Quick Reference

### Lesson Learning Flow with AI

```
1. GET  /lessons/:id/start          → Start lesson
2. POST /lessons/:id/answer         → Submit answer
   └─ If wrong: POST /assistant/feedback  → Get AI feedback
   └─ If stuck: POST /assistant/hint      → Get progressive hints
   └─ Questions: POST /assistant/ask      → Ask anything
3. POST /lessons/:id/complete       → Complete lesson
4. GET  /lessons/:id/assistant/summary → Get AI summary
```

### Quiz Flow

```
1. POST /quizzes/generate           → Generate AI quiz (with language!)
2. POST /quizzes/ai/:id/start       → Start quiz
3. POST /quizzes/ai/:id/answer      → Submit each answer
4. POST /quizzes/ai/:id/complete    → Complete and get results
```

### Language Codes

| Code | Language |
|------|----------|
| `en` | English |
| `es` | Spanish |
| `fr` | French |
| `de` | German |
| `it` | Italian |
| `pt` | Portuguese |
| `ru` | Russian |
| `zh` | Chinese |
| `ja` | Japanese |
| `ko` | Korean |
| `ar` | Arabic |
