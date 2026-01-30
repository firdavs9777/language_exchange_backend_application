# AI Lesson Builder - Complete Guide

Generate complete language learning lessons using AI. Cost-efficient and high-quality.

## Overview

The AI Lesson Builder creates structured lessons with:
- Teaching content (explanations, examples, tips)
- Exercises (8 different types)
- Vocabulary lists
- Complete curricula

**Cost:** ~$0.003 per lesson (using gpt-4o-mini)

---

## Base URL

```
/api/v1/lessons
```

## Authentication

All endpoints require authentication via Bearer token:

```
Authorization: Bearer <access_token>
```

---

## 1. Generate a Complete Lesson

Create a full lesson with content and exercises.

### Endpoint

```http
POST /api/v1/lessons/generate
```

### Request

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `language` | string | Yes | - | Target language code (es, fr, de, etc.) |
| `topic` | string | Yes | - | Lesson topic (e.g., "Restaurant Vocabulary") |
| `level` | string | No | A1 | CEFR level: A1, A2, B1, B2, C1, C2 |
| `category` | string | No | vocabulary | Category (see below) |
| `exerciseCount` | number | No | 10 | Number of exercises (5-20) |
| `nativeLanguage` | string | No | en | User's native language |
| `unitNumber` | number | No | - | Unit number for curriculum |
| `unitName` | string | No | - | Unit name |

**Categories:**
- `vocabulary` - Word lists and meanings
- `grammar` - Grammar rules and structures
- `conversation` - Dialogues and phrases
- `pronunciation` - Sounds and speaking
- `reading` - Reading comprehension
- `listening` - Listening exercises
- `writing` - Writing practice
- `culture` - Cultural topics

### Example Request

```json
{
  "language": "es",
  "topic": "Restaurant Vocabulary",
  "level": "A2",
  "category": "vocabulary",
  "exerciseCount": 10,
  "nativeLanguage": "en"
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "lesson": {
      "_id": "65abc123...",
      "title": "At the Restaurant - Essential Vocabulary",
      "description": "Learn essential vocabulary for ordering food and drinks at a restaurant.",
      "slug": "restaurant-vocabulary-m1abc2",
      "language": "es",
      "level": "A2",
      "category": "vocabulary",
      "topic": "Restaurant Vocabulary",
      "exerciseCount": 10,
      "estimatedMinutes": 15,
      "xpReward": 22
    },
    "generation": {
      "tokensUsed": 3245,
      "estimatedCost": "$0.002847",
      "timeMs": 4523
    }
  }
}
```

### Flutter Example

```dart
Future<GeneratedLesson> generateLesson({
  required String language,
  required String topic,
  String level = 'A1',
  String category = 'vocabulary',
  int exerciseCount = 10,
}) async {
  final response = await api.post('/lessons/generate', data: {
    'language': language,
    'topic': topic,
    'level': level,
    'category': category,
    'exerciseCount': exerciseCount,
  });

  return GeneratedLesson.fromJson(response.data['data']);
}

// Usage
final lesson = await generateLesson(
  language: 'es',
  topic: 'Colors and Shapes',
  level: 'A1',
  category: 'vocabulary',
);

print('Created: ${lesson.title}');
print('Cost: ${lesson.generation.estimatedCost}');
```

---

## 2. Generate Exercises Only

Generate exercises for a specific topic without full lesson content.

### Endpoint

```http
POST /api/v1/lessons/generate/exercises
```

### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `language` | string | Yes | Target language code |
| `topic` | string | Yes | Exercise topic |
| `level` | string | No | CEFR level (default: A1) |
| `category` | string | No | Category (default: vocabulary) |
| `exerciseTypes` | array | No | Types to generate |
| `count` | number | No | Number of exercises (1-20, default: 10) |
| `vocabulary` | array | No | Specific vocabulary to use |
| `context` | string | No | Additional context |

**Exercise Types:**
- `multiple_choice` - Select correct answer
- `fill_blank` - Fill in the blank
- `translation` - Translate text
- `matching` - Match pairs
- `ordering` - Put words in order
- `typing` - Type the answer
- `listening` - Listen and answer
- `speaking` - Speak and verify

### Example Request

