# Translation API Documentation

## Overview

The translation API provides endpoints to translate moments and comments using **LibreTranslate** (free, open-source translation service). Translations are cached in the database to reduce API calls and improve performance.

## Setup

### 1. LibreTranslate Configuration

LibreTranslate is a free, open-source translation service that doesn't require an API key. The service uses the public instance by default, but you can configure a custom URL if you host your own instance.

**Default Configuration (No setup required):**
- Uses public LibreTranslate instance: `https://libretranslate.com`
- No API key needed
- Free to use

**Optional: Custom LibreTranslate Instance**

If you want to host your own LibreTranslate instance for better performance or privacy:

1. Set up your own LibreTranslate server (see [LibreTranslate GitHub](https://github.com/LibreTranslate/LibreTranslate))
2. Add to your `.env` file:

```env
LIBRETRANSLATE_URL=https://your-libretranslate-instance.com
```

### 2. Install Dependencies

Axios is required for HTTP requests (already installed):
```bash
npm install axios
```

## Endpoints

### 1. Translate Moment

**POST** `/api/v1/moments/:momentId/translate`

Translate a moment's text to a target language.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "targetLanguage": "en"
}
```

**Response:**
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

**Error Responses:**
- `400` - Missing or invalid target language
- `403` - Not authorized to view private moment
- `404` - Moment not found
- `500` - Translation service error

### 2. Get Moment Translations

**GET** `/api/v1/moments/:momentId/translations`

Get all cached translations for a moment.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "language": "en",
      "translatedText": "English translation",
      "translatedAt": "2025-01-18T10:30:00.000Z",
      "provider": "google"
    },
    {
      "language": "zh",
      "translatedText": "中文翻译",
      "translatedAt": "2025-01-18T10:30:00.000Z",
      "provider": "google"
    }
  ]
}
```

### 3. Translate Comment

**POST** `/api/v1/comments/:commentId/translate`

Translate a comment's text to a target language.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "targetLanguage": "en"
}
```

**Response:**
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

### 4. Get Comment Translations

**GET** `/api/v1/comments/:commentId/translations`

Get all cached translations for a comment.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "language": "en",
      "translatedText": "English translation",
      "translatedAt": "2025-01-18T10:30:00.000Z",
      "provider": "google"
    }
  ]
}
```

## Supported Languages

The API supports the following ISO 639-1 language codes:

- `en` - English
- `zh` - Chinese
- `ko` - Korean
- `ru` - Russian
- `es` - Spanish
- `ar` - Arabic
- `fr` - French
- `de` - German
- `ja` - Japanese
- `pt` - Portuguese
- `it` - Italian
- `hi` - Hindi
- `th` - Thai
- `vi` - Vietnamese
- `id` - Indonesian
- `tr` - Turkish
- `pl` - Polish
- `nl` - Dutch
- `sv` - Swedish
- `da` - Danish
- `fi` - Finnish
- `no` - Norwegian
- And more...

## Features

### Caching

- Translations are automatically cached in the database
- Cached translations expire after 30 days
- Subsequent requests for the same translation return cached result
- `cached: true` in response indicates a cached translation

### Language Detection

- Source language is auto-detected if not provided
- Uses moment's `language` field if available
- Uses comment author's `native_language` if available
- Falls back to pattern-based detection

### Error Handling

- Validates language codes before processing
- Returns appropriate error messages
- Handles Google Translate API errors gracefully

## Database Schema

### Translation Model

```javascript
{
  sourceId: ObjectId,        // ID of moment or comment
  sourceType: String,       // 'moment' or 'comment'
  sourceLanguage: String,   // Original language code
  targetLanguage: String,   // Target language code
  translatedText: String,   // Translated content
  provider: String,         // 'google', 'deepl', etc.
  cached: Boolean,          // Whether translation is cached
  cachedAt: Date,          // Cache timestamp
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ sourceId: 1, sourceType: 1, targetLanguage: 1 }` - Unique compound index
- `{ cachedAt: 1 }` - TTL index (30 days expiration)

## Testing

### Using curl

```bash
# Translate a moment
curl -X POST https://api.banatalk.com/api/v1/moments/{MOMENT_ID}/translate \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"targetLanguage": "en"}'

# Get moment translations
curl -X GET https://api.banatalk.com/api/v1/moments/{MOMENT_ID}/translations \
  -H "Authorization: Bearer {TOKEN}"

# Translate a comment
curl -X POST https://api.banatalk.com/api/v1/comments/{COMMENT_ID}/translate \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"targetLanguage": "zh"}'
```

## Cost Considerations

- **LibreTranslate is completely free** - no API costs
- Uses public instance: `https://libretranslate.com`
- Caching reduces API calls and improves performance
- No rate limits (but be respectful of the public service)
- Option to host your own instance for unlimited usage

## Rate Limiting

Translation endpoints are subject to the general rate limiter:
- 500 requests per 15 minutes per IP (unauthenticated)
- Higher limits for authenticated users

## Troubleshooting

### "LibreTranslate service unavailable"

- Check your internet connection
- The public LibreTranslate instance may be temporarily down
- Try again later or set up your own instance
- Check if `LIBRETRANSLATE_URL` is correctly configured

### "Translation failed: Request failed"

- Check your internet connection
- Verify LibreTranslate service is accessible
- Check if the service URL is correct in `.env`
- Public instance may have rate limits - consider hosting your own

### "Unsupported language code"

Use a valid ISO 639-1 language code from the supported languages list. LibreTranslate supports many languages, but not all combinations may be available.

## Files Created

- `models/Translation.js` - Translation model with caching
- `services/translationService.js` - Translation service logic
- `controllers/moments.js` - Added `translateMoment` and `getMomentTranslations`
- `controllers/comments.js` - Added `translateComment` and `getCommentTranslations`
- `routes/moments.js` - Added translation routes
- `routes/comment.js` - Added translation routes
- `validators/translationValidator.js` - Validation for translation requests

## Next Steps

1. **No setup required!** LibreTranslate works out of the box
2. (Optional) Configure custom LibreTranslate URL in `.env` if needed
3. Restart backend server
4. Test translation endpoints
5. (Optional) Consider hosting your own LibreTranslate instance for production use

