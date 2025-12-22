/**
 * Translation Service
 * Handles translation using LibreTranslate (free, open-source)
 */

const Translation = require('../models/Translation');
const ErrorResponse = require('../utils/errorResponse');
const axios = require('axios');

// LibreTranslate base URL
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';

/**
 * Detect language of text using LibreTranslate
 * @param {String} text - Text to detect language for
 * @returns {Promise<String>} ISO 639-1 language code
 */
const detectLanguage = async (text) => {
  try {
    const response = await axios.post(`${LIBRETRANSLATE_URL}/detect`, {
      q: text
    }, {
      timeout: 5000
    });

    if (response.data && response.data.length > 0) {
      return response.data[0].language;
    }
  } catch (error) {
    console.error('Language detection error:', error.message);
  }

  // Fallback to simple pattern-based detection
  const patterns = {
    'zh': /[\u4e00-\u9fff]/,
    'ko': /[\uac00-\ud7a3]/,
    'ja': /[\u3040-\u309f\u30a0-\u30ff]/,
    'ar': /[\u0600-\u06ff]/,
    'ru': /[\u0400-\u04ff]/,
    'es': /\b(es|el|la|los|las|un|una|de|en|con|por|para|que|del|al)\b/i,
    'fr': /\b(le|la|les|un|une|de|des|du|et|ou|est|sont|pour|avec)\b/i,
    'de': /\b(der|die|das|und|oder|ist|sind|für|mit|von|zu)\b/i,
    'en': /\b(the|a|an|and|or|is|are|for|with|from|to|in|on|at)\b/i
  };

  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      return lang;
    }
  }

  // Default to English if no pattern matches
  return 'en';
};

/**
 * Translate text using LibreTranslate
 * @param {String} text - Text to translate
 * @param {String} targetLanguage - Target language code (ISO 639-1)
 * @param {String} sourceLanguage - Source language code (optional, auto-detect if not provided)
 * @returns {Promise<Object>} Translation result
 */
const translateText = async (text, targetLanguage, sourceLanguage = null) => {
  if (!text || !text.trim()) {
    throw new Error('Text to translate is required');
  }

  if (!targetLanguage) {
    throw new Error('Target language is required');
  }

  // If source and target are the same, return original text
  if (sourceLanguage && sourceLanguage === targetLanguage) {
    return {
      translatedText: text,
      sourceLanguage,
      targetLanguage,
      provider: 'libretranslate'
    };
  }

  try {
    // Auto-detect source language if not provided
    if (!sourceLanguage || sourceLanguage === 'auto') {
      sourceLanguage = await detectLanguage(text);
    }

    // Use LibreTranslate API (free, no API key required)
    const response = await axios.post(`${LIBRETRANSLATE_URL}/translate`, {
      q: text,
      source: sourceLanguage,
      target: targetLanguage,
      format: 'text'
    }, {
      timeout: 10000 // 10 second timeout
    });

    if (response.data && response.data.translatedText) {
      return {
        translatedText: response.data.translatedText,
        sourceLanguage: sourceLanguage,
        targetLanguage,
        provider: 'libretranslate'
      };
    } else {
      throw new Error('Invalid response from LibreTranslate');
    }
  } catch (error) {
    console.error('Translation error:', error.message);
    
    // If translation fails, return original text instead of throwing
    // This allows the app to continue working even if translation service is down
    if (error.response) {
      throw new Error(`LibreTranslate API error: ${error.response.data?.error || error.response.statusText}`);
    } else if (error.request) {
      throw new Error('LibreTranslate service unavailable. Please try again later.');
    } else {
      throw new Error(`Translation failed: ${error.message}`);
    }
  }
};

/**
 * Get or create translation for a moment or comment
 * @param {String} sourceId - ID of moment or comment
 * @param {String} sourceType - 'moment' or 'comment'
 * @param {String} sourceText - Original text to translate
 * @param {String} targetLanguage - Target language code
 * @param {String} sourceLanguage - Source language code (optional)
 * @returns {Promise<Object>} Translation data
 */
exports.getOrCreateTranslation = async (sourceId, sourceType, sourceText, targetLanguage, sourceLanguage = null) => {
  try {
    // Check cache first
    const cached = await Translation.getTranslation(sourceId, sourceType, targetLanguage);
    
    if (cached && cached.cached) {
      return {
        language: cached.targetLanguage,
        translatedText: cached.translatedText,
        translatedAt: cached.cachedAt,
        cached: true,
        provider: cached.provider
      };
    }

    // Auto-detect source language if not provided
    if (!sourceLanguage) {
      sourceLanguage = await detectLanguage(sourceText);
    }

    // Translate text
    const translationResult = await translateText(sourceText, targetLanguage, sourceLanguage);

    // Save to cache
    await Translation.saveTranslation({
      sourceId,
      sourceType,
      sourceLanguage: translationResult.sourceLanguage,
      targetLanguage,
      translatedText: translationResult.translatedText,
      provider: translationResult.provider
    });

    return {
      language: targetLanguage,
      translatedText: translationResult.translatedText,
      translatedAt: new Date(),
      cached: false,
      provider: translationResult.provider
    };
  } catch (error) {
    console.error('Translation service error:', error);
    throw error;
  }
};

/**
 * Get all translations for a source
 * @param {String} sourceId - ID of moment or comment
 * @param {String} sourceType - 'moment' or 'comment'
 * @returns {Promise<Array>} Array of translations
 */
exports.getTranslations = async (sourceId, sourceType) => {
  try {
    const translations = await Translation.getTranslations(sourceId, sourceType);
    
    return translations.map(t => ({
      language: t.targetLanguage,
      translatedText: t.translatedText,
      translatedAt: t.cachedAt,
      provider: t.provider
    }));
  } catch (error) {
    console.error('Get translations error:', error);
    throw error;
  }
};

/**
 * Supported languages (LibreTranslate supported languages)
 */
exports.SUPPORTED_LANGUAGES = [
  'en', 'zh', 'ko', 'ru', 'es', 'ar', 'fr', 'de', 'ja', 'pt', 'it', 'hi', 'th', 'vi', 'id', 'tr', 'pl', 'nl', 'sv', 'da', 'fi', 'no', 'cs', 'hu', 'ro', 'el', 'he', 'uk', 'bg', 'hr', 'sk', 'sl', 'et', 'lv', 'lt', 'mt', 'ga', 'cy', 'uz', 'az', 'kk', 'ky', 'tg', 'tk'
];

/**
 * Get available languages from LibreTranslate
 * @returns {Promise<Array>} Array of available languages
 */
exports.getAvailableLanguages = async () => {
  try {
    const response = await axios.get(`${LIBRETRANSLATE_URL}/languages`, {
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching languages from LibreTranslate:', error.message);
    // Return default list if API fails
    return exports.SUPPORTED_LANGUAGES.map(code => ({ code, name: code }));
  }
};

/**
 * Validate language code
 * @param {String} langCode - Language code to validate
 * @returns {Boolean} True if valid
 */
exports.isValidLanguageCode = (langCode) => {
  return exports.SUPPORTED_LANGUAGES.includes(langCode);
};

