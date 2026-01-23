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
  getActivitySummary
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

module.exports = router;
