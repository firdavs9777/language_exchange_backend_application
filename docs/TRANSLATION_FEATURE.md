# HelloTalk-Style Translation Feature

Complete translation system with word-by-word breakdown, TTS, and vocabulary saving.

---

## API Endpoints

### 1. Translate Message

Translates a message with full word breakdown (HelloTalk/Tandem style).

**Endpoint:** `POST /api/v1/messages/:id/translate`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "targetLanguage": "en",
  "sourceLanguage": "zh"  // optional, auto-detected if not provided
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "language": "en",
    "translatedText": "How are you?",
    "transliteration": "nǐ hǎo ma",
    "breakdown": [
      {
        "word": "你",
        "meaning": "you",
        "pronunciation": "nǐ",
        "partOfSpeech": "pronoun"
      },
      {
        "word": "好",
        "meaning": "good/well",
        "pronunciation": "hǎo",
        "partOfSpeech": "adjective"
      },
      {
        "word": "吗",
        "meaning": "(question particle)",
        "pronunciation": "ma",
        "partOfSpeech": "particle"
      }
    ],
    "alternatives": [
      {
        "text": "How do you do?",
        "context": "formal",
        "formality": "formal"
      }
    ],
    "grammar": [
      {
        "aspect": "word_order",
        "sourceRule": "Subject + Adjective + Particle",
        "targetRule": "How + are + Subject",
        "example": "你好吗 → How are you"
      }
    ],
    "idioms": [],
    "cultural": {
      "notes": "Common greeting in Mandarin Chinese",
      "formality": "neutral"
    },
    "translatedAt": "2024-03-24T10:30:00Z",
    "cached": false
  }
}
```

---

### 2. Text-to-Speech (TTS)

Generate audio pronunciation for a message.

**Endpoint:** `POST /api/v1/messages/:id/tts`

**Request Body:**
```json
{
  "language": "zh",
  "speed": 1.0  // 0.5 to 2.0, default 1.0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "audioUrl": "https://my-projects-media.sfo3.cdn.digitaloceanspaces.com/bananatalk/tts/1234567890.mp3",
    "duration": 2.5,
    "cached": true
  }
}
```

---

### 3. Save Word to Vocabulary

Save a word from the translation breakdown to user's vocabulary for flashcard review.

**Endpoint:** `POST /api/v1/messages/:id/vocabulary`

**Request Body:**
```json
{
  "word": "你好",
  "translation": "hello",
  "pronunciation": "nǐ hǎo",
  "language": "zh",
  "partOfSpeech": "phrase"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "abc123",
    "user": "user123",
    "word": "你好",
    "translation": "hello",
    "pronunciation": "nǐ hǎo",
    "language": "zh",
    "partOfSpeech": "phrase",
    "context": {
      "source": "conversation",
      "messageId": "msg123",
      "originalSentence": "你好吗？"
    },
    "srsLevel": 0,
    "nextReview": "2024-03-24T10:30:00Z"
  },
  "message": "Word saved to vocabulary"
}
```

---

### 4. Get All Translations for a Message

Get all cached translations for a message.

**Endpoint:** `GET /api/v1/messages/:id/translations`

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "language": "en",
      "translatedText": "How are you?",
      "transliteration": "nǐ hǎo ma",
      "breakdown": [...],
      "translatedAt": "2024-03-24T10:30:00Z",
      "provider": "openai"
    },
    {
      "language": "ja",
      "translatedText": "お元気ですか？",
      "transliteration": "nǐ hǎo ma",
      "breakdown": [...],
      "translatedAt": "2024-03-24T11:00:00Z",
      "provider": "openai"
    }
  ]
}
```

---

## Frontend Implementation Guide

### UI Components Needed

#### 1. Translation Button on Message Bubble

```
┌─────────────────────────────────────────┐
│ 你好吗？                                 │
│                            [Translate]  │
└─────────────────────────────────────────┘
```

#### 2. Translation Result View

```
┌─────────────────────────────────────────┐
│ 你好吗                                   │  ← Original message
├─────────────────────────────────────────┤
│ How are you?                            │  ← Translation
│ nǐ hǎo ma                               │  ← Transliteration (gray text)
├─────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐                 │
│ │ 你  │ │ 好  │ │ 吗  │                 │  ← Tappable word chips
│ └─────┘ └─────┘ └─────┘                 │
├─────────────────────────────────────────┤
│ [🔊 Listen]                    [Close]  │  ← TTS button
└─────────────────────────────────────────┘
```

