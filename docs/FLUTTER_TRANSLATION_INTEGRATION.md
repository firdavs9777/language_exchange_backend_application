# Bananatalk Translation - Complete Flutter Integration Guide

## ✅ Backend Status

Your backend is **fully implemented** and ready! All endpoints are working with LibreTranslate.

---

## 📋 Backend Endpoints (Already Implemented)

### 1. Translate Moment
- **Endpoint:** `POST /api/v1/moments/:momentId/translate`
- **Auth:** Required (Bearer token)
- **Request Body:**
  ```json
  {
    "targetLanguage": "en"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "language": "en",
      "translatedText": "This is the translated moment text",
      "translatedAt": "2025-01-18T10:30:00.000Z"
    },
    "cached": false
  }
  ```

### 2. Translate Comment
- **Endpoint:** `POST /api/v1/comments/:commentId/translate`
- **Auth:** Required (Bearer token)
- **Request Body:**
  ```json
  {
    "targetLanguage": "en"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "language": "en",
      "translatedText": "This is the translated comment text",
      "translatedAt": "2025-01-18T10:30:00.000Z"
    },
    "cached": false
  }
  ```

### 3. Get Moment Translations (Optional)
- **Endpoint:** `GET /api/v1/moments/:momentId/translations`
- **Auth:** Required (Bearer token)

### 4. Get Comment Translations (Optional)
- **Endpoint:** `GET /api/v1/comments/:commentId/translations`
- **Auth:** Required (Bearer token)

---

## 🔧 Flutter Integration

### Step 1: Update Translation Service

**File:** `lib/services/translation_service.dart`

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class TranslationService {
  // YOUR BACKEND URL (update this!)
  static const String baseUrl = 'https://api.banatalk.com'; // or your backend URL
  
  /// Translate a moment
  Future<String> translateMoment({
    required String momentId,
    required String targetLanguage,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('authToken');
      
      if (token == null) {
        throw Exception('Authentication required');
      }
      
      final response = await http.post(
        Uri.parse('$baseUrl/api/v1/moments/$momentId/translate'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'targetLanguage': targetLanguage,
        }),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        // Backend returns: { success: true, data: { translatedText, ... }, cached: false }
        if (data['success'] == true && data['data'] != null) {
          return data['data']['translatedText'] ?? '';
        }
        
        throw Exception('Invalid response format');
      } else {
        final errorData = jsonDecode(response.body);
        final errorMessage = errorData['error'] ?? errorData['message'] ?? 'Translation failed';
        throw Exception(errorMessage);
      }
    } catch (e) {
      print('Translation exception: $e');
      rethrow;
    }
  }
  
  /// Translate a comment
  Future<String> translateComment({
    required String commentId,
    required String targetLanguage,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('authToken');
      
      if (token == null) {
        throw Exception('Authentication required');
      }
      
      final response = await http.post(
        Uri.parse('$baseUrl/api/v1/comments/$commentId/translate'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'targetLanguage': targetLanguage,
        }),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        // Backend returns: { success: true, data: { translatedText, ... }, cached: false }
        if (data['success'] == true && data['data'] != null) {
          return data['data']['translatedText'] ?? '';
        }
        
        throw Exception('Invalid response format');
      } else {
        final errorData = jsonDecode(response.body);
        final errorMessage = errorData['error'] ?? errorData['message'] ?? 'Translation failed';
        throw Exception(errorMessage);
      }
    } catch (e) {
      print('Comment translation exception: $e');
      rethrow;
    }
  }

  /// Get user's preferred language
  Future<String> getUserLanguage() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('userLanguage') ?? 'en';
  }
  
  /// Convert language names to codes
  String getLanguageCode(String language) {
    final langLower = language.toLowerCase();
    
    final languageMap = {
      'english': 'en',
      'korean': 'ko',
      'japanese': 'ja',
      'chinese': 'zh',
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'italian': 'it',
      'portuguese': 'pt',
      'russian': 'ru',
      'arabic': 'ar',
      'hindi': 'hi',
      'uzbek': 'uz',
      'vietnamese': 'vi',
      'thai': 'th',
      'indonesian': 'id',
      'turkish': 'tr',
      'polish': 'pl',
      'dutch': 'nl',
    };
    
    if (languageMap.containsKey(langLower)) {
      return languageMap[langLower]!;
    }
    
    for (var entry in languageMap.entries) {
      if (langLower.contains(entry.key)) {
        return entry.value;
      }
    }
    
    // If already a 2-letter code, return as is
    if (language.length == 2) {
      return language.toLowerCase();
    }
    
    return 'en';
  }
  
  String getLanguageFlag(String langCode) {
    final flags = {
      'en': '🇺🇸',
      'ko': '🇰🇷',
      'ja': '🇯🇵',
      'zh': '🇨🇳',
      'es': '🇪🇸',
      'fr': '🇫🇷',
      'de': '🇩🇪',
      'it': '🇮🇹',
      'pt': '🇵🇹',
      'ru': '🇷🇺',
      'ar': '🇸🇦',
      'hi': '🇮🇳',
      'uz': '🇺🇿',
      'vi': '🇻🇳',
      'th': '🇹🇭',
      'id': '🇮🇩',
      'tr': '🇹🇷',
      'pl': '🇵🇱',
      'nl': '🇳🇱',
    };
    return flags[langCode] ?? '🌍';
  }
}
```

---

### Step 2: Update Translated Moment Widget

**File:** `lib/widgets/translated_moment_widget.dart`

```dart
import 'package:flutter/material.dart';
import '../services/translation_service.dart';

