const express = require('express');
const router = express.Router();
const multer = require('multer');

const {
  getMyMemory,
  setPersona,
  getDailyPlan,
  completeTask,
  listSessions,
  getSession,
  startSession,
  sendMessage,
  endSession,
  speakMessage,
  transcribeVoice,
  listScenarios,
  startRoleplaySession,
  generateStory,
  imageVocabDescribe,
  imageVocabGrade,
  generatePronunciationSentence,
  scorePronunciationAttempt,
  submitPronunciationSummary,
} = require('../controllers/tutor');

const { protect } = require('../middleware/auth');
const { tutorMessageLimiter } = require('../middleware/rateLimiter');

// Multer memory storage for STT uploads (25MB cap matches /speech route).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/wav',
      'audio/webm', 'audio/ogg', 'audio/flac', 'audio/x-m4a', 'audio/x-wav',
      'audio/aac', 'audio/x-aac',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`), false);
    }
  },
});

// Image multer — 10MB cap, JPEG/PNG/WebP.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image type: ${file.mimetype}`), false);
    }
  },
});

router.use(protect);

/**
 * @route   GET /api/v1/tutor/me
 */
router.get('/me', getMyMemory);

/**
 * @route   PUT /api/v1/tutor/persona
 */
router.put('/persona', setPersona);

/**
 * @route   GET /api/v1/tutor/daily-plan
 */
router.get('/daily-plan', getDailyPlan);

/**
 * @route   PATCH /api/v1/tutor/daily-plan/task/:type/complete
 */
router.patch('/daily-plan/task/:type/complete', completeTask);

/**
 * @route   GET /api/v1/tutor/sessions
 */
router.get('/sessions', listSessions);

/**
 * @route   POST /api/v1/tutor/sessions
 */
router.post('/sessions', startSession);

/**
 * @route   GET /api/v1/tutor/sessions/:id
 */
router.get('/sessions/:id', getSession);

/**
 * @route   POST /api/v1/tutor/sessions/:id/message
 * @access  Private + dedicated 30/min/user limiter to cap OpenAI cost
 */
router.post('/sessions/:id/message', tutorMessageLimiter, sendMessage);

/**
 * @route   POST /api/v1/tutor/sessions/:id/end
 */
router.post('/sessions/:id/end', endSession);

/**
 * @route   POST /api/v1/tutor/sessions/:id/speak
 * @desc    TTS for an assistant message (defaults to last one)
 */
router.post('/sessions/:id/speak', speakMessage);

/**
 * @route   POST /api/v1/tutor/sessions/:id/transcribe
 * @desc    STT for a user voice recording (multipart 'audio')
 */
router.post('/sessions/:id/transcribe', upload.single('audio'), transcribeVoice);

/**
 * @route   GET /api/v1/tutor/scenarios
 */
router.get('/scenarios', listScenarios);

/**
 * @route   POST /api/v1/tutor/sessions/roleplay
 */
router.post('/sessions/roleplay', startRoleplaySession);

/**
 * @route   POST /api/v1/tutor/stories/generate
 */
router.post('/stories/generate', generateStory);

/**
 * @route   POST /api/v1/tutor/image-vocab/describe  (multipart 'image')
 */
router.post('/image-vocab/describe', imageUpload.single('image'), imageVocabDescribe);

/**
 * @route   POST /api/v1/tutor/image-vocab/grade     (multipart 'image' + 'description')
 */
router.post('/image-vocab/grade', imageUpload.single('image'), imageVocabGrade);

/**
 * @route   POST /api/v1/tutor/pronunciation/sentence
 */
router.post('/pronunciation/sentence', generatePronunciationSentence);

/**
 * @route   POST /api/v1/tutor/pronunciation/score   (multipart 'audio' + 'targetSentence')
 */
router.post('/pronunciation/score', upload.single('audio'), scorePronunciationAttempt);

/**
 * @route   POST /api/v1/tutor/pronunciation/summary
 */
router.post('/pronunciation/summary', submitPronunciationSummary);

module.exports = router;
