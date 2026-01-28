const express = require('express');
const router = express.Router();

const {
  getEnhancedTranslation,
  detectIdioms,
  explainGrammar,
  getAlternatives,
  getContextualTranslation,
  getPopularTranslations,
  getCacheStats
} = require('../controllers/aiTranslation');

const { protect } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(protect);

// ===================== TRANSLATION ROUTES =====================

/**
 * @route   POST /api/v1/translate/enhanced
 * @desc    Get enhanced translation with educational context
 * @access  Private
 */
router.post('/enhanced', aiRateLimiter('translation'), getEnhancedTranslation);

/**
 * @route   POST /api/v1/translate/idioms
 * @desc    Detect and explain idioms in text
 * @access  Private
 */
router.post('/idioms', aiRateLimiter('translation'), detectIdioms);

/**
 * @route   POST /api/v1/translate/grammar
 * @desc    Explain grammar differences between languages
 * @access  Private
 */
router.post('/grammar', aiRateLimiter('translation'), explainGrammar);

/**
 * @route   POST /api/v1/translate/alternatives
 * @desc    Get alternative translations with context
 * @access  Private
 */
router.post('/alternatives', aiRateLimiter('translation'), getAlternatives);

/**
 * @route   POST /api/v1/translate/contextual
 * @desc    Get context-aware translation
 * @access  Private
 */
router.post('/contextual', aiRateLimiter('translation'), getContextualTranslation);

/**
 * @route   GET /api/v1/translate/popular
 * @desc    Get popular translations for a language
 * @access  Private
 */
router.get('/popular', getPopularTranslations);

/**
 * @route   GET /api/v1/translate/cache/stats
 * @desc    Get translation cache statistics (admin only)
 * @access  Private/Admin
 */
router.get('/cache/stats', getCacheStats);

module.exports = router;