class TranslatedMomentWidget extends StatefulWidget {
  final String momentId;
  final String originalText;
  final String originalLanguage;
  final Map<String, String>? existingTranslations;
  final VoidCallback? onTranslationAdded;

  const TranslatedMomentWidget({
    Key? key,
    required this.momentId,
    required this.originalText,
    required this.originalLanguage,
    this.existingTranslations,
    this.onTranslationAdded,
  }) : super(key: key);

  @override
  State<TranslatedMomentWidget> createState() => _TranslatedMomentWidgetState();
}

class _TranslatedMomentWidgetState extends State<TranslatedMomentWidget> {
  final TranslationService _translationService = TranslationService();
  
  String? _translatedText;
  String? _targetLanguage;
  bool _showTranslation = false;
  bool _isTranslating = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _checkExistingTranslation();
  }

  Future<void> _checkExistingTranslation() async {
    final userLang = await _translationService.getUserLanguage();
    
    if (widget.existingTranslations != null) {
      final existing = widget.existingTranslations![userLang];
      if (existing != null && existing.isNotEmpty) {
        setState(() {
          _translatedText = existing;
          _targetLanguage = userLang;
        });
      }
    }
  }

  Future<void> _translateText() async {
    if (_isTranslating) return;
    
    setState(() {
      _isTranslating = true;
      _errorMessage = null;
    });

    try {
      final targetLang = await _translationService.getUserLanguage();
      final sourceLang = _translationService.getLanguageCode(
        widget.originalLanguage,
      );
      
      // Don't translate if same language
      if (sourceLang == targetLang) {
        setState(() {
          _isTranslating = false;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Already in your language'),
              duration: Duration(seconds: 2),
            ),
          );
        }
        return;
      }

      // Call YOUR backend (which calls LibreTranslate)
      final translated = await _translationService.translateMoment(
        momentId: widget.momentId,
        targetLanguage: targetLang,
      );

      setState(() {
        _translatedText = translated;
        _targetLanguage = targetLang;
        _showTranslation = true;
        _isTranslating = false;
      });

      widget.onTranslationAdded?.call();
      
    } catch (e) {
      setState(() {
        _isTranslating = false;
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Translation failed: ${_errorMessage ?? "Unknown error"}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Original text
        Text(
          widget.originalText,
          style: const TextStyle(
            fontSize: 15,
            height: 1.4,
            color: Colors.black87,
          ),
        ),
        
        // Translation button
        if (!_showTranslation && !_isTranslating)
          GestureDetector(
            onTap: _translateText,
            child: Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                children: [
                  Icon(
                    Icons.translate,
                    size: 16,
                    color: Colors.blue[600],
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'See translation',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.blue[600],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        
        // Loading
        if (_isTranslating)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              children: [
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      Colors.blue[600]!,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Translating...',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
        
        // Translation
        if (_showTranslation && _translatedText != null)
          Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.blue[50],
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: Colors.blue[100]!,
                width: 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      _translationService.getLanguageFlag(
                        _targetLanguage ?? 'en',
                      ),
                      style: const TextStyle(fontSize: 16),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Translation',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.blue[700],
                      ),
                    ),
                    const Spacer(),
                    GestureDetector(
                      onTap: () {
                        setState(() {
                          _showTranslation = false;
                        });
                      },
                      child: Icon(
                        Icons.close,
                        size: 18,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  _translatedText!,
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.4,
                    color: Colors.grey[800],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
```

---

### Step 3: Update Comment Translation Widget (Similar Pattern)

**File:** `lib/widgets/translated_comment_widget.dart`

```dart
import 'package:flutter/material.dart';
import '../services/translation_service.dart';

class TranslatedCommentWidget extends StatefulWidget {
  final String commentId;
  final String originalText;
  final String originalLanguage;

  const TranslatedCommentWidget({
    Key? key,
    required this.commentId,
    required this.originalText,
    required this.originalLanguage,
  }) : super(key: key);

  @override
  State<TranslatedCommentWidget> createState() => _TranslatedCommentWidgetState();
}

class _TranslatedCommentWidgetState extends State<TranslatedCommentWidget> {
  final TranslationService _translationService = TranslationService();
  
  String? _translatedText;
  bool _showTranslation = false;
  bool _isTranslating = false;

  Future<void> _translateText() async {
    if (_isTranslating) return;
    
    setState(() {
      _isTranslating = true;
    });

    try {
      final targetLang = await _translationService.getUserLanguage();
      final sourceLang = _translationService.getLanguageCode(
        widget.originalLanguage,
      );
      
      if (sourceLang == targetLang) {
        setState(() {
          _isTranslating = false;
        });
        return;
      }

      final translated = await _translationService.translateComment(
        commentId: widget.commentId,
        targetLanguage: targetLang,
      );

      setState(() {
        _translatedText = translated;
        _showTranslation = true;
        _isTranslating = false;
      });
      
    } catch (e) {
      setState(() {
        _isTranslating = false;
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Translation failed: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.originalText),
        
        if (!_showTranslation && !_isTranslating)
          TextButton.icon(
            onPressed: _translateText,
            icon: const Icon(Icons.translate, size: 16),
            label: const Text('Translate'),
          ),
        
        if (_isTranslating)
          const Padding(
            padding: EdgeInsets.all(8.0),
            child: CircularProgressIndicator(),
          ),
        
        if (_showTranslation && _translatedText != null)
          Container(
            padding: const EdgeInsets.all(8),
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              color: Colors.blue[50],
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(_translatedText!),
          ),
      ],
    );
  }
}
```

---

## 🧪 Testing

### 1. Backend Check
```bash
# Make sure backend is running
pm2 status

# Check logs
pm2 logs language-app
```

### 2. Test Translation
1. Create a moment in Korean: "안녕하세요"
2. View it with an English user
3. Click "See translation"
4. Should show: "Hello" in blue box

### 3. Test Comment Translation
1. Create a comment in another language
2. Click "Translate" button
3. Should show translated text

---

## 📝 Important Notes

### API Endpoints
- ✅ Use `/api/v1/` prefix (not `/api/`)
- ✅ Endpoints require authentication (Bearer token)
- ✅ Response format: `{ success: true, data: { translatedText, ... }, cached: false }`

### Response Parsing
```dart
// Correct way to parse backend response:
final data = jsonDecode(response.body);
if (data['success'] == true && data['data'] != null) {
  final translatedText = data['data']['translatedText'];
  // Use translatedText
}
```

### Error Handling
- Backend returns: `{ success: false, error: "Error message" }`
- Handle 401 (unauthorized), 404 (not found), 500 (server error)
- Show user-friendly error messages

---

## 🎯 Summary

### Architecture
```
Flutter App → Your Backend → LibreTranslate (FREE)
     ↓              ↓              ↓
User clicks → API call → Translates → Saves to DB
```

### Benefits
- ✅ **FREE** - $0 cost (using public LibreTranslate instance)
- ✅ **Cached** - Translations saved in your database
- ✅ **Fast** - Second time is instant (from cache)
- ✅ **Secure** - Backend validates user auth
- ✅ **Scalable** - Can switch to paid/self-hosted later

### Cost
**$0** 💰 - Using free public LibreTranslate instance

---

## ✅ Checklist

- [x] Backend endpoints implemented
- [x] LibreTranslate configured
- [ ] Update Flutter `translation_service.dart` with correct endpoints
- [ ] Update Flutter widgets to use new service
- [ ] Test moment translation
- [ ] Test comment translation
- [ ] Handle errors gracefully
- [ ] Update base URL in Flutter service

---

## 🚀 Ready to Deploy!

Your backend is ready. Just update the Flutter code with the correct endpoints and response parsing, and you're good to go!

