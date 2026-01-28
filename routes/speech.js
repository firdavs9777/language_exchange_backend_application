const express = require('express');
const router = express.Router();
const multer = require('multer');

const {
  generateTTS,
  transcribeAudio,
  evaluatePronunciation,
  getPronunciationHistory,
  getPronunciationStats,
  getBestAttempt,
  getAvailableVoices,
  getCacheStats
} = require('../controllers/speech');

const { protect } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');

// Configure multer for audio file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/m4a',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/flac',
      'audio/x-m4a',
      'audio/x-wav'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only audio files are allowed.`), false);
    }
  }
});

// All routes require authentication
router.use(protect);

// ===================== TTS ROUTES =====================
/**
 * @route   POST /api/v1/speech/tts
 * @desc    Generate text-to-speech audio
 * @access  Private
 */
router.post('/tts', aiRateLimiter('tts'), generateTTS);

// ===================== STT ROUTES =====================
/**
 * @route   POST /api/v1/speech/stt
 * @desc    Transcribe speech to text
 * @access  Private
 */
router.post('/stt', aiRateLimiter('stt'), upload.single('audio'), transcribeAudio);

// ===================== PRONUNCIATION ROUTES =====================
/**
 * @route   POST /api/v1/speech/pronunciation/evaluate
 * @desc    Evaluate pronunciation
 * @access  Private
 */
router.post(
  '/pronunciation/evaluate',
  aiRateLimiter('pronunciation'),
  upload.single('audio'),
  evaluatePronunciation
);

/**
 * @route   GET /api/v1/speech/pronunciation/history
 * @desc    Get pronunciation practice history
 * @access  Private
 */
router.get('/pronunciation/history', getPronunciationHistory);

/**
 * @route   GET /api/v1/speech/pronunciation/stats
 * @desc    Get pronunciation statistics
 * @access  Private
 */
router.get('/pronunciation/stats', getPronunciationStats);

/**
 * @route   GET /api/v1/speech/pronunciation/best
 * @desc    Get best attempt for a specific text
 * @access  Private
 */
router.get('/pronunciation/best', getBestAttempt);

// ===================== UTILITY ROUTES =====================
/**
 * @route   GET /api/v1/speech/voices
 * @desc    Get available TTS voices
 * @access  Private
 */
router.get('/voices', getAvailableVoices);

/**
 * @route   GET /api/v1/speech/cache/stats
 * @desc    Get audio cache statistics (admin only)
 * @access  Private/Admin
 */
router.get('/cache/stats', getCacheStats);

module.exports = router;
