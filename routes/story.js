const express = require('express');
const Story = require('../models/Story');
const {
  getMyStories,
  getStoriesFeed,
  getStory,
  getStoryViewers,
  getUserStories,
  createStory,
  deleteStory,
  markStoryViewed
} = require('../controllers/stories');

const advancedResults = require('../middleware/advancedResults');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Stories feed routes
router
  .route('/feed')
  .get(protect, getStoriesFeed);

// My stories route
router
  .route('/my-stories')
  .get(protect, getMyStories);

// Main stories routes
router
  .route('/')
  .post(protect, createStory);

// Individual story routes
router
  .route('/:id')
  .get(protect, getStory)
  .delete(protect, authorize('user','story'), deleteStory);

// Story interactions
router
  .route('/:id/view')
  .post(protect, markStoryViewed);

router
  .route('/:id/views')
  .get(protect, getStoryViewers);

// User-specific stories
router
  .route('/user/:userId')
  .get(protect, advancedResults(Story, {
    path: 'user',
    select: 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn'
  }), getUserStories);

module.exports = router;