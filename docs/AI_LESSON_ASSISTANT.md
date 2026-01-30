# AI Lesson Assistant - Complete Guide

Interactive AI assistant that helps users during lesson learning with hints, explanations, feedback, and more.

## Overview

The AI Lesson Assistant provides real-time help during lessons:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI LESSON ASSISTANT                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🎯 HINTS          - Progressive hints (Level 1 → 2 → 3)       │
│  📚 EXPLAIN        - Explain any concept with examples          │
│  ✏️ FEEDBACK       - Detailed feedback on wrong answers         │
│  ❓ ASK            - Ask any question about the lesson          │
│  🔄 PRACTICE       - Generate similar practice exercises        │
│  📝 SUMMARY        - AI-generated lesson review                 │
│  🌐 TRANSLATE      - Word-by-word translation help              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Base URL

```
/api/v1/learning
```

## Authentication

All endpoints require authentication via Bearer token:

```
Authorization: Bearer <access_token>
```

---

## 1. Get Exercise Hint

Get progressive hints for exercises without revealing the answer.

### Endpoint

```http
POST /lessons/:lessonId/assistant/hint
```

### Request

| Field           | Type   | Required | Description                     |
| --------------- | ------ | -------- | ------------------------------- |
| `exerciseIndex` | number | Yes      | Index of the exercise (0-based) |
| `hintLevel`     | number | No       | Hint level 1-3 (default: 1)     |

**Hint Levels:**

- **Level 1**: Subtle hint - points in the right direction
- **Level 2**: Helpful hint - narrows down options
- **Level 3**: Strong hint - almost reveals the answer

### Example Request

```json
{
  "exerciseIndex": 0,
  "hintLevel": 1
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "hint": "Think about the verb ending for first person singular (-o) in -ar verbs...",
    "hintLevel": 1,
    "hasMoreHints": true,
    "encouragement": "You're on the right track! 💪"
  }
}
```

### Flutter Implementation

```dart
class HintService {
  int _currentHintLevel = 0;

  Future<HintResponse> getHint(String lessonId, int exerciseIndex) async {
    _currentHintLevel = (_currentHintLevel % 3) + 1;

    final response = await api.post(
      '/learning/lessons/$lessonId/assistant/hint',
      data: {
        'exerciseIndex': exerciseIndex,
        'hintLevel': _currentHintLevel,
      },
    );

    return HintResponse.fromJson(response.data['data']);
  }

  void resetHints() {
    _currentHintLevel = 0;
  }
}

// Usage in UI
ElevatedButton(
  onPressed: () async {
    final hint = await hintService.getHint(lessonId, currentExercise);
    showHintDialog(hint);
  },
  child: Text('💡 Get Hint'),
)
```

---

## 2. Explain a Concept

Get detailed explanation of any grammar rule, vocabulary, or concept.

### Endpoint

```http
POST /lessons/:lessonId/assistant/explain
```

### Request

| Field     | Type   | Required | Description                               |
| --------- | ------ | -------- | ----------------------------------------- |
| `concept` | string | Yes      | The concept to explain                    |
| `context` | string | No       | Additional context for better explanation |

### Example Request

```json
{
  "concept": "ser vs estar",
  "context": "I'm confused about when to use each one"
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "concept": "ser vs estar",
    "explanation": "Both 'ser' and 'estar' mean 'to be' in English, but they're used in different situations:\n\n• SER is for permanent or inherent characteristics\n• ESTAR is for temporary states, locations, or conditions",
    "examples": [
      {
        "sentence": "Yo soy mexicano",
        "translation": "I am Mexican (permanent nationality)"
      },
      {
        "sentence": "Yo estoy cansado",
        "translation": "I am tired (temporary state)"
      },
      {
        "sentence": "El libro es rojo",
        "translation": "The book is red (inherent color)"
      },
      {
        "sentence": "María está en casa",
        "translation": "María is at home (location)"
      }
    ],
    "tip": "Remember: If it can change, use ESTAR! 🔄",
    "relatedConcepts": [
      "verb conjugation",
      "adjective agreement",
      "location expressions"
    ]
  }
}
```

### Flutter Implementation