#### 3. Word Detail Popup (on word tap)

```
┌─────────────────────────┐
│       你                │  ← Word
│       nǐ               │  ← Pronunciation
│    ─────────           │
│    "you"               │  ← Meaning
│    pronoun             │  ← Part of speech
│                        │
│  [🔊 Listen] [💾 Save] │  ← Actions
└─────────────────────────┘
```

---

### Flutter Code Example

#### Translation Service

```dart
class TranslationService {
  final ApiClient _api;

  TranslationService(this._api);

  /// Translate a message with word breakdown
  Future<TranslationResult> translateMessage(
    String messageId,
    String targetLanguage, {
    String? sourceLanguage,
  }) async {
    final response = await _api.post(
      '/messages/$messageId/translate',
      body: {
        'targetLanguage': targetLanguage,
        if (sourceLanguage != null) 'sourceLanguage': sourceLanguage,
      },
    );
    return TranslationResult.fromJson(response['data']);
  }

  /// Get TTS audio URL for a message
  Future<TTSResult> getMessageTTS(
    String messageId,
    String language, {
    double speed = 1.0,
  }) async {
    final response = await _api.post(
      '/messages/$messageId/tts',
      body: {
        'language': language,
        'speed': speed,
      },
    );
    return TTSResult.fromJson(response['data']);
  }

  /// Save word to vocabulary
  Future<void> saveToVocabulary(
    String messageId, {
    required String word,
    required String translation,
    String? pronunciation,
    required String language,
    String? partOfSpeech,
  }) async {
    await _api.post(
      '/messages/$messageId/vocabulary',
      body: {
        'word': word,
        'translation': translation,
        if (pronunciation != null) 'pronunciation': pronunciation,
        'language': language,
        if (partOfSpeech != null) 'partOfSpeech': partOfSpeech,
      },
    );
  }
}
```

#### Translation Result Model

```dart
class TranslationResult {
  final String language;
  final String translatedText;
  final String? transliteration;
  final List<WordBreakdown> breakdown;
  final List<Alternative> alternatives;
  final bool cached;

  TranslationResult({
    required this.language,
    required this.translatedText,
    this.transliteration,
    required this.breakdown,
    required this.alternatives,
    required this.cached,
  });

  factory TranslationResult.fromJson(Map<String, dynamic> json) {
    return TranslationResult(
      language: json['language'],
      translatedText: json['translatedText'],
      transliteration: json['transliteration'],
      breakdown: (json['breakdown'] as List?)
          ?.map((w) => WordBreakdown.fromJson(w))
          .toList() ?? [],
      alternatives: (json['alternatives'] as List?)
          ?.map((a) => Alternative.fromJson(a))
          .toList() ?? [],
      cached: json['cached'] ?? false,
    );
  }
}

class WordBreakdown {
  final String word;
  final String meaning;
  final String? pronunciation;
  final String? partOfSpeech;

  WordBreakdown({
    required this.word,
    required this.meaning,
    this.pronunciation,
    this.partOfSpeech,
  });

  factory WordBreakdown.fromJson(Map<String, dynamic> json) {
    return WordBreakdown(
      word: json['word'],
      meaning: json['meaning'],
      pronunciation: json['pronunciation'],
      partOfSpeech: json['partOfSpeech'],
    );
  }
}
```

#### Translation Widget