```json
{
  "language": "fr",
  "topic": "Numbers 1-20",
  "level": "A1",
  "exerciseTypes": ["multiple_choice", "fill_blank", "matching"],
  "count": 10,
  "vocabulary": ["un", "deux", "trois", "quatre", "cinq"]
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "exercises": [
      {
        "type": "multiple_choice",
        "question": "What is 'three' in French?",
        "options": [
          {"text": "un", "isCorrect": false},
          {"text": "deux", "isCorrect": false},
          {"text": "trois", "isCorrect": true},
          {"text": "quatre", "isCorrect": false}
        ],
        "correctAnswer": "trois",
        "hint": "It sounds similar to 'twa'",
        "explanation": "'Trois' means 'three' in French",
        "points": 10
      },
      {
        "type": "fill_blank",
        "question": "Complete the sentence:",
        "targetText": "J'ai ___ pommes. (I have two apples)",
        "correctAnswer": "deux",
        "acceptedAnswers": ["deux"],
        "hint": "The number between un and trois",
        "explanation": "'Deux' means 'two'",
        "points": 10
      }
    ],
    "count": 10,
    "tokensUsed": 1523,
    "estimatedCost": "$0.001234"
  }
}
```

### Flutter Example

```dart
Future<List<Exercise>> generateExercises({
  required String language,
  required String topic,
  List<String>? exerciseTypes,
  int count = 10,
}) async {
  final response = await api.post('/lessons/generate/exercises', data: {
    'language': language,
    'topic': topic,
    'exerciseTypes': exerciseTypes ?? ['multiple_choice', 'fill_blank'],
    'count': count,
  });

  final data = response.data['data'];
  return (data['exercises'] as List)
      .map((e) => Exercise.fromJson(e))
      .toList();
}
```

---

## 3. Generate Vocabulary List

Generate a vocabulary list with translations, pronunciations, and examples.

### Endpoint

```http
POST /api/v1/lessons/generate/vocabulary
```

### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `language` | string | Yes | Target language code |
| `topic` | string | Yes | Vocabulary topic |
| `level` | string | No | CEFR level (default: A1) |
| `count` | number | No | Number of words (5-50, default: 20) |
| `nativeLanguage` | string | No | Language for translations (default: en) |

### Example Request

```json
{
  "language": "de",
  "topic": "Family Members",
  "level": "A1",
  "count": 15,
  "nativeLanguage": "en"
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "topic": "Family Members",
    "vocabulary": [
      {
        "word": "die Mutter",
        "translation": "mother",
        "partOfSpeech": "noun",
        "pronunciation": "dee MOO-ter",
        "examples": [
          {
            "sentence": "Meine Mutter kocht das Abendessen.",
            "translation": "My mother is cooking dinner."
          }
        ],
        "difficulty": "easy",
        "tags": ["family", "people", "basic"]
      },
      {
        "word": "der Vater",
        "translation": "father",
        "partOfSpeech": "noun",
        "pronunciation": "dair FAH-ter",
        "examples": [
          {
            "sentence": "Mein Vater arbeitet im Büro.",
            "translation": "My father works in the office."
          }
        ],
        "difficulty": "easy",
        "tags": ["family", "people", "basic"]
      }
    ],
    "count": 15,
    "tokensUsed": 1856,
    "estimatedCost": "$0.001523"
  }
}
```

### Flutter Example

```dart
Future<VocabularyList> generateVocabulary({
  required String language,
  required String topic,
  String level = 'A1',
  int count = 20,
}) async {
  final response = await api.post('/lessons/generate/vocabulary', data: {
    'language': language,
    'topic': topic,
    'level': level,
    'count': count,
  });

  return VocabularyList.fromJson(response.data['data']);
}
```

---

## 4. Generate Complete Curriculum

Generate multiple lessons organized into units. **Admin only.**

### Endpoint

```http
POST /api/v1/lessons/generate/curriculum
```

### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `language` | string | Yes | Target language code |
| `level` | string | No | CEFR level (default: A1) |
| `lessonsPerUnit` | number | No | Lessons per unit (3-10, default: 5) |
| `unitsCount` | number | No | Number of units (1-10, default: 3) |
| `categories` | array | No | Categories to include |
| `nativeLanguage` | string | No | Native language (default: en) |

### Example Request