```dart
Future<ExplanationResponse> explainConcept(
  String lessonId,
  String concept, {
  String? context,
}) async {
  final response = await api.post(
    '/learning/lessons/$lessonId/assistant/explain',
    data: {
      'concept': concept,
      if (context != null) 'context': context,
    },
  );
  return ExplanationResponse.fromJson(response.data['data']);
}

// Usage - when user taps on a word or grammar point
GestureDetector(
  onTap: () async {
    final explanation = await explainConcept(
      lessonId,
      selectedWord,
      context: 'From exercise $exerciseIndex',
    );
    showExplanationBottomSheet(explanation);
  },
  child: Text(selectedWord, style: TextStyle(decoration: TextDecoration.underline)),
)
```

---

## 3. Get Feedback on Wrong Answer

Get detailed, constructive feedback when user answers incorrectly.

### Endpoint

```http
POST /lessons/:lessonId/assistant/feedback
```

### Request

| Field           | Type   | Required | Description                 |
| --------------- | ------ | -------- | --------------------------- |
| `exerciseIndex` | number | Yes      | Index of the exercise       |
| `userAnswer`    | any    | Yes      | The user's incorrect answer |

### Example Request

```json
{
  "exerciseIndex": 2,
  "userAnswer": "hablas"
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "userAnswer": "hablas",
    "correctAnswer": "hablo",
    "feedback": "You used 'hablas' which is the 'tú' (you informal) form. The question asked for the 'yo' (I) form.",
    "correction": "For 'yo' with -ar verbs, remove '-ar' and add '-o'. So 'hablar' → 'hablo'",
    "explanation": "Spanish verb conjugation changes the ending based on the subject:\n• Yo → -o (hablo)\n• Tú → -as (hablas)\n• Él/Ella → -a (habla)",
    "commonMistake": "Mixing up 'yo' and 'tú' conjugations is very common for beginners. The endings are similar but different!",
    "encouragement": "Don't worry! This is one of the trickiest parts of Spanish. Keep practicing and it will become natural! 🌟"
  }
}
```

### Flutter Implementation

```dart
// Call this after submitAnswer returns isCorrect: false
Future<void> handleWrongAnswer(
  String lessonId,
  int exerciseIndex,
  dynamic userAnswer,
) async {
  final feedback = await api.post(
    '/learning/lessons/$lessonId/assistant/feedback',
    data: {
      'exerciseIndex': exerciseIndex,
      'userAnswer': userAnswer,
    },
  );

  final data = feedback.data['data'];

  showModalBottomSheet(
    context: context,
    builder: (_) => FeedbackSheet(
      userAnswer: data['userAnswer'],
      correctAnswer: data['correctAnswer'],
      feedback: data['feedback'],
      correction: data['correction'],
      explanation: data['explanation'],
      encouragement: data['encouragement'],
    ),
  );
}
```

---

## 4. Ask a Question

Ask any question about the lesson content.

### Endpoint

```http
POST /lessons/:lessonId/assistant/ask
```

### Request

| Field      | Type   | Required | Description     |
| ---------- | ------ | -------- | --------------- |
| `question` | string | Yes      | User's question |

### Example Request

```json
{
  "question": "Why do some Spanish verbs change their stem in certain conjugations?"
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "question": "Why do some Spanish verbs change their stem in certain conjugations?",
    "answer": "These are called 'stem-changing verbs' or 'boot verbs'. The stem vowel changes in certain forms to maintain pronunciation patterns that developed over centuries. For example, 'e' can change to 'ie' (querer → quiero) or 'o' can change to 'ue' (poder → puedo).",
    "examples": [
      {
        "sentence": "Yo quiero agua",
        "translation": "I want water (e → ie change)"
      },
      {
        "sentence": "Nosotros queremos agua",
        "translation": "We want water (no change in nosotros/vosotros)"
      }
    ],
    "additionalInfo": "The changes happen in all forms EXCEPT nosotros and vosotros, which is why they're called 'boot verbs' - if you draw a line around the changed forms, it looks like a boot!",
    "suggestedFocus": "Practice with common stem-changing verbs: querer, poder, dormir, pensar"
  }
}
```

