/**
 * Lesson Builder Routes
 * API endpoints for AI-powered lesson generation
 */

const express = require('express');
const router = express.Router();

const {
  // Generation
  generateLesson,
  generateExercises,
  generateVocabulary,
  generateCurriculum,
  enhanceLesson,
  batchGenerateLessons,
  // Management
  getLessonById,
  completeLesson,
  getAIGeneratedLessons,
  getLessonTemplates,
  deleteLesson,
  updatePublishStatus,
  getGenerationStats
} = require('../controllers/lessonBuilder');

const { protect, authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(protect);

// ============================================================
// GENERATION ROUTES (AI rate limited)
// ============================================================

// Generate a single lesson
router.post('/generate', aiRateLimiter('lessonBuilder'), generateLesson);

// Generate exercises only
router.post('/generate/exercises', aiRateLimiter('lessonBuilder'), generateExercises);

// Generate vocabulary list
router.post('/generate/vocabulary', aiRateLimiter('lessonBuilder'), generateVocabulary);

// Generate complete curriculum (Admin only)
router.post('/generate/curriculum', authorize('admin'), aiRateLimiter('lessonBuilder'), generateCurriculum);

// Batch generate lessons (Admin only)
router.post('/generate/batch', authorize('admin'), aiRateLimiter('lessonBuilder'), batchGenerateLessons);

// Enhance existing lesson
router.post('/:id/enhance', aiRateLimiter('lessonBuilder'), enhanceLesson);

// Complete/submit a lesson
router.post('/:id/complete', completeLesson);

// ============================================================
// MANAGEMENT ROUTES
// ============================================================

// Get all AI-generated lessons
router.get('/ai-generated', getAIGeneratedLessons);

// Get lesson templates info
router.get('/templates', getLessonTemplates);

// Get generation statistics (Admin only)
router.get('/stats', authorize('admin'), getGenerationStats);

// Get a single lesson by ID (must be after specific routes)
router.get('/:id', getLessonById);

// Delete a lesson (Admin only)
router.delete('/:id', authorize('admin'), deleteLesson);

// Update publish status (Admin only)
router.patch('/:id/publish', authorize('admin'), updatePublishStatus);

module.exports = router;