```json
{
  "language": "es",
  "level": "A1",
  "lessonsPerUnit": 5,
  "unitsCount": 3,
  "categories": ["vocabulary", "grammar", "conversation"]
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "curriculum": {
      "title": "Spanish A1 Complete Course",
      "description": "A comprehensive beginner course for Spanish learners",
      "level": "A1",
      "language": "es",
      "unitsCount": 3,
      "lessonsCount": 15
    },
    "lessons": [
      {
        "_id": "65abc...",
        "title": "Greetings and Introductions",
        "slug": "greetings-and-introductions-m1a",
        "category": "vocabulary",
        "topic": "Greetings"
      }
    ],
    "tokensUsed": 48523,
    "estimatedCost": "$0.042"
  }
}
```

---

## 5. Enhance Existing Lesson

Add more content and exercises to an existing lesson.

### Endpoint

```http
POST /api/v1/lessons/:lessonId/enhance
```

### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `addExercises` | number | No | Exercises to add (0-10, default: 5) |
| `addContent` | boolean | No | Add new content sections (default: true) |
| `addTips` | boolean | No | Add learning tips (default: true) |

### Example Request

```json
{
  "addExercises": 5,
  "addContent": true,
  "addTips": true
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "lesson": {
      "_id": "65abc...",
      "title": "Restaurant Vocabulary",
      "contentCount": 8,
      "exerciseCount": 15,
      "version": 2
    },
    "added": {
      "content": 3,
      "exercises": 5
    },
    "tokensUsed": 1234,
    "estimatedCost": "$0.001"
  }
}
```

---

## 6. Batch Generate Lessons

Generate multiple lessons at once. **Admin only.**

### Endpoint

```http
POST /api/v1/lessons/generate/batch
```

### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lessons` | array | Yes | Array of lesson configurations (max 20) |
| `delayMs` | number | No | Delay between generations (default: 500) |

### Example Request

```json
{
  "lessons": [
    { "language": "es", "topic": "Colors", "level": "A1", "category": "vocabulary" },
    { "language": "es", "topic": "Numbers", "level": "A1", "category": "vocabulary" },
    { "language": "es", "topic": "Greetings", "level": "A1", "category": "conversation" }
  ],
  "delayMs": 500
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "successful": [
      { "_id": "65abc...", "title": "Colors in Spanish", "slug": "colors-in-spanish-m1a" },
      { "_id": "65abd...", "title": "Numbers 1-20", "slug": "numbers-1-20-m2b" },
      { "_id": "65abe...", "title": "Basic Greetings", "slug": "basic-greetings-m3c" }
    ],
    "failed": [],
    "totalTokens": 9876,
    "totalCost": "$0.0087"
  }
}
```

---

## 7. Get AI-Generated Lessons

List all AI-generated lessons.

### Endpoint

```http
GET /api/v1/lessons/ai-generated
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `language` | string | Filter by language |
| `level` | string | Filter by level |
| `category` | string | Filter by category |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

### Example Response

```json
{
  "success": true,
  "data": {
    "lessons": [
      {
        "_id": "65abc...",
        "title": "Restaurant Vocabulary",
        "slug": "restaurant-vocabulary-m1a",
        "language": "es",
        "level": "A2",
        "category": "vocabulary",
        "topic": "Restaurant",
        "icon": "📚",
        "estimatedMinutes": 15,
        "xpReward": 22,
        "isPublished": true,
        "aiGenerated": {
          "generatedAt": "2024-01-30T10:00:00.000Z"
        },
        "createdAt": "2024-01-30T10:00:00.000Z"
      }
    ],
    "total": 45,
    "page": 1,
    "totalPages": 3
  }
}
```

---

## 8. Get Lesson Templates

Get available templates and configuration options.

### Endpoint

```http
GET /api/v1/lessons/templates
```

### Example Response

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "category": "vocabulary",
        "icon": "📚",
        "exerciseTypes": ["multiple_choice", "matching", "translation", "typing"],
        "exerciseDistribution": {
          "multiple_choice": 3,
          "matching": 2,
          "translation": 3,
          "typing": 2
        },
        "contentStructure": [
          { "type": "text", "purpose": "introduction" },
          { "type": "text", "purpose": "vocabulary_list" },
          { "type": "example", "purpose": "usage_examples" },
          { "type": "tip", "purpose": "memory_tip" }
        ]
      },
      {
        "category": "grammar",
        "icon": "📝",
        "exerciseTypes": ["multiple_choice", "fill_blank", "translation", "ordering"],
        "exerciseDistribution": {
          "multiple_choice": 3,
          "fill_blank": 3,
          "translation": 2,
          "ordering": 2
        }
      }
    ],
    "levels": ["A1", "A2", "B1", "B2", "C1", "C2"],
    "supportedLanguages": [
      { "code": "en", "name": "English" },
      { "code": "es", "name": "Spanish" },
      { "code": "fr", "name": "French" },
      { "code": "de", "name": "German" },
      { "code": "it", "name": "Italian" },
      { "code": "pt", "name": "Portuguese" },
      { "code": "ru", "name": "Russian" },
      { "code": "zh", "name": "Chinese" },
      { "code": "ja", "name": "Japanese" },
      { "code": "ko", "name": "Korean" },
      { "code": "ar", "name": "Arabic" }
    ]
  }
}
```

