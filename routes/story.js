const express = require('express');
const Story = require('../models/Story');
const {
  // Basic story CRUD
  getMyStories,
  getStoriesFeed,
  getStory,
  getStoryViewers,
  getUserStories,
  createStory,
  createVideoStory,
  getVideoConfig,
  deleteStory,
  markStoryViewed,
  
  // Reactions
  reactToStory,
  removeReaction,
  getStoryReactions,
  
  // Replies
  replyToStory,
  
  // Polls & Questions
  voteStoryPoll,
  answerStoryQuestion,
  getQuestionResponses,
  
  // Sharing
  shareStory,
  
  // Highlights
  createHighlight,
  getUserHighlights,
  getMyHighlights,
  addStoryToHighlight,
  removeStoryFromHighlight,
  updateHighlight,
  deleteHighlight,
  
  // Archive
  getArchivedStories,
  archiveStory,
  
  // Close Friends
  getCloseFriends,
  addCloseFriend,
  removeCloseFriend
} = require('../controllers/stories');
const { checkStoryLimit } = require('../middleware/checkLimitations');
const { uploadMultiple } = require('../middleware/uploadToSpaces');
const { uploadSingleVideo, generateThumbnail } = require('../middleware/uploadVideoToSpaces');

const advancedResults = require('../middleware/advancedResults');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { interactionLimiter } = require('../middleware/rateLimiter');

// ========== CONFIG ==========
router.route('/video-config').get(getVideoConfig); // Get video upload constraints (public)

// ========== FEED & MY STORIES ==========
router.route('/feed').get(protect, getStoriesFeed);
router.route('/my-stories').get(protect, getMyStories);

// ========== ARCHIVE ==========
router.route('/archive').get(protect, getArchivedStories);

// ========== CLOSE FRIENDS ==========
router.route('/close-friends').get(protect, getCloseFriends);
router.route('/close-friends/:userId')
  .post(protect, addCloseFriend)
  .delete(protect, removeCloseFriend);

// ========== HIGHLIGHTS ==========
router.route('/highlights')
  .get(protect, getMyHighlights)
  .post(protect, createHighlight);

router.route('/highlights/user/:userId').get(protect, getUserHighlights);

router.route('/highlights/:id')
  .put(protect, updateHighlight)
  .delete(protect, deleteHighlight);

router.route('/highlights/:id/stories')
  .post(protect, addStoryToHighlight);

router.route('/highlights/:id/stories/:storyId')
  .delete(protect, removeStoryFromHighlight);

// ========== CREATE STORY ==========
router.route('/')
  .post(protect, checkStoryLimit, uploadMultiple('media', 5, 'bananatalk/stories'), createStory);

// ========== CREATE VIDEO STORY (YouTube-style, max 10 minutes) ==========
router.route('/video')
  .post(
    protect,
    checkStoryLimit,
    uploadSingleVideo('video', 'bananatalk/stories/videos'),
    generateThumbnail,
    createVideoStory
  );

// ========== USER STORIES ==========
router.route('/user/:userId')
  .get(protect, advancedResults(Story, {
    path: 'user',
    select: 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn'
  }), getUserStories);

// ========== INDIVIDUAL STORY ==========
router.route('/:id')
  .get(protect, getStory)
  .delete(protect, authorize('user', 'story'), deleteStory);

// ========== STORY VIEWS ==========
router.route('/:id/view').post(protect, interactionLimiter, markStoryViewed);
router.route('/:id/views').get(protect, getStoryViewers);

// ========== STORY REACTIONS ==========
router.route('/:id/react')
  .post(protect, interactionLimiter, reactToStory)
  .delete(protect, interactionLimiter, removeReaction);
router.route('/:id/reactions').get(protect, getStoryReactions);

// ========== STORY REPLIES ==========
router.route('/:id/reply').post(protect, interactionLimiter, replyToStory);

// ========== STORY POLLS ==========
router.route('/:id/poll/vote').post(protect, interactionLimiter, voteStoryPoll);

// ========== STORY QUESTIONS ==========
router.route('/:id/question/answer').post(protect, interactionLimiter, answerStoryQuestion);
router.route('/:id/question/responses').get(protect, getQuestionResponses);

// ========== STORY SHARING ==========
router.route('/:id/share').post(protect, interactionLimiter, shareStory);

// ========== STORY ARCHIVE ==========
router.route('/:id/archive').post(protect, archiveStory);

module.exports = router;