### Flutter Implementation

```dart
// Chat-like interface for asking questions
class LessonChatWidget extends StatefulWidget {
  final String lessonId;

  @override
  _LessonChatWidgetState createState() => _LessonChatWidgetState();
}

class _LessonChatWidgetState extends State<LessonChatWidget> {
  final TextEditingController _controller = TextEditingController();
  final List<ChatMessage> _messages = [];
  bool _isLoading = false;

  Future<void> _askQuestion() async {
    final question = _controller.text.trim();
    if (question.isEmpty) return;

    setState(() {
      _messages.add(ChatMessage(text: question, isUser: true));
      _isLoading = true;
    });
    _controller.clear();

    try {
      final response = await api.post(
        '/learning/lessons/${widget.lessonId}/assistant/ask',
        data: {'question': question},
      );

      final data = response.data['data'];
      setState(() {
        _messages.add(ChatMessage(
          text: data['answer'],
          isUser: false,
          examples: data['examples'],
        ));
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(child: ListView.builder(...)),
        TextField(
          controller: _controller,
          decoration: InputDecoration(
            hintText: 'Ask anything about this lesson...',
            suffixIcon: IconButton(
              icon: Icon(Icons.send),
              onPressed: _askQuestion,
            ),
          ),
        ),
      ],
    );
  }
}
```

---

## 5. Generate Practice Variations

Generate similar exercises for extra practice.

### Endpoint

```http
POST /lessons/:lessonId/assistant/practice
```

### Request

| Field           | Type   | Required | Description                                 |
| --------------- | ------ | -------- | ------------------------------------------- |
| `exerciseIndex` | number | Yes      | Index of the exercise to base variations on |
| `count`         | number | No       | Number of variations (1-5, default: 3)      |

### Example Request

```json
{
  "exerciseIndex": 0,
  "count": 3
}
```

### Example Response

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
        "question": "Yo ___ (comer) pizza todos los días.",
        "targetText": null,
        "options": null,
        "correctAnswer": "como",
        "acceptedAnswers": ["como"],
        "explanation": "For -er verbs, the 'yo' form ends in -o. Remove -er, add -o."
      },
      {
        "type": "fill_blank",
        "question": "Yo ___ (vivir) en una casa grande.",
        "targetText": null,
        "options": null,
        "correctAnswer": "vivo",
        "acceptedAnswers": ["vivo"],
        "explanation": "For -ir verbs, the 'yo' form also ends in -o. Remove -ir, add -o."
      },
      {
        "type": "fill_blank",
        "question": "Yo ___ (escribir) cartas a mi abuela.",
        "targetText": null,
        "options": null,
        "correctAnswer": "escribo",
        "acceptedAnswers": ["escribo"],
        "explanation": "Another -ir verb. Pattern: escribir → escrib- → escribo"
      }
    ]
  }
}
```

### Flutter Implementation

```dart
class PracticeVariationsWidget extends StatefulWidget {
  final String lessonId;
  final int exerciseIndex;

  @override
  _PracticeVariationsWidgetState createState() => _PracticeVariationsWidgetState();
}

class _PracticeVariationsWidgetState extends State<PracticeVariationsWidget> {
  List<Exercise>? variations;
  int currentVariation = 0;