---

## 9. Get Generation Statistics

Get statistics about AI-generated lessons. **Admin only.**

### Endpoint

```http
GET /api/v1/lessons/stats
```

### Example Response

```json
{
  "success": true,
  "data": {
    "totalAILessons": 156,
    "byLevel": [
      { "_id": "A1", "count": 45 },
      { "_id": "A2", "count": 38 },
      { "_id": "B1", "count": 35 },
      { "_id": "B2", "count": 25 },
      { "_id": "C1", "count": 13 }
    ],
    "byCategory": [
      { "_id": "vocabulary", "count": 52 },
      { "_id": "grammar", "count": 43 },
      { "_id": "conversation", "count": 31 },
      { "_id": "culture", "count": 18 },
      { "_id": "reading", "count": 12 }
    ],
    "byLanguage": [
      { "_id": "es", "count": 65 },
      { "_id": "fr", "count": 42 },
      { "_id": "de", "count": 28 },
      { "_id": "it", "count": 21 }
    ],
    "recentLessons": [
      {
        "title": "Advanced Business Spanish",
        "language": "es",
        "level": "B2",
        "category": "vocabulary",
        "createdAt": "2024-01-30T10:00:00.000Z"
      }
    ],
    "tokenUsage": {
      "total": 523456,
      "average": 3354,
      "estimatedTotalCost": "$0.4587"
    },
    "averageGenerationTime": 4523
  }
}
```

---

## 10. Update Publish Status

Publish or unpublish a lesson. **Admin only.**

### Endpoint

```http
PATCH /api/v1/lessons/:lessonId/publish
```

### Request

```json
{
  "isPublished": true
}
```

### Response

```json
{
  "success": true,
  "data": {
    "_id": "65abc...",
    "title": "Restaurant Vocabulary",
    "isPublished": true,
    "publishedAt": "2024-01-30T10:00:00.000Z"
  }
}
```

---

## 11. Delete Lesson

Delete a lesson permanently. **Admin only.**

### Endpoint

```http
DELETE /api/v1/lessons/:lessonId
```

### Response

```json
{
  "success": true,
  "data": {}
}
```

---

## Cost Estimation

| Operation | Input Tokens | Output Tokens | Estimated Cost |
|-----------|-------------:|--------------:|---------------:|
| Full Lesson (10 exercises) | ~2,000 | ~4,000 | ~$0.003 |
| Exercises Only (10) | ~1,000 | ~2,500 | ~$0.0017 |
| Vocabulary List (20 words) | ~500 | ~1,500 | ~$0.001 |
| Curriculum (15 lessons) | ~30,000 | ~60,000 | ~$0.045 |

**Bulk Pricing:**
- 100 lessons ≈ $0.30
- 1,000 lessons ≈ $3.00

---

## Rate Limits

| User Tier | Daily Limit | Monthly Limit |
|-----------|------------:|-------------:|
| Free | 5 | 50 |
| Regular | 20 | 200 |
| VIP | Unlimited | Unlimited |

---

## Error Handling

### Common Errors

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Language and topic are required | Missing required fields |
| 403 | AI lesson builder is not enabled | Feature disabled |
| 403 | Not authorized | Admin-only endpoint |
| 404 | Lesson not found | Invalid lesson ID |
| 429 | Rate limit exceeded | Too many requests |

