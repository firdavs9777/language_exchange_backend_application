const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const speechService = require('../services/speechService');

/**
 * @desc    Generate text-to-speech audio
 * @route   POST /api/v1/speech/tts
 * @access  Private
 */
exports.generateTTS = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const {
    text,
    language,
    voice,
    speed,
    format,
    sourceType
  } = req.body;

  if (!text) {
    return next(new ErrorResponse('Text is required', 400));
  }

  if (!language) {
    return next(new ErrorResponse('Language is required', 400));
  }

  const result = await speechService.generateTTS({
    text,
    language,
    voice,
    speed,
    format,
    sourceType,
    userId
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Transcribe speech to text
 * @route   POST /api/v1/speech/stt
 * @access  Private
 */
exports.transcribeAudio = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { language } = req.body;

  if (!req.file) {
    return next(new ErrorResponse('Audio file is required', 400));
  }

  const result = await speechService.transcribeAudio({
    audioFile: req.file,
    language,
    userId
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Evaluate pronunciation
 * @route   POST /api/v1/speech/pronunciation/evaluate
 * @access  Private
 */
exports.evaluatePronunciation = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const {
    targetText,
    language,
    source,
    vocabularyId,
    lessonId
  } = req.body;

  if (!req.file) {
    return next(new ErrorResponse('Audio file is required', 400));
  }

  if (!targetText) {
    return next(new ErrorResponse('Target text is required', 400));
  }

  if (!language) {
    return next(new ErrorResponse('Language is required', 400));
  }

  const result = await speechService.evaluatePronunciation({
    audioFile: req.file,
    targetText,
    language,
    userId,
    context: {
      source,
      vocabularyId,
      lessonId
    }
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get pronunciation history
 * @route   GET /api/v1/speech/pronunciation/history
 * @access  Private
 */
exports.getPronunciationHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { language, limit, offset } = req.query;

  const result = await speechService.getPronunciationHistory(userId, {
    language,
    limit: limit ? parseInt(limit) : 20,
    offset: offset ? parseInt(offset) : 0
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get pronunciation stats
 * @route   GET /api/v1/speech/pronunciation/stats
 * @access  Private
 */
exports.getPronunciationStats = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { language } = req.query;

  const stats = await speechService.getPronunciationStats(userId, language);

  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Get best pronunciation attempt for a text
 * @route   GET /api/v1/speech/pronunciation/best
 * @access  Private
 */
exports.getBestAttempt = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { targetText } = req.query;

  if (!targetText) {
    return next(new ErrorResponse('Target text is required', 400));
  }

  const attempt = await speechService.getBestAttempt(userId, targetText);

  res.status(200).json({
    success: true,
    data: attempt
  });
});

/**
 * @desc    Get available TTS voices
 * @route   GET /api/v1/speech/voices
 * @access  Private
 */
exports.getAvailableVoices = asyncHandler(async (req, res, next) => {
  const { language } = req.query;

  const voices = speechService.getAvailableVoices(language);

  res.status(200).json({
    success: true,
    data: voices
  });
});

/**
 * @desc    Get audio cache stats (admin only)
 * @route   GET /api/v1/speech/cache/stats
 * @access  Private/Admin
 */
exports.getCacheStats = asyncHandler(async (req, res, next) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access cache stats', 403));
  }

  const stats = await speechService.getCacheStats();

  res.status(200).json({
    success: true,
    data: stats
  });
});