  Future<void> loadVariations() async {
    final response = await api.post(
      '/learning/lessons/${widget.lessonId}/assistant/practice',
      data: {
        'exerciseIndex': widget.exerciseIndex,
        'count': 3,
      },
    );

    setState(() {
      variations = (response.data['data']['variations'] as List)
          .map((v) => Exercise.fromJson(v))
          .toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (variations == null) {
      return ElevatedButton(
        onPressed: loadVariations,
        child: Text('🔄 Practice More Like This'),
      );
    }

    return ExerciseWidget(
      exercise: variations![currentVariation],
      onComplete: () {
        if (currentVariation < variations!.length - 1) {
          setState(() => currentVariation++);
        } else {
          Navigator.pop(context);
        }
      },
    );
  }
}
```

---

## 6. Get Lesson Summary

Get an AI-generated summary after completing a lesson.

### Endpoint

```http
GET /lessons/:lessonId/assistant/summary
```

### Example Response

```json
{
  "success": true,
  "data": {
    "lessonTitle": "Present Tense Regular Verbs",
    "lessonTopic": "verb conjugation",
    "summary": "In this lesson, you learned how to conjugate regular -ar, -er, and -ir verbs in the present tense. You practiced identifying the correct endings for each subject pronoun.",
    "keyPoints": [
      "Regular -ar verbs: -o, -as, -a, -amos, -áis, -an",
      "Regular -er verbs: -o, -es, -e, -emos, -éis, -en",
      "Regular -ir verbs: -o, -es, -e, -imos, -ís, -en",
      "The 'yo' form always ends in -o for regular verbs"
    ],
    "vocabularyToRemember": [
      {
        "word": "hablar",
        "translation": "to speak",
        "usage": "Yo hablo español con mis amigos"
      },
      {
        "word": "comer",
        "translation": "to eat",
        "usage": "Nosotros comemos a las dos"
      },
      {
        "word": "vivir",
        "translation": "to live",
        "usage": "Ellos viven en Madrid"
      }
    ],
    "grammarRules": [
      "Subject pronouns (yo, tú, él...) can often be omitted because the verb ending indicates the subject",
      "The stem of regular verbs doesn't change - only the ending"
    ],
    "practiceRecommendation": "Focus on practicing the 'tú' and 'él/ella' forms, as you made a few mistakes there. Try the AI Quiz feature!",
    "encouragement": "Excellent work! You scored 85% on this lesson. You're making great progress with verb conjugations! 🎉",
    "userScore": 85,
    "isPerfect": false
  }
}
```

### Flutter Implementation

```dart
class LessonSummaryScreen extends StatelessWidget {
  final String lessonId;

  Future<LessonSummary> _loadSummary() async {
    final response = await api.get(
      '/learning/lessons/$lessonId/assistant/summary',
    );
    return LessonSummary.fromJson(response.data['data']);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<LessonSummary>(
      future: _loadSummary(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return Center(child: CircularProgressIndicator());
        }

        final summary = snapshot.data!;

        return SingleChildScrollView(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Score Card
              ScoreCard(
                score: summary.userScore,
                isPerfect: summary.isPerfect,
              ),

              SizedBox(height: 24),

              // Summary
              Text('Summary', style: Theme.of(context).textTheme.titleLarge),
              Text(summary.summary),

              SizedBox(height: 24),

              // Key Points
              Text('Key Points', style: Theme.of(context).textTheme.titleLarge),
              ...summary.keyPoints.map((point) => ListTile(
                leading: Icon(Icons.check_circle, color: Colors.green),
                title: Text(point),
              )),

              SizedBox(height: 24),

              // Vocabulary to Remember
              Text('Vocabulary', style: Theme.of(context).textTheme.titleLarge),
              ...summary.vocabularyToRemember.map((vocab) => VocabCard(
                word: vocab['word'],
                translation: vocab['translation'],
                usage: vocab['usage'],
              )),

              SizedBox(height: 24),

              // Recommendation
              Card(
                color: Colors.blue.shade50,
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text('What to Practice Next'),
                      Text(summary.practiceRecommendation),
                      ElevatedButton(
                        onPressed: () => Navigator.pushNamed(
                          context,
                          '/quiz/generate',
                          arguments: {'type': 'weak_areas'},
                        ),
                        child: Text('Start AI Quiz'),
                      ),
                    ],
                  ),
                ),
              ),

              SizedBox(height: 24),

              // Encouragement
              Text(
                summary.encouragement,
                style: TextStyle(fontSize: 18, fontStyle: FontStyle.italic),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        );
      },
    );
  }
}
```

---

## 7. Translation Help

Get detailed translation with word breakdown.

### Endpoint

```http
POST /assistant/translate
```

### Request

| Field            | Type   | Required | Description                    |
| ---------------- | ------ | -------- | ------------------------------ |
| `text`           | string | Yes      | Text to translate              |
| `sourceLanguage` | string | Yes      | Source language code           |
| `targetLanguage` | string | Yes      | Target language code           |
| `context`        | string | No       | Context for better translation |

### Example Request

```json
{
  "text": "Me gustaría reservar una mesa para dos",
  "sourceLanguage": "es",
  "targetLanguage": "en",
  "context": "restaurant reservation"
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "originalText": "Me gustaría reservar una mesa para dos",
    "sourceLanguage": "es",
    "targetLanguage": "en",
    "translation": "I would like to reserve a table for two",
    "literal": "To me it would please to reserve a table for two",
    "breakdown": [
      {
        "word": "Me gustaría",
        "translation": "I would like",
        "note": "Conditional form of 'gustar' - literally 'it would please me'"
      },
      {
        "word": "reservar",
        "translation": "to reserve",
        "note": "Infinitive verb"
      },
      {
        "word": "una mesa",
        "translation": "a table",
        "note": "Feminine noun with indefinite article"
      },
      {
        "word": "para dos",
        "translation": "for two",
        "note": "'Para' indicates purpose/destination"
      }
    ],
    "alternatives": [
      "I'd like to book a table for two",
      "Could I reserve a table for two people?"
    ],
    "culturalNote": "In Spanish-speaking countries, it's polite to use the conditional 'gustaría' rather than the direct 'quiero' (I want) when making requests."
  }
}
```

---

## Complete Lesson Flow with AI Assistant

```
┌────────────────────────────────────────────────────────────────────┐
│                     LESSON LEARNING FLOW                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────┐                                              │
│  │  START LESSON    │  POST /lessons/:id/start                     │
│  └────────┬─────────┘                                              │
│           │                                                        │
│           ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    EXERCISE LOOP                              │  │
│  │                                                               │  │
│  │   ┌─────────────┐     ┌─────────────────────────────────┐    │  │
│  │   │  Display    │     │  🤖 AI ASSISTANT OPTIONS         │    │  │
│  │   │  Exercise   │────▶│                                  │    │  │
│  │   └─────────────┘     │  • 💡 Get Hint (1→2→3)           │    │  │
│  │         │             │  • 📚 Explain Concept             │    │  │
│  │         │             │  • ❓ Ask Question                │    │  │
│  │         ▼             │  • 🌐 Translate Text              │    │  │
│  │   ┌─────────────┐     └─────────────────────────────────┘    │  │
│  │   │   Submit    │                                             │  │
│  │   │   Answer    │  POST /lessons/:id/answer                   │  │
│  │   └──────┬──────┘                                             │  │
│  │          │                                                    │  │
│  │    ┌─────┴─────┐                                              │  │
│  │    │           │                                              │  │
│  │    ▼           ▼                                              │  │
│  │ ┌──────┐   ┌──────┐                                           │  │
│  │ │  ✓   │   │  ✗   │                                           │  │
│  │ │Correct│   │Wrong │                                           │  │
│  │ └──┬───┘   └──┬───┘                                           │  │
│  │    │          │                                               │  │
│  │    │          ▼                                               │  │
│  │    │   ┌──────────────┐                                       │  │
│  │    │   │ 🤖 AI        │  POST /lessons/:id/assistant/feedback │  │
│  │    │   │ Feedback     │                                       │  │
│  │    │   └──────┬───────┘                                       │  │
│  │    │          │                                               │  │
│  │    │          ▼                                               │  │
│  │    │   ┌──────────────┐                                       │  │
│  │    │   │ 🔄 Practice  │  POST /lessons/:id/assistant/practice │  │
│  │    │   │ More?        │  (optional)                           │  │
│  │    │   └──────────────┘                                       │  │
│  │    │          │                                               │  │
│  │    └────┬─────┘                                               │  │
│  │         │                                                     │  │
│  │         ▼                                                     │  │
│  │   ┌─────────────┐                                             │  │
│  │   │ Next Exercise│ ──────────────────────┐                    │  │
│  │   └─────────────┘                        │ (repeat)           │  │
│  │                                          │                    │  │
│  └──────────────────────────────────────────┘                    │  │
│                                                                    │
│           │ (all exercises done)                                   │
│           ▼                                                        │
│  ┌──────────────────┐                                              │
│  │ COMPLETE LESSON  │  POST /lessons/:id/complete                  │
│  └────────┬─────────┘                                              │
│           │                                                        │
│           ▼                                                        │
│  ┌──────────────────┐                                              │
│  │ 📝 AI SUMMARY    │  GET /lessons/:id/assistant/summary          │
│  │                  │                                              │
│  │  • Key Points    │                                              │
│  │  • Vocabulary    │                                              │
│  │  • What to       │                                              │
│  │    Practice Next │                                              │
│  └──────────────────┘                                              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

