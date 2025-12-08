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
} = require('../controllers/reports');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// Public routes (none for reports)

// Protected routes (authenticated users)
router.use(protect);

// User routes - anyone can report content
router.post('/', createReport);
router.get('/my-reports', getMyReports);

// Admin only routes
router.get('/', authorize('admin'), getAllReports);
router.get('/stats', authorize('admin'), getReportStats);
router.get('/stats/pending', authorize('admin'), getPendingCount);
router.get('/user/:userId', authorize('admin'), getReportsByUser);
router.get('/:id', authorize('admin'), getReport);
router.put('/:id/review', authorize('admin'), startReview);
router.put('/:id/resolve', authorize('admin'), resolveReport);
router.put('/:id/dismiss', authorize('admin'), dismissReport);
router.delete('/:id', authorize('admin'), deleteReport);

module.exports = router;