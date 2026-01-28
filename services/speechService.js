/**
 * Speech Service
 * Handles TTS generation, STT transcription, and pronunciation evaluation
 */

const AudioCache = require('../models/AudioCache');
const PronunciationAttempt = require('../models/PronunciationAttempt');
const {
  textToSpeech,
  speechToText,
  chatCompletion,
  buildPronunciationFeedbackPrompt,
  parseJSONResponse,
  trackUsage
} = require('./aiProviderService');
const {
  validateTTSText,
  validateAudioFile,
  calculatePronunciationMetrics,
  generateAudioFilename,
  getTTSVoice,
  estimateAudioDuration
} = require('../utils/audioUtils');
const { uploadToSpaces, deleteFromSpaces } = require('./storageService');
const { AI_FEATURES, TTS_VOICES, CACHE_TTL } = require('../config/aiConfig');
const { XP_REWARDS } = require('../config/xpRewards');

/**
 * Generate TTS audio for text
 * @param {Object} options - TTS options
 * @returns {Promise<Object>} Audio URL and metadata
 */
const generateTTS = async (options) => {
  const {
    text,
    language,
    voice,
    speed = 1.0,
    format = 'mp3',
    sourceType = 'custom',
    userId
  } = options;

  if (!AI_FEATURES.speechFeatures) {
    throw new Error('Speech features are not enabled');
  }

  // Validate text
  const validation = validateTTSText(text);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  // Check cache first
  const cached = await AudioCache.getCached(text, language, voice, speed);
  if (cached) {
    return {
      audioUrl: cached.audioUrl,
      duration: cached.duration,
      cached: true,
      usageCount: cached.usageCount
    };
  }

  // Select voice
  const selectedVoice = voice || getTTSVoice(language);

  try {
    // Generate audio using OpenAI TTS
    const audioBuffer = await textToSpeech({
      text: validation.sanitized,
      voice: selectedVoice,
      speed,
      format
    });

    // Upload to storage
    const filename = generateAudioFilename('tts', format);
    const audioUrl = await uploadToSpaces(audioBuffer, filename, `audio/${format}`);

    // Estimate duration
    const duration = estimateAudioDuration(text, speed);

    // Cache the audio
    await AudioCache.saveToCache({
      text: validation.sanitized,
      language,
      voice: selectedVoice,
      speed,
      audioUrl,
      format,
      duration,
      fileSize: audioBuffer.length,
      sourceType,
      provider: 'openai'
    });

    // Track usage
    if (userId) {
      await trackUsage({
        userId,
        feature: 'tts',
        provider: 'openai',
        metadata: { language, voice: selectedVoice, characterCount: text.length }
      });
    }

    return {
      audioUrl,
      duration,
      cached: false,
      voice: selectedVoice,
      characterCount: validation.characterCount
    };
  } catch (error) {
    console.error('TTS generation failed:', error.message);
    throw new Error('Failed to generate audio. Please try again.');
  }
};

/**
 * Transcribe audio to text
 * @param {Object} options - STT options
 * @returns {Promise<Object>} Transcription result
 */
const transcribeAudio = async (options) => {
  const {
    audioBuffer,
    audioFile,
    language,
    userId
  } = options;

  if (!AI_FEATURES.speechFeatures) {
    throw new Error('Speech features are not enabled');
  }

  // Validate file if provided
  if (audioFile) {
    const validation = validateAudioFile(audioFile, 'stt');
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
  }

  try {
    const result = await speechToText({
      audio: audioBuffer || audioFile.buffer,
      language,
      filename: audioFile?.originalname || 'audio.mp3'
    });

    // Track usage
    if (userId) {
      await trackUsage({
        userId,
        feature: 'stt',
        provider: 'openai',
        metadata: { language, duration: result.duration }
      });
    }

    return {
      text: result.text,
      language: result.language || language,
      duration: result.duration
    };
  } catch (error) {
    console.error('STT transcription failed:', error.message);
    throw new Error('Failed to transcribe audio. Please try again.');
  }
};

/**
 * Evaluate pronunciation
 * @param {Object} options - Evaluation options
 * @returns {Promise<Object>} Evaluation result with scores and feedback
 */