```env
# Enable/Disable AI Lesson Assistant
AI_LESSON_ASSISTANT_ENABLED=true
```

### Rate Limits

| User Tier | Daily Limit | Monthly Limit |
| --------- | ----------- | ------------- |
| Free      | 30          | 300           |
| Regular   | 100         | 1,000         |
| VIP       | Unlimited   | Unlimited     |

### AI Settings

```javascript
// config/aiConfig.js
{
  maxTokens: {
    lessonAssistant: 1500
  },
  temperature: {
    lessonAssistant: 0.4  // Balanced between creative and accurate
  }
}
```

---

## Error Handling

### Common Errors

| Error                                | Cause                  | Solution                              |
| ------------------------------------ | ---------------------- | ------------------------------------- |
| `AI lesson assistant is not enabled` | Feature disabled       | Check `AI_LESSON_ASSISTANT_ENABLED`   |
| `Lesson not found`                   | Invalid lesson ID      | Verify lesson ID exists               |
| `Exercise not found`                 | Invalid exercise index | Check exercise index is within bounds |
| `Rate limit exceeded`                | Too many requests      | Wait or upgrade to premium            |

### Flutter Error Handling

```dart
Future<T> callAssistant<T>(Future<T> Function() apiCall) async {
  try {
    return await apiCall();
  } on DioException catch (e) {
    final statusCode = e.response?.statusCode;
    final error = e.response?.data['error'] ?? 'Unknown error';

    switch (statusCode) {
      case 429:
        throw RateLimitException('Daily limit reached. Try again tomorrow!');
      case 403:
        if (error.contains('not enabled')) {
          throw FeatureDisabledException('AI Assistant is not available');
        }
        throw PermissionException(error);
      case 404:
        throw NotFoundException(error);
      default:
        throw ApiException(error);
    }
  }
}
```