### Flutter Error Handling

```dart
try {
  final lesson = await generateLesson(
    language: 'es',
    topic: 'Colors',
  );
} on DioException catch (e) {
  switch (e.response?.statusCode) {
    case 400:
      showError('Please provide language and topic');
      break;
    case 429:
      showError('Daily limit reached. Try again tomorrow!');
      break;
    default:
      showError('Failed to generate lesson');
  }
}
```

---

## Complete Flutter Service Example

```dart
class LessonBuilderService {
  final Dio _api;

  LessonBuilderService(this._api);

  // Generate a complete lesson
  Future<GeneratedLesson> generateLesson({
    required String language,
    required String topic,
    String level = 'A1',
    String category = 'vocabulary',
    int exerciseCount = 10,
  }) async {
    final response = await _api.post('/lessons/generate', data: {
      'language': language,
      'topic': topic,
      'level': level,
      'category': category,
      'exerciseCount': exerciseCount,
    });
    return GeneratedLesson.fromJson(response.data['data']);
  }

  // Generate exercises only
  Future<List<Exercise>> generateExercises({
    required String language,
    required String topic,
    String level = 'A1',
    List<String>? exerciseTypes,
    int count = 10,
  }) async {
    final response = await _api.post('/lessons/generate/exercises', data: {
      'language': language,
      'topic': topic,
      'level': level,
      'exerciseTypes': exerciseTypes,
      'count': count,
    });
    return (response.data['data']['exercises'] as List)
        .map((e) => Exercise.fromJson(e))
        .toList();
  }

  // Generate vocabulary
  Future<VocabularyList> generateVocabulary({
    required String language,
    required String topic,
    String level = 'A1',
    int count = 20,
  }) async {
    final response = await _api.post('/lessons/generate/vocabulary', data: {
      'language': language,
      'topic': topic,
      'level': level,
      'count': count,
    });
    return VocabularyList.fromJson(response.data['data']);
  }

  // Enhance existing lesson
  Future<EnhanceResult> enhanceLesson(
    String lessonId, {
    int addExercises = 5,
    bool addContent = true,
  }) async {
    final response = await _api.post('/lessons/$lessonId/enhance', data: {
      'addExercises': addExercises,
      'addContent': addContent,
    });
    return EnhanceResult.fromJson(response.data['data']);
  }

  // Get AI-generated lessons
  Future<LessonListResult> getAILessons({
    String? language,
    String? level,
    String? category,
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _api.get('/lessons/ai-generated', queryParameters: {
      if (language != null) 'language': language,
      if (level != null) 'level': level,
      if (category != null) 'category': category,
      'page': page,
      'limit': limit,
    });
    return LessonListResult.fromJson(response.data['data']);
  }

  // Get available templates
  Future<TemplatesInfo> getTemplates() async {
    final response = await _api.get('/lessons/templates');
    return TemplatesInfo.fromJson(response.data['data']);
  }
}
```

---

## Quick Reference

### Generate Lesson Flow

```
1. GET /lessons/templates           → Get available options
2. POST /lessons/generate           → Generate lesson
3. GET /api/v1/learning/lessons/:id → View lesson (via learning API)
4. POST /lessons/:id/enhance        → Add more content (optional)
```

### Supported Languages

| Code | Language | Code | Language |
|------|----------|------|----------|
| `en` | English | `ru` | Russian |
| `es` | Spanish | `zh` | Chinese |
| `fr` | French | `ja` | Japanese |
| `de` | German | `ko` | Korean |
| `it` | Italian | `ar` | Arabic |
| `pt` | Portuguese | | |

### CEFR Levels

| Level | Description | Vocabulary | Grammar |
|-------|-------------|------------|---------|
| A1 | Beginner | Basic everyday | Simple present/past |
| A2 | Elementary | Common everyday | Present, past, future |
| B1 | Intermediate | Intermediate + idioms | Most tenses, conditionals |
| B2 | Upper Intermediate | Abstract concepts | Complex structures |
| C1 | Advanced | Advanced + expressions | Nuanced grammar |
| C2 | Proficiency | Native-like | Full range |