const evaluatePronunciation = async (options) => {
  const {
    audioBuffer,
    audioFile,
    targetText,
    language,
    userId,
    context = {}
  } = options;

  if (!AI_FEATURES.speechFeatures) {
    throw new Error('Speech features are not enabled');
  }

  // Validate file
  if (audioFile) {
    const validation = validateAudioFile(audioFile, 'pronunciation');
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
  }

  const startTime = Date.now();

  try {
    // Step 1: Transcribe the user's audio
    const transcription = await speechToText({
      audio: audioBuffer || audioFile.buffer,
      language,
      filename: audioFile?.originalname || 'audio.mp3'
    });

    // Step 2: Calculate basic pronunciation metrics
    const basicMetrics = calculatePronunciationMetrics(targetText, transcription.text);

    // Step 3: Get AI feedback for detailed analysis
    let aiFeedback = null;
    try {
      const prompt = buildPronunciationFeedbackPrompt({
        targetText,
        transcription: transcription.text,
        language,
        basicMetrics
      });

      const response = await chatCompletion({
        messages: [{ role: 'user', content: prompt }],
        feature: 'pronunciationFeedback',
        json: true
      });

      aiFeedback = parseJSONResponse(response.content);
    } catch (aiError) {
      console.error('AI feedback failed, using basic metrics:', aiError.message);
    }

    // Step 4: Merge metrics with AI feedback
    const finalScore = {
      overall: aiFeedback?.score?.overall || basicMetrics.overall,
      accuracy: aiFeedback?.score?.accuracy || basicMetrics.accuracy,
      fluency: aiFeedback?.score?.fluency || basicMetrics.fluency,
      completeness: aiFeedback?.score?.completeness || basicMetrics.completeness,
      wordScores: aiFeedback?.wordScores || basicMetrics.wordScores
    };

    const feedback = {
      summary: aiFeedback?.summary || generateBasicSummary(finalScore.overall),
      improvements: aiFeedback?.improvements || generateBasicImprovements(basicMetrics),
      strengths: aiFeedback?.strengths || []
    };

    // Step 5: Upload user audio to storage
    let userAudioUrl = null;
    if (userId) {
      const filename = generateAudioFilename(`pronunciation_${userId}`, 'mp3');
      userAudioUrl = await uploadToSpaces(
        audioBuffer || audioFile.buffer,
        filename,
        'audio/mpeg'
      );
    }

    // Step 6: Generate reference TTS audio
    let referenceAudioUrl = null;
    try {
      const referenceAudio = await generateTTS({
        text: targetText,
        language,
        speed: 0.9, // Slightly slower for learning
        sourceType: 'vocabulary'
      });
      referenceAudioUrl = referenceAudio.audioUrl;
    } catch (ttsError) {
      console.error('Reference TTS generation failed:', ttsError.message);
    }

    // Step 7: Calculate XP
    let xpAwarded = XP_REWARDS.PRONUNCIATION_ATTEMPT;
    if (finalScore.overall >= 90) {
      xpAwarded = XP_REWARDS.PRONUNCIATION_EXCELLENT;
    } else if (finalScore.overall >= 70) {
      xpAwarded = XP_REWARDS.PRONUNCIATION_GOOD;
    }

    // Step 8: Save attempt record
    let attemptId = null;
    if (userId) {
      const attempt = await PronunciationAttempt.create({
        user: userId,
        targetText,
        language,
        userAudioUrl,
        transcription: transcription.text,
        referenceAudioUrl,
        score: finalScore,
        feedback,
        context: {
          source: context.source || 'practice',
          vocabularyId: context.vocabularyId,
          lessonId: context.lessonId
        },
        duration: transcription.duration,
        xpAwarded
      });
      attemptId = attempt._id;

      // Track usage
      await trackUsage({
        userId,
        feature: 'pronunciationEvaluation',
        provider: 'openai',
        metadata: {
          language,
          score: finalScore.overall,
          targetTextLength: targetText.length
        }
      });
    }

    return {
      attemptId,
      transcription: transcription.text,
      score: finalScore,
      feedback,
      referenceAudioUrl,
      xpAwarded,
      processingTimeMs: Date.now() - startTime
    };
  } catch (error) {
    console.error('Pronunciation evaluation failed:', error.message);
    throw error;
  }
};

/**
 * Generate basic summary based on score
 */
const generateBasicSummary = (score) => {
  if (score >= 90) return 'Excellent pronunciation! You sound very natural.';
  if (score >= 70) return 'Good job! Your pronunciation is clear with minor areas to improve.';
  if (score >= 50) return 'Nice effort! Keep practicing to improve clarity.';
  return 'Keep practicing! Focus on listening to native pronunciation.';
};

/**
 * Generate basic improvement suggestions
 */
const generateBasicImprovements = (metrics) => {
  const improvements = [];

  if (metrics.accuracy < 70) {
    improvements.push('Focus on pronouncing each word more clearly');
  }
  if (metrics.fluency < 70) {
    improvements.push('Try to maintain a steady speaking pace');
  }
  if (metrics.completeness < 70) {
    improvements.push('Make sure to say the complete phrase');
  }

  if (improvements.length === 0) {
    improvements.push('Continue practicing to maintain your skills');
  }

  return improvements;
};

/**
 * Get user's pronunciation history
 * @param {String} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} History with attempts
 */
const getPronunciationHistory = async (userId, options = {}) => {
  return await PronunciationAttempt.getUserHistory(userId, options);
};

/**
 * Get user's pronunciation stats
 * @param {String} userId - User ID
 * @param {String} language - Optional language filter
 * @returns {Promise<Object>} Stats summary
 */
const getPronunciationStats = async (userId, language = null) => {
  return await PronunciationAttempt.getUserStats(userId, language);
};

/**
 * Get best pronunciation attempt for a text
 * @param {String} userId - User ID
 * @param {String} targetText - Target text
 * @returns {Promise<Object>} Best attempt
 */
const getBestAttempt = async (userId, targetText) => {
  return await PronunciationAttempt.getBestAttempt(userId, targetText);
};

/**
 * Get available TTS voices
 * @param {String} language - Language code
 * @returns {Array} Available voices
 */
const getAvailableVoices = (language = null) => {
  if (language && TTS_VOICES[language]) {
    return TTS_VOICES[language];
  }
  return TTS_VOICES.default;
};

/**
 * Get audio cache stats
 * @returns {Promise<Object>} Cache statistics
 */
const getCacheStats = async () => {
  return await AudioCache.getStats();
};

module.exports = {
  generateTTS,
  transcribeAudio,
  evaluatePronunciation,
  getPronunciationHistory,
  getPronunciationStats,
  getBestAttempt,
  getAvailableVoices,
  getCacheStats
};