---

## Best Practices

### 1. Progressive Hints

```dart
// Start with level 1, increase only if user asks again
int hintLevel = 1;

void onHintRequested() {
  getHint(lessonId, exerciseIndex, level: hintLevel);
  if (hintLevel < 3) hintLevel++;
}
```

### 2. Cache Explanations

```dart
// Cache explanations to avoid redundant API calls
final Map<String, ExplanationResponse> _explanationCache = {};

Future<ExplanationResponse> getCachedExplanation(String concept) {
  return _explanationCache.putIfAbsent(
    concept,
    () => explainConcept(lessonId, concept),
  );
}
```

### 3. Show Feedback Automatically

```dart
// Automatically show AI feedback on wrong answers
void onAnswerSubmitted(AnswerResult result) {
  if (!result.isCorrect) {
    // Immediately fetch and show AI feedback
    getAnswerFeedback(lessonId, exerciseIndex, userAnswer)
      .then(showFeedbackSheet);
  }
}
```

### 4. Pre-load Summary

```dart
// Start loading summary before lesson completion
void onLastExercise() {
  // Pre-fetch summary in background
  _summaryFuture = getLessonSummary(lessonId);
}

void onLessonComplete() {
  // Summary is already loaded or nearly loaded
  _summaryFuture.then(showSummaryScreen);
}
```

---

## Language Codes Reference

| Code | Language   |
| ---- | ---------- |
| `en` | English    |
| `es` | Spanish    |
| `fr` | French     |
| `de` | German     |
| `it` | Italian    |
| `pt` | Portuguese |
| `ru` | Russian    |
| `zh` | Chinese    |
| `ja` | Japanese   |
| `ko` | Korean     |
| `ar` | Arabic     |
| `hi` | Hindi      |
| `tr` | Turkish    |
| `nl` | Dutch      |
| `pl` | Polish     |
