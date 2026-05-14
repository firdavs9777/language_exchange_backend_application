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
const { checkTutorQuota, checkChatQuotaSessionAware } = require('../middleware/checkTutorQuota');

// Some clients (Flutter http.MultipartFile.fromPath without an explicit
// contentType, certain Android pickers, curl --data-binary) drop the
// mime header and the file arrives as application/octet-stream. Trust
// the filename extension in that single case — multer's `originalname`
// comes from the multipart Content-Disposition, not the client mime.
const _extToMime = (filename, kind) => {
  if (typeof filename !== 'string') return null;
  const ext = filename.toLowerCase().split('.').pop();
  if (!ext) return null;
  const audio = {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', webm: 'audio/webm',
    ogg: 'audio/ogg', flac: 'audio/flac', aac: 'audio/aac', mp4: 'audio/mp4',
  };
  const image = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  };
  return (kind === 'audio' ? audio : image)[ext] || null;
};

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
    const mime = file.mimetype === 'application/octet-stream'
      ? (_extToMime(file.originalname, 'audio') || file.mimetype)
      : file.mimetype;
    if (allowedMimes.includes(mime)) {
      file.mimetype = mime; // normalize for downstream code
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
    const mime = file.mimetype === 'application/octet-stream'
      ? (_extToMime(file.originalname, 'image') || file.mimetype)
      : file.mimetype;
    if (allowedMimes.includes(mime)) {
      file.mimetype = mime;
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
router.post('/sessions/:id/message', checkChatQuotaSessionAware, tutorMessageLimiter, sendMessage);

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
router.post('/sessions/roleplay', checkTutorQuota('roleplay'), startRoleplaySession);

/**
 * @route   POST /api/v1/tutor/stories/generate
 */
router.post('/stories/generate', checkTutorQuota('story'), generateStory);

/**
 * @route   POST /api/v1/tutor/image-vocab/describe  (multipart 'image')
 */
router.post('/image-vocab/describe', checkTutorQuota('photo'), imageUpload.single('image'), imageVocabDescribe);

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
router.post('/pronunciation/summary', checkTutorQuota('pronunciation'), submitPronunciationSummary);

module.exports = router;
