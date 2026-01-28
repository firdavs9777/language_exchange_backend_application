const express = require('express');
const router = express.Router();

const {
  // Progress
  getProgress,
  getLeaderboard,
  updateDailyGoal,
  updatePreferences,
  // Vocabulary
  getVocabulary,
  addVocabulary,
  getVocabularyReview,
  submitVocabularyReview,
  updateVocabulary,
  deleteVocabulary,
  // Lessons
  getLessons,
  getRecommendedLessons,
  getCurriculum,
  startLesson,
  submitLessonAnswer,
  completeLesson,
  // Quizzes
  getQuizzes,
  startQuiz,
  submitQuizAnswer,
  completeQuiz,
  // Challenges
  getChallenges,
  getChallengeStats,
  // Achievements
  getAchievements,
  getUnseenAchievements,
  markAchievementsSeen,
  setFeaturedAchievements,
  // Activity
  getActivitySummary,
  // AI Recommendations
  getAdaptiveRecommendations,
  refreshRecommendations,
  getWeakAreas,
  // AI Quizzes
  generateAIQuiz,
  getAIQuizzes,
  startAIQuiz,
  submitAIQuizAnswer,
  completeAIQuiz,
  getAIQuizStats
} = require('../controllers/learning');

const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// ===================== PROGRESS ROUTES =====================
router.get('/progress', getProgress);
router.get('/progress/leaderboard', getLeaderboard);
router.put('/progress/daily-goal', updateDailyGoal);
router.put('/progress/preferences', updatePreferences);

// ===================== VOCABULARY ROUTES =====================
router.route('/vocabulary')
  .get(getVocabulary)
  .post(addVocabulary);

router.get('/vocabulary/review', getVocabularyReview);

router.route('/vocabulary/:id')
  .put(updateVocabulary)
  .delete(deleteVocabulary);

router.post('/vocabulary/:id/review', submitVocabularyReview);

// ===================== LESSON ROUTES =====================
router.get('/lessons', getLessons);
router.get('/lessons/recommended', getRecommendedLessons);
router.get('/lessons/curriculum', getCurriculum);

router.post('/lessons/:id/start', startLesson);
router.post('/lessons/:id/answer', submitLessonAnswer);
router.post('/lessons/:id/complete', completeLesson);

// ===================== QUIZ ROUTES =====================
router.get('/quizzes', getQuizzes);
router.post('/quizzes/:id/start', startQuiz);
router.post('/quizzes/:id/answer', submitQuizAnswer);
router.post('/quizzes/:id/complete', completeQuiz);

// ===================== CHALLENGE ROUTES =====================
router.get('/challenges', getChallenges);
router.get('/challenges/stats', getChallengeStats);

// ===================== ACHIEVEMENT ROUTES =====================
router.get('/achievements', getAchievements);
router.get('/achievements/unseen', getUnseenAchievements);
router.post('/achievements/seen', markAchievementsSeen);
router.put('/achievements/featured', setFeaturedAchievements);

// ===================== ACTIVITY ROUTES =====================
router.get('/activity', getActivitySummary);

// ===================== AI RECOMMENDATION ROUTES =====================
router.get('/recommendations/adaptive', getAdaptiveRecommendations);
router.post('/recommendations/refresh', refreshRecommendations);
router.get('/progress/weak-areas', getWeakAreas);

// ===================== AI QUIZ ROUTES =====================
router.post('/quizzes/generate', generateAIQuiz);
router.get('/quizzes/ai', getAIQuizzes);
router.get('/quizzes/ai/stats', getAIQuizStats);
router.post('/quizzes/ai/:id/start', startAIQuiz);
router.post('/quizzes/ai/:id/answer', submitAIQuizAnswer);
router.post('/quizzes/ai/:id/complete', completeAIQuiz);

module.exports = router;
