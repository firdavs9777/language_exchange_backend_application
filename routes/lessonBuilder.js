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
  getAIGeneratedLessons,
  getLessonTemplates,
  deleteLesson,
  updatePublishStatus,
  getGenerationStats
} = require('../controllers/lessonBuilder');

const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// ============================================================
// GENERATION ROUTES
// ============================================================

// Generate a single lesson
router.post('/generate', generateLesson);

// Generate exercises only
router.post('/generate/exercises', generateExercises);

// Generate vocabulary list
router.post('/generate/vocabulary', generateVocabulary);

// Generate complete curriculum (Admin only)
router.post('/generate/curriculum', authorize('admin'), generateCurriculum);

// Batch generate lessons (Admin only)
router.post('/generate/batch', authorize('admin'), batchGenerateLessons);

// Enhance existing lesson
router.post('/:id/enhance', enhanceLesson);

// ============================================================
// MANAGEMENT ROUTES
// ============================================================

// Get all AI-generated lessons
router.get('/ai-generated', getAIGeneratedLessons);

// Get lesson templates info
router.get('/templates', getLessonTemplates);

// Get generation statistics (Admin only)
router.get('/stats', authorize('admin'), getGenerationStats);

// Delete a lesson (Admin only)
router.delete('/:id', authorize('admin'), deleteLesson);

// Update publish status (Admin only)
router.patch('/:id/publish', authorize('admin'), updatePublishStatus);

module.exports = router;
