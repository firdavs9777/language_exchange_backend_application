const express = require('express');
const {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
  getUserReviews
} = require('../../controllers/fitbowl/reviews');

const router = express.Router();
const { protect } = require('../../middleware/fitbowl/auth');
const { validate } = require('../../middleware/fitbowl/validate');
const {
  createReviewValidation
} = require('../../validators/fitbowl/reviews');

router
  .route('/')
  .get(getReviews)
  .post(protect, createReviewValidation, validate, createReview);

router
  .route('/me')
  .get(protect, getUserReviews);

router
  .route('/:id')
  .put(protect, updateReview)
  .delete(protect, deleteReview);

module.exports = router;
