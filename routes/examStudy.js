const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/async');
const ExamLanguage = require('../models/ExamLanguage');
const ExamType = require('../models/ExamType');
const ExamSection = require('../models/ExamSection');
const ExamQuestion = require('../models/ExamQuestion');
const ExamVocabularyWord = require('../models/ExamVocabularyWord');
const UserExamProgress = require('../models/UserExamProgress');
const UserStudyPlan = require('../models/UserStudyPlan');
const EvaluationJob = require('../models/EvaluationJob');
const examEvaluationService = require('../services/examEvaluationService');
const examStudyPlanService = require('../services/examStudyPlanService');
const multer = require('multer');
const { transcribeAudio, generateTTS } = require('../services/speechService');

// All exam-study endpoints require auth — practice + progress are user-scoped.
router.use(protect);

const ALLOWED_AUDIO_MIMES = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
  'audio/wav', 'audio/webm', 'audio/ogg', 'audio/flac',
  'audio/x-m4a', 'audio/x-wav', 'audio/aac',
  // Some uploaders (curl, older browsers) send octet-stream when they
  // can't classify; accept it for known audio extensions and let the
  // STT layer reject if the bytes are bogus.
  'application/octet-stream',
];

const _multerAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_AUDIO_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid audio mime type: ${file.mimetype}`), false);
    }
  },
});

// Wrap multer so its errors become a clean JSON 400 instead of the
// default Express 500 that surfaces opaquely on the client. Logs the
// incoming mime + size so backend logs make this debuggable next time.
function audioUpload(req, res, next) {
  _multerAudio.single('audio')(req, res, (err) => {
    if (err) {
      const code =
        err.code === 'LIMIT_FILE_SIZE' ? 'AUDIO_TOO_LARGE' : 'BAD_AUDIO_UPLOAD';
      console.warn('[examStudy] audio upload rejected:', err.message);
      return res.status(400).json({
        success: false,
        code,
        message: err.message,
      });
    }
    if (req.file) {
      console.log(
        `[examStudy] audio upload accepted: mimetype=${req.file.mimetype} ` +
          `size=${req.file.size} originalname=${req.file.originalname}`,
      );
    }
    next();
  });
}

// GET /api/v1/exam-study/languages
// Used by: app's language picker on the Exam Study tab.
router.get(
  '/languages',
  asyncHandler(async (req, res) => {
    const languages = await ExamLanguage.find({ active: true }).sort({ name: 1 });
    res.json({ success: true, data: languages });
  })
);

// GET /api/v1/exam-study/languages/:languageId/exams
router.get(
  '/languages/:languageId/exams',
  asyncHandler(async (req, res) => {
    const { languageId } = req.params;
    const exams = await ExamType.find({ languageId, active: true });
    res.json({ success: true, data: exams });
  })
);

// GET /api/v1/exam-study/exams/:examId/sections
router.get(
  '/exams/:examId/sections',
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const sections = await ExamSection.find({ examId });
    res.json({ success: true, data: sections });
  })
);

// GET /api/v1/exam-study/sections/:sectionId/questions
// Query params: limit, skip, difficulty, source, topic
router.get(
  '/sections/:sectionId/questions',
  asyncHandler(async (req, res) => {
    const { sectionId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const skip = parseInt(req.query.skip, 10) || 0;
    const { difficulty, source, topic } = req.query;

    const query = { sectionId };
    if (difficulty) query.difficulty = difficulty;
    if (source) query.source = source;
    if (topic) query.topic = topic;

    const questions = await ExamQuestion.find(query).skip(skip).limit(limit);
    res.json({ success: true, data: questions });
  })
);

// GET /api/v1/exam-study/sections/:sectionId/topics
// Returns the distinct list of topics in this section, with question
// counts so the picker can show "Climate · 4 questions" style chips.
router.get(
  '/sections/:sectionId/topics',
  asyncHandler(async (req, res) => {
    const { sectionId } = req.params;
    const sectionObjectId = new mongoose.Types.ObjectId(sectionId);
    const rows = await ExamQuestion.aggregate([
      { $match: { sectionId: sectionObjectId, topic: { $ne: null, $ne: '' } } },
      { $group: { _id: '$topic', questionCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({
      success: true,
      data: rows.map((r) => ({
        topic: r._id,
        questionCount: r.questionCount,
      })),
    });
  })
);

// POST /api/v1/exam-study/questions/:questionId/submit-answer
// Body: { userAnswer, timeSpent }
// MC path returns 200 instant; essay/speaking will return 202 in Chunk D.
router.post(
  '/questions/:questionId/submit-answer',
  asyncHandler(async (req, res) => {
    const { questionId } = req.params;
    const { userAnswer } = req.body;
    const userId = req.user._id;

    if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_ANSWER',
        message: 'userAnswer is required',
      });
    }

    const question = await ExamQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        code: 'QUESTION_NOT_FOUND',
        message: 'Question not found',
      });
    }

    // MC: instant feedback + progress update.
    if (question.questionType === 'multiple-choice') {
      const isCorrect =
        String(userAnswer).trim() === String(question.correctAnswer).trim();
      const score = isCorrect ? 100 : 0;

      const sectionKey = await _resolveSectionKey(question.sectionId);
      const progress = await _bumpProgress({
        userId,
        examId: question.examId,
        sectionKey,
        attempted: 1,
        correct: isCorrect ? 1 : 0,
        lastQuestionId: question._id,
      });

      return res.json({
        success: true,
        score,
        isCorrect,
        explanation: question.explanation || '',
        feedback: isCorrect
          ? 'Correct!'
          : `Incorrect.${question.explanation ? ' ' + question.explanation : ''}`,
      });
    }

    // Essay — create an async eval job, return 202 + poll URL.
    if (question.questionType === 'essay') {
      const text = String(userAnswer).trim();
      if (text.length < examEvaluationService.MIN_CHARS) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ANSWER',
          message: `Essay must be at least ${examEvaluationService.MIN_CHARS} characters`,
        });
      }
      if (text.length > examEvaluationService.MAX_CHARS) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ANSWER',
          message: `Essay must not exceed ${examEvaluationService.MAX_CHARS} characters`,
        });
      }

      const job = await EvaluationJob.create({
        userId,
        questionId: question._id,
        userAnswer: text,
        status: 'pending',
      });

      // Fire-and-forget: the client polls /evaluations/:id. Failures
      // mark the job as failed rather than crashing the route.
      _evaluateInBackground(job._id, text).catch((err) => {
        console.error('[examStudy] background eval crashed:', err);
      });

      return res.status(202).json({
        success: true,
        statusCode: 202,
        pollUrl: `/api/v1/exam-study/evaluations/${job._id}`,
      });
    }

    // Speaking is handled by the dedicated /submit-audio multipart
    // endpoint — keeps JSON essay submissions and audio uploads on
    // separate middleware stacks.
    if (question.questionType === 'speaking-prompt') {
      return res.status(400).json({
        success: false,
        code: 'USE_AUDIO_ENDPOINT',
        message:
          'Speaking submissions must use POST /submit-audio with multipart/form-data and field name "audio".',
      });
    }

    return res.status(400).json({
      success: false,
      code: 'INVALID_QUESTION_TYPE',
      message: 'Unknown question type',
    });
  })
);

// POST /api/v1/exam-study/questions/:questionId/submit-audio
// Multipart audio upload for speaking-prompt questions. Creates an
// EvaluationJob, kicks off Whisper STT + AI eval in the background,
// returns 202 with a poll URL. The client polls the same
// /evaluations/:evaluationId endpoint that essays use.
router.post(
  '/questions/:questionId/submit-audio',
  audioUpload,
  asyncHandler(async (req, res) => {
    const { questionId } = req.params;
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'NO_AUDIO',
        message: 'Audio file is required (multipart field "audio").',
      });
    }

    const question = await ExamQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        code: 'QUESTION_NOT_FOUND',
        message: 'Question not found',
      });
    }
    if (question.questionType !== 'speaking-prompt') {
      return res.status(400).json({
        success: false,
        code: 'NOT_A_SPEAKING_QUESTION',
        message:
          'Use POST /submit-answer (JSON) for multiple-choice and essay questions.',
      });
    }

    // Naive audio-duration floor: most usable speech responses are at
    // least a few KB. Reject < 8 KB as accidental taps without trying
    // to parse the actual audio header (varies by codec).
    if (req.file.size < 8 * 1024) {
      return res.status(400).json({
        success: false,
        code: 'AUDIO_TOO_SHORT',
        message: 'Recording is too short. Please speak for at least a few seconds.',
      });
    }

    const job = await EvaluationJob.create({
      userId,
      questionId: question._id,
      userAnswer: `[speaking response — ${req.file.size} bytes]`,
      status: 'pending',
    });

    // Fire-and-forget. Failures mark the job as failed; never crash
    // the request.
    _evaluateSpeakingInBackground(job._id, req.file.buffer, req.file.mimetype).catch(
      (err) => {
        console.error('[examStudy] background speaking eval crashed:', err);
      }
    );

    return res.status(202).json({
      success: true,
      statusCode: 202,
      pollUrl: `/api/v1/exam-study/evaluations/${job._id}`,
    });
  })
);

// GET /api/v1/exam-study/evaluations/:evaluationId
// Polling endpoint — the client hits this every ~3s until status !=
// 'pending'. Auth check restricts reads to the job's owner.
router.get(
  '/evaluations/:evaluationId',
  asyncHandler(async (req, res) => {
    const { evaluationId } = req.params;
    const job = await EvaluationJob.findById(evaluationId);
    if (!job) {
      return res.status(404).json({
        success: false,
        code: 'EVALUATION_NOT_FOUND',
        message: 'Evaluation not found',
      });
    }
    if (String(job.userId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: "You can only view your own evaluations",
      });
    }
    res.json({
      success: true,
      data: {
        _id: job._id,
        status: job.status,
        score: job.score,
        feedback: job.feedback,
        strengths: job.strengths,
        improvements: job.improvements,
        transcript: job.transcript,
        audioUrl: job.audioUrl,
        errorMessage: job.errorMessage,
        completedAt: job.completedAt,
      },
    });
  })
);

/**
 * Speaking equivalent of _evaluateInBackground.
 * 1) Transcribe the audio with Whisper.
 * 2) Evaluate the transcript with examEvaluationService.evaluateSpeaking.
 * 3) Write transcript + score + feedback to the job, bump progress.
 */
async function _evaluateSpeakingInBackground(jobId, audioBuffer, mimeType) {
  let job;
  try {
    job = await EvaluationJob.findById(jobId);
    if (!job) return;

    // 1. Whisper STT. Map MIME type to file extension and create an
    // audioFile object so Whisper sees the correct codec extension.
    const extMap = {
      'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'mp4',
      'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav',
      'audio/x-wav': 'wav', 'audio/webm': 'webm', 'audio/ogg': 'ogg',
      'audio/flac': 'flac', 'audio/aac': 'aac',
    };
    const ext = extMap[mimeType] || 'mp3';
    const transcription = await transcribeAudio({
      audioBuffer,
      audioFile: { buffer: audioBuffer, originalname: `audio.${ext}` },
      // Let Whisper auto-detect language by default. For higher
      // accuracy we could plumb through the exam's language code,
      // but the default is fine for MVP.
    });
    const transcript = transcription?.text || transcription || '';
    job.transcript = transcript;
    await job.save();

    if (!transcript || transcript.trim().length < 5) {
      job.status = 'failed';
      job.errorMessage = 'Could not transcribe audio — please re-record.';
      job.completedAt = new Date();
      await job.save();
      return;
    }

    // 2. Evaluate transcript.
    const result = await examEvaluationService.evaluateSpeaking({ transcript });
    job.status = 'completed';
    job.score = result.score;
    job.feedback = result.feedback;
    job.strengths = result.strengths;
    job.improvements = result.improvements;
    job.completedAt = new Date();
    await job.save();

    // 3. Bump progress — same threshold as essay (≥ 60 counts as
    // "correct" so the section score reflects partial credit).
    const question = await ExamQuestion.findById(job.questionId).select(
      'examId sectionId'
    );
    if (question) {
      const sectionKey = await _resolveSectionKey(question.sectionId);
      const passed = result.score >= 60;
      await _bumpProgress({
        userId: job.userId,
        examId: question.examId,
        sectionKey,
        attempted: 1,
        correct: passed ? 1 : 0,
        lastQuestionId: question._id,
      });
    }
  } catch (err) {
    if (job) {
      job.status = 'failed';
      job.errorMessage = err.message || 'Speaking evaluation failed';
      job.completedAt = new Date();
      try { await job.save(); } catch (_) {}
    }
  }
}

/**
 * Run the essay evaluation in the background and update the job row.
 * Also writes through to UserExamProgress so a completed essay counts
 * the same as a graded MC question.
 */
async function _evaluateInBackground(jobId, essay) {
  let job;
  try {
    job = await EvaluationJob.findById(jobId);
    if (!job) return;

    const result = await examEvaluationService.evaluateEssay({ essay });

    job.status = 'completed';
    job.score = result.score;
    job.feedback = result.feedback;
    job.strengths = result.strengths;
    job.improvements = result.improvements;
    job.completedAt = new Date();
    await job.save();

    // Update progress — essays count as "attempted" + "correct" if the
    // AI awarded ≥60% (rough pass threshold). Treat as section-scoped.
    const question = await ExamQuestion.findById(job.questionId).select(
      'examId sectionId'
    );
    if (!question) return;
    const sectionKey = await _resolveSectionKey(question.sectionId);
    const passed = result.score >= 60;
    await _bumpProgress({
      userId: job.userId,
      examId: question.examId,
      sectionKey,
      attempted: 1,
      correct: passed ? 1 : 0,
      lastQuestionId: question._id,
    });
  } catch (err) {
    if (job) {
      job.status = 'failed';
      job.errorMessage = err.message || 'Evaluation failed';
      job.completedAt = new Date();
      try {
        await job.save();
      } catch (_) {}
    }
  }
}

// GET /api/v1/exam-study/users/:userId/exams/:examId/progress
// Returns the progress doc, or 404 when the user hasn't started this exam.
// The app treats 404 as "empty progress" — graceful degradation.
router.get(
  '/users/:userId/exams/:examId/progress',
  asyncHandler(async (req, res) => {
    const { userId, examId } = req.params;

    // Authorization: a user can only read their own progress.
    if (String(req.user._id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: "You can only view your own progress",
      });
    }

    const progress = await UserExamProgress.findOne({ userId, examId });
    if (!progress) {
      return res.status(404).json({
        success: false,
        code: 'PROGRESS_NOT_FOUND',
        message: 'No progress found for this exam yet',
      });
    }
    res.json({ success: true, data: progress });
  })
);

// POST /api/v1/exam-study/users/:userId/exams/:examId/generate-study-plan
// Body: { targetScore, examDate }
// Creates (or replaces) the active study plan for this user+exam.
router.post(
  '/users/:userId/exams/:examId/generate-study-plan',
  asyncHandler(async (req, res) => {
    const { userId, examId } = req.params;
    const { targetScore, examDate } = req.body || {};

    if (String(req.user._id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You can only generate plans for your own account',
      });
    }
    if (!targetScore || !examDate) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        message: 'targetScore and examDate are required',
      });
    }
    const parsedDate = new Date(examDate);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate <= new Date()) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        message: 'examDate must be a future date',
      });
    }

    const exam = await ExamType.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        code: 'EXAM_NOT_FOUND',
        message: 'Exam not found',
      });
    }

    const progress = await UserExamProgress.findOne({ userId, examId });
    const { milestones, dailyLessons } =
      await examStudyPlanService.generateStudyPlan({
        exam,
        targetScore: Number(targetScore),
        targetExamDate: parsedDate,
        progress,
      });

    let plan = await UserStudyPlan.findOne({ userId, examId, status: 'active' });
    if (!plan) {
      plan = await UserStudyPlan.create({
        userId,
        examId,
        targetScore,
        targetExamDate: parsedDate,
        plan: { milestones, dailyLessons },
      });
    } else {
      plan.targetScore = targetScore;
      plan.targetExamDate = parsedDate;
      plan.plan = { milestones, dailyLessons };
      await plan.save();
    }

    res.json({
      success: true,
      data: plan,
      estimatedHours: milestones.reduce(
        (sum, m) => sum + (Number(m.estimatedHours) || 0),
        0
      ),
    });
  })
);

// GET /api/v1/exam-study/users/:userId/study-plans/:planId
router.get(
  '/users/:userId/study-plans/:planId',
  asyncHandler(async (req, res) => {
    const { userId, planId } = req.params;
    if (String(req.user._id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You can only view your own study plans',
      });
    }
    const plan = await UserStudyPlan.findOne({ _id: planId, userId });
    if (!plan) {
      return res.status(404).json({
        success: false,
        code: 'PLAN_NOT_FOUND',
        message: 'Study plan not found',
      });
    }
    res.json({ success: true, data: plan });
  })
);

// Convenience: get the active plan for a user+exam (or 404 if none).
// The app uses this instead of remembering the planId between sessions.
router.get(
  '/users/:userId/exams/:examId/study-plan',
  asyncHandler(async (req, res) => {
    const { userId, examId } = req.params;
    if (String(req.user._id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You can only view your own study plans',
      });
    }
    const plan = await UserStudyPlan.findOne({
      userId,
      examId,
      status: 'active',
    });
    if (!plan) {
      return res.status(404).json({
        success: false,
        code: 'PLAN_NOT_FOUND',
        message: 'No active study plan for this exam',
      });
    }
    res.json({ success: true, data: plan });
  })
);

/**
 * Atomically bump per-user-per-exam progress counters and recompute the
 * section-percentage + overall score. Sole writer of UserExamProgress
 * so both MC (route handler) and essay (background eval) paths go
 * through the same place.
 *
 * sectionScores is a Map<String, SectionScore>, so we use dot-notation
 * paths in $inc to grow the Map server-side without a read-modify-write
 * round-trip. Mongoose translates these into proper Map operations.
 */
async function _bumpProgress({
  userId,
  examId,
  sectionKey,
  attempted,
  correct,
  lastQuestionId,
}) {
  const inc = {
    questionsAttempted: attempted,
    questionsCorrect: correct,
  };
  if (sectionKey) {
    inc[`sectionScores.${sectionKey}.attempted`] = attempted;
    inc[`sectionScores.${sectionKey}.correct`] = correct;
  }
  const progress = await UserExamProgress.findOneAndUpdate(
    { userId, examId },
    {
      $inc: inc,
      $set: {
        lastAttemptedQuestionId: lastQuestionId,
        lastUpdated: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (!sectionKey) return progress;

  // Recompute the section %; iterate the Map for the overall average.
  const section = progress.sectionScores.get(sectionKey);
  if (section && section.attempted > 0) {
    section.score = Math.round((section.correct / section.attempted) * 100);
    progress.sectionScores.set(sectionKey, section);
  }
  const pcts = [];
  for (const sc of progress.sectionScores.values()) {
    if (sc && typeof sc.score === 'number') pcts.push(sc.score);
  }
  progress.overallScore = pcts.length
    ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
    : null;
  await progress.save();
  return progress;
}

// Resolve a section's `sectionType` ("reading", "writing", …) from its id.
// Memoized via a tiny in-process cache because the section id → type
// mapping never changes during a process lifetime and a section lookup on
// every MC submission would be wasteful.
const _sectionTypeCache = new Map();
async function _resolveSectionKey(sectionId) {
  const cached = _sectionTypeCache.get(String(sectionId));
  if (cached) return cached;
  const section = await ExamSection.findById(sectionId).select('sectionType');
  if (!section) return null;
  _sectionTypeCache.set(String(sectionId), section.sectionType);
  return section.sectionType;
}

// =============================================================================
// VOCABULARY — browse + level/topic pickers + practice quiz
// =============================================================================

// In-process quiz cache: { quizId → { items: [{wordId, correctChoice}], expiresAt } }
// Submit endpoint validates against this so the client can't trust-bypass scoring.
// 30 min TTL; entries removed lazily on access.
const _quizCache = new Map();
const QUIZ_TTL_MS = 30 * 60 * 1000;

function _purgeExpiredQuizzes() {
  const now = Date.now();
  for (const [id, entry] of _quizCache) {
    if (entry.expiresAt < now) _quizCache.delete(id);
  }
}

function _newQuizId() {
  return new mongoose.Types.ObjectId().toString();
}

// GET /api/v1/exam-study/vocabulary?examId=&level=&topic=&limit=&skip=
router.get(
  '/vocabulary',
  asyncHandler(async (req, res) => {
    const { examId, level, topic } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = parseInt(req.query.skip, 10) || 0;

    if (!examId) {
      return res.status(400).json({ success: false, error: 'examId is required' });
    }
    if (!mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ success: false, error: 'Invalid examId' });
    }

    const filter = { examIds: examId };
    if (level) filter.level = level;
    if (topic) filter.topic = topic;

    const [words, total] = await Promise.all([
      ExamVocabularyWord.find(filter)
        .sort({ word: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ExamVocabularyWord.countDocuments(filter),
    ]);

    res.json({ success: true, data: { words, total, limit, skip } });
  }),
);

// GET /api/v1/exam-study/vocabulary/levels?examId=
// Returns only levels that have ≥1 word — keeps empty tiles off the picker.
router.get(
  '/vocabulary/levels',
  asyncHandler(async (req, res) => {
    const { examId } = req.query;
    if (!examId || !mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ success: false, error: 'examId is required' });
    }
    const levels = await ExamVocabularyWord.distinct('level', { examIds: examId });
    const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    levels.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    res.json({ success: true, data: levels });
  }),
);

// GET /api/v1/exam-study/vocabulary/topics?examId=&level=
router.get(
  '/vocabulary/topics',
  asyncHandler(async (req, res) => {
    const { examId, level } = req.query;
    if (!examId || !mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ success: false, error: 'examId is required' });
    }
    const filter = { examIds: examId };
    if (level) filter.level = level;
    const topics = (await ExamVocabularyWord.distinct('topic', filter))
      .filter(Boolean)
      .sort();
    res.json({ success: true, data: topics });
  }),
);

// POST /api/v1/exam-study/vocabulary/quiz/start
// body: { examId, level, topic?, size=10 }
router.post(
  '/vocabulary/quiz/start',
  asyncHandler(async (req, res) => {
    const { examId, level, topic } = req.body || {};
    const size = Math.min(Math.max(parseInt(req.body?.size, 10) || 10, 5), 20);
    if (!examId || !mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ success: false, error: 'examId is required' });
    }
    if (!level) {
      return res.status(400).json({ success: false, error: 'level is required' });
    }

    const filter = { examIds: examId, level };
    if (topic) filter.topic = topic;

    const pool = await ExamVocabularyWord.find(filter).lean();
    if (pool.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'NOT_ENOUGH_WORDS',
        message: 'Not enough words at this level/topic to build a quiz.',
      });
    }

    // Pull distractor pool from the same level (any topic) so we always have
    // enough non-target options even on tiny topics.
    const distractorPool = await ExamVocabularyWord.find({
      examIds: examId,
      level,
      _id: { $nin: pool.map(p => p._id) },
    }).select('definition').lean();

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, Math.min(size, pool.length));

    const questions = chosen.map(word => {
      // Build 3 distractor definitions; fall back to other-in-pool definitions
      // if the same-level pool is thin.
      const others = [
        ...distractorPool,
        ...pool.filter(p => String(p._id) !== String(word._id)),
      ];
      const distractors = [...others]
        .sort(() => Math.random() - 0.5)
        .map(p => p.definition)
        .filter((d, i, arr) => arr.indexOf(d) === i && d !== word.definition)
        .slice(0, 3);

      const allOptions = [word.definition, ...distractors];
      const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);
      const correctIndex = shuffledOptions.indexOf(word.definition);

      return {
        id: String(word._id),
        prompt: `What does "${word.word}" mean?`,
        options: shuffledOptions,
        // Note: correctChoice + explanation kept server-side only.
        _correctChoice: correctIndex,
        _word: word.word,
        _example: word.exampleSentence,
      };
    });

    const quizId = _newQuizId();
    _quizCache.set(quizId, {
      examId,
      userId: String(req.user._id),
      items: questions.map(q => ({
        wordId: q.id,
        correctChoice: q._correctChoice,
        word: q._word,
        example: q._example,
      })),
      expiresAt: Date.now() + QUIZ_TTL_MS,
    });
    _purgeExpiredQuizzes();

    const clientQuestions = questions.map(({ _correctChoice, _word, _example, ...rest }) => rest);
    res.json({ success: true, data: { quizId, questions: clientQuestions } });
  }),
);

// POST /api/v1/exam-study/vocabulary/quiz/:quizId/submit
// body: { answers: [{ questionId, choice }] }
router.post(
  '/vocabulary/quiz/:quizId/submit',
  asyncHandler(async (req, res) => {
    const { quizId } = req.params;
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];

    _purgeExpiredQuizzes();
    const entry = _quizCache.get(quizId);
    if (!entry) {
      return res.status(410).json({
        success: false,
        error: 'QUIZ_EXPIRED',
        message: 'This quiz has expired. Please start a new one.',
      });
    }

    const lookup = new Map(entry.items.map(it => [it.wordId, it]));
    let correctCount = 0;
    const results = answers.map(a => {
      const item = lookup.get(String(a.questionId));
      if (!item) {
        return { questionId: a.questionId, isCorrect: false, correctChoice: null };
      }
      const isCorrect = Number(a.choice) === Number(item.correctChoice);
      if (isCorrect) correctCount += 1;
      return {
        questionId: a.questionId,
        isCorrect,
        correctChoice: item.correctChoice,
        word: item.word,
        example: item.example,
      };
    });

    const total = entry.items.length;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    // One-shot: invalidate so the same quiz can't be re-submitted.
    _quizCache.delete(quizId);

    // Bump vocabulary section progress so the dashboard shows movement.
    // Best-effort: failures here must not block the response.
    try {
      if (entry.userId && entry.examId) {
        await _bumpVocabProgress(entry.userId, entry.examId, correctCount, total);
      }
    } catch (e) {
      // ignore — progress is a nicety, not a correctness signal
    }

    res.json({
      success: true,
      data: { score, correctCount, total, results },
    });
  }),
);

async function _bumpVocabProgress(userId, examId, correctCount, total) {
  if (!mongoose.isValidObjectId(examId)) return;
  const progress = await UserExamProgress.findOne({ userId, examId });
  const fresh = progress || new UserExamProgress({ userId, examId, sectionScores: {} });
  const existing = fresh.sectionScores.get('vocabulary') || { attempted: 0, correct: 0 };
  fresh.sectionScores.set('vocabulary', {
    attempted: (existing.attempted || 0) + total,
    correct: (existing.correct || 0) + correctCount,
  });
  fresh.lastActivityAt = new Date();
  await fresh.save();
}

// GET /api/v1/exam-study/vocabulary/:wordId/audio
// Lazily generates + caches a TTS clip; mutates the word's audioUrl on first hit.
router.get(
  '/vocabulary/:wordId/audio',
  asyncHandler(async (req, res) => {
    const { wordId } = req.params;
    if (!mongoose.isValidObjectId(wordId)) {
      return res.status(400).json({ success: false, error: 'Invalid wordId' });
    }
    const word = await ExamVocabularyWord.findById(wordId).populate('languageId', 'code name');
    if (!word) {
      return res.status(404).json({ success: false, error: 'Word not found' });
    }

    if (word.audioUrl) {
      return res.json({ success: true, data: { audioUrl: word.audioUrl, cached: true } });
    }

    try {
      const langCode = word.languageId && word.languageId.code ? word.languageId.code : 'en';
      const ttsLang = langCode === 'ko' ? 'korean'
                     : langCode === 'es' ? 'spanish'
                     : 'english';
      const result = await generateTTS({
        text: word.word,
        language: ttsLang,
        sourceType: 'exam-vocab',
        userId: req.user && req.user._id,
      });
      word.audioUrl = result.audioUrl;
      await word.save();
      res.json({ success: true, data: { audioUrl: result.audioUrl, cached: false } });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: 'TTS_FAILED',
        message: err.message || 'Failed to generate pronunciation audio',
      });
    }
  }),
);

module.exports = router;
