const express = require('express');
const {
  createReport,
  getAllReports,
  getReport,
  getMyReports,
  getReportsByUser,
  getPendingCount,
  startReview,
  resolveReport,
  dismissReport,
  deleteReport,
  getReportStats
} = require('../controllers/report');

const router = express.Router();

const { protect, authorize, authorizeRole } = require('../middleware/auth');
const { reportLimiter } = require('../middleware/rateLimiter');

// Public routes (none for reports)

// Protected routes (authenticated users)
router.use(protect);

// User routes - anyone can report content (rate limited to prevent abuse)
router.post('/', reportLimiter, createReport);
router.get('/my-reports', getMyReports);

// Admin only routes
router.get('/', authorizeRole('admin'), getAllReports);
router.get('/stats', authorizeRole('admin'), getReportStats);
router.get('/stats/pending', authorizeRole('admin'), getPendingCount);
router.get('/user/:userId', authorizeRole('admin'), getReportsByUser);
router.get('/:id', authorizeRole('admin'), getReport);
router.put('/:id/review', authorizeRole('admin'), startReview);
router.put('/:id/resolve', authorizeRole('admin'), resolveReport);
router.put('/:id/dismiss', authorizeRole('admin'), dismissReport);
router.delete('/:id', authorizeRole('admin'), deleteReport);

module.exports = router;