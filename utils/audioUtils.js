/**
 * Audio Utilities
 * Validation and processing for audio files
 */

const path = require('path');
const crypto = require('crypto');

// Supported audio formats
const SUPPORTED_FORMATS = {
  input: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg', 'flac'],
  output: ['mp3', 'opus', 'aac', 'flac']
};

// Max file sizes in bytes
const MAX_FILE_SIZES = {
  tts: 4096, // Max characters for TTS
  stt: 25 * 1024 * 1024, // 25MB for Whisper
  pronunciation: 10 * 1024 * 1024 // 10MB for pronunciation evaluation
};

/**
 * Validate audio file for STT/pronunciation
 * @param {Object} file - Multer file object
 * @param {String} purpose - 'stt' or 'pronunciation'
 * @returns {Object} Validation result
 */
const validateAudioFile = (file, purpose = 'stt') => {
  const errors = [];

  if (!file) {
    return { valid: false, errors: ['No audio file provided'] };
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  if (!SUPPORTED_FORMATS.input.includes(ext)) {
    errors.push(`Unsupported audio format: ${ext}. Supported: ${SUPPORTED_FORMATS.input.join(', ')}`);
  }

  // Check MIME type
  const validMimeTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
    'audio/wav', 'audio/webm', 'audio/ogg', 'audio/flac',
    'audio/x-m4a', 'audio/x-wav'
  ];
  if (!validMimeTypes.includes(file.mimetype)) {
    errors.push(`Invalid MIME type: ${file.mimetype}`);
  }

  // Check file size
  const maxSize = MAX_FILE_SIZES[purpose] || MAX_FILE_SIZES.stt;
  if (file.size > maxSize) {
    errors.push(`File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`);
  }

  return {
    valid: errors.length === 0,
    errors,
    metadata: {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      extension: ext
    }
  };
};

/**
 * Validate text for TTS
 * @param {String} text - Text to convert to speech
 * @returns {Object} Validation result
 */
const validateTTSText = (text) => {
  const errors = [];

  if (!text || typeof text !== 'string') {
    return { valid: false, errors: ['No text provided'] };
  }

  const trimmed = text.trim();

  if (trimmed.length === 0) {
    errors.push('Text cannot be empty');
  }

  if (trimmed.length > MAX_FILE_SIZES.tts) {
    errors.push(`Text too long. Maximum ${MAX_FILE_SIZES.tts} characters`);
  }

  // Check for potentially problematic characters
  const hasOnlyWhitespace = /^\s*$/.test(trimmed);
  if (hasOnlyWhitespace) {
    errors.push('Text contains only whitespace');
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: trimmed,
    characterCount: trimmed.length
  };
};

/**
 * Generate unique filename for audio storage
 * @param {String} prefix - File prefix
 * @param {String} format - Audio format
 * @returns {String} Unique filename
 */
const generateAudioFilename = (prefix, format = 'mp3') => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${timestamp}_${random}.${format}`;
};

/**
 * Generate content hash for caching
 * @param {String} text - Text content
 * @param {Object} options - Additional options to include in hash
 * @returns {String} SHA256 hash
 */
const generateContentHash = (text, options = {}) => {
  const content = JSON.stringify({ text, ...options });
  return crypto.createHash('sha256').update(content).digest('hex');
};

/**
 * Estimate audio duration based on text
 * @param {String} text - Text content
 * @param {Number} speed - Speech speed multiplier
 * @returns {Number} Estimated duration in seconds
 */
const estimateAudioDuration = (text, speed = 1.0) => {
  // Average speaking rate: ~150 words per minute
  // Average word length: ~5 characters
  const words = text.length / 5;
  const minutes = words / 150;
  const seconds = minutes * 60;
  return Math.round(seconds / speed);
};

/**
 * Calculate pronunciation score components
 * @param {String} original - Original text
 * @param {String} transcription - Transcribed text
 * @returns {Object} Score breakdown
 */
const calculatePronunciationMetrics = (original, transcription) => {
  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const originalNorm = normalizeText(original);
  const transcriptionNorm = normalizeText(transcription);

  const originalWords = originalNorm.split(' ');
  const transcriptionWords = transcriptionNorm.split(' ');

  // Calculate accuracy (word-level matching)
  let matchedWords = 0;
  const wordScores = [];

  for (let i = 0; i < originalWords.length; i++) {
    const originalWord = originalWords[i];
    const transcribedWord = transcriptionWords[i] || '';

    const similarity = calculateStringSimilarity(originalWord, transcribedWord);
    const score = Math.round(similarity * 100);

    wordScores.push({
      word: originalWord,
      score,
      feedback: getWordFeedback(score)
    });

    if (similarity >= 0.8) {
      matchedWords++;
    }
  }

  const accuracy = originalWords.length > 0
    ? Math.round((matchedWords / originalWords.length) * 100)
    : 0;

  // Calculate completeness
  const completeness = originalWords.length > 0
    ? Math.round((Math.min(transcriptionWords.length, originalWords.length) / originalWords.length) * 100)
    : 0;

  // Fluency is harder to measure without audio analysis
  // Using a heuristic based on word count ratio
  const fluency = transcriptionWords.length > 0
    ? Math.min(100, Math.round((transcriptionWords.length / originalWords.length) * 100))
    : 0;

  // Overall score
  const overall = Math.round((accuracy * 0.5 + fluency * 0.3 + completeness * 0.2));

  return {
    overall,
    accuracy,
    fluency,
    completeness,
    wordScores
  };
};

/**
 * Calculate string similarity using Levenshtein distance
 * @param {String} str1 - First string
 * @param {String} str2 - Second string
 * @returns {Number} Similarity score (0-1)
 */
const calculateStringSimilarity = (str1, str2) => {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 1;

  // Levenshtein distance
  const matrix = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  return 1 - distance / maxLen;
};

/**
 * Get feedback for word pronunciation score
 * @param {Number} score - Word score (0-100)
 * @returns {String} Feedback message
 */
const getWordFeedback = (score) => {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs practice';
  return 'Try again';
};

/**
 * Get language-specific TTS voice
 * @param {String} language - Language code
 * @param {String} preferredVoice - User's preferred voice
 * @returns {String} Voice identifier
 */
const getTTSVoice = (language, preferredVoice = null) => {
  const languageVoices = {
    en: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    es: ['nova', 'alloy', 'shimmer'],
    fr: ['nova', 'alloy', 'shimmer'],
    de: ['nova', 'alloy', 'onyx'],
    it: ['nova', 'alloy', 'shimmer'],
    pt: ['nova', 'alloy', 'shimmer'],
    ja: ['nova', 'alloy'],
    ko: ['nova', 'alloy'],
    zh: ['nova', 'alloy'],
    default: ['nova', 'alloy', 'shimmer']
  };

  const voices = languageVoices[language] || languageVoices.default;

  if (preferredVoice && voices.includes(preferredVoice)) {
    return preferredVoice;
  }

  return voices[0];
};

module.exports = {
  SUPPORTED_FORMATS,
  MAX_FILE_SIZES,
  validateAudioFile,
  validateTTSText,
  generateAudioFilename,
  generateContentHash,
  estimateAudioDuration,
  calculatePronunciationMetrics,
  calculateStringSimilarity,
  getWordFeedback,
  getTTSVoice
};