```dart
class TranslationView extends StatefulWidget {
  final String messageId;
  final String originalText;
  final String targetLanguage;

  const TranslationView({
    required this.messageId,
    required this.originalText,
    required this.targetLanguage,
  });

  @override
  State<TranslationView> createState() => _TranslationViewState();
}

class _TranslationViewState extends State<TranslationView> {
  TranslationResult? _translation;
  bool _isLoading = true;
  AudioPlayer? _audioPlayer;

  @override
  void initState() {
    super.initState();
    _loadTranslation();
  }

  Future<void> _loadTranslation() async {
    try {
      final result = await TranslationService().translateMessage(
        widget.messageId,
        widget.targetLanguage,
      );
      setState(() {
        _translation = result;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      // Handle error
    }
  }

  Future<void> _playTTS() async {
    final tts = await TranslationService().getMessageTTS(
      widget.messageId,
      _translation?.language ?? 'en',
    );
    _audioPlayer = AudioPlayer();
    await _audioPlayer?.play(UrlSource(tts.audioUrl));
  }

  void _showWordDetail(WordBreakdown word) {
    showModalBottomSheet(
      context: context,
      builder: (context) => WordDetailSheet(
        word: word,
        messageId: widget.messageId,
        language: _translation?.language ?? 'unknown',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Center(child: CircularProgressIndicator());
    }

    if (_translation == null) {
      return Text('Translation failed');
    }

    return Container(
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Original text
          Text(
            widget.originalText,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
          ),
          Divider(),

          // Translation
          Text(
            _translation!.translatedText,
            style: TextStyle(fontSize: 16),
          ),

          // Transliteration
          if (_translation!.transliteration != null)
            Text(
              _translation!.transliteration!,
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
            ),

          SizedBox(height: 12),

          // Word breakdown chips
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _translation!.breakdown.map((word) {
              return GestureDetector(
                onTap: () => _showWordDetail(word),
                child: Chip(
                  label: Text(word.word),
                  backgroundColor: Colors.blue[50],
                ),
              );
            }).toList(),
          ),

          SizedBox(height: 12),

          // TTS button
          ElevatedButton.icon(
            onPressed: _playTTS,
            icon: Icon(Icons.volume_up),
            label: Text('Listen'),
          ),
        ],
      ),
    );
  }
}
```

#### Word Detail Bottom Sheet

```dart
class WordDetailSheet extends StatelessWidget {
  final WordBreakdown word;
  final String messageId;
  final String language;

  const WordDetailSheet({
    required this.word,
    required this.messageId,
    required this.language,
  });

  Future<void> _saveToVocabulary(BuildContext context) async {
    try {
      await TranslationService().saveToVocabulary(
        messageId,
        word: word.word,
        translation: word.meaning,
        pronunciation: word.pronunciation,
        language: language,
        partOfSpeech: word.partOfSpeech,
      );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Saved to vocabulary!')),
      );
      Navigator.pop(context);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to save')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            word.word,
            style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
          ),
          if (word.pronunciation != null)
            Text(
              word.pronunciation!,
              style: TextStyle(fontSize: 18, color: Colors.grey[600]),
            ),
          SizedBox(height: 16),
          Text(
            word.meaning,
            style: TextStyle(fontSize: 20),
          ),
          if (word.partOfSpeech != null)
            Text(
              word.partOfSpeech!,
              style: TextStyle(fontSize: 14, color: Colors.grey),
            ),
          SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              ElevatedButton.icon(
                onPressed: () {
                  // Play TTS for single word
                },
                icon: Icon(Icons.volume_up),
                label: Text('Listen'),
              ),
              ElevatedButton.icon(
                onPressed: () => _saveToVocabulary(context),
                icon: Icon(Icons.bookmark_add),
                label: Text('Save'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
```

---

## Language Codes Reference

| Language | Code |
|----------|------|
| English | `en` |
| Chinese (Simplified) | `zh` |
| Chinese (Traditional) | `zh-TW` |
| Japanese | `ja` |
| Korean | `ko` |
| Spanish | `es` |
| French | `fr` |
| German | `de` |
| Portuguese | `pt` |
| Russian | `ru` |
| Arabic | `ar` |
| Hindi | `hi` |
| Thai | `th` |
| Vietnamese | `vi` |
| Indonesian | `id` |

---

## Rate Limits

| User Tier | Translations/Day | TTS/Day |
|-----------|------------------|---------|
| Free | 30 | 50 |
| Regular | 50 | 100 |
| VIP | Unlimited | Unlimited |

---

## Caching Behavior

- **Translation**: Cached globally (same text = same translation for all users)
- **TTS Audio**: Cached for 90 days
- **Message Translation**: Stored on message document for instant retrieval

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Target language is required | Missing `targetLanguage` in request |
| 400 | Message has no text to translate | Message is empty or media-only |
| 404 | Message not found | Invalid message ID |
| 500 | Translation failed | AI service error, retry |

---

## Backend Files Modified

| File | Changes |
|------|---------|
| `controllers/advancedMessages.js` | Added `translateMessage`, `getMessageTTS`, `saveToVocabulary` |
| `routes/messages.js` | Added routes for TTS and vocabulary |
| `models/Message.js` | Extended translation schema with breakdown |

---

## Dependencies

The translation feature uses existing services:
- `services/aiTranslationService.js` - OpenAI GPT-4o-mini for translations
- `services/speechService.js` - OpenAI TTS for audio
- `models/Vocabulary.js` - SRS vocabulary storage
- `models/EnhancedTranslation.js` - Translation cache
