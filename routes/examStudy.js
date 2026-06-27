const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/async');
const ExamLanguage = require('../models/ExamLanguage');
const ExamType = require('../models/ExamType');
const ExamSection = require('../models/ExamSection');
const ExamQuestion = require('../models/ExamQuestion');
const UserExamProgress = require('../models/UserExamProgress');
const UserStudyPlan = require('../models/UserStudyPlan');
const EvaluationJob = require('../models/EvaluationJob');
const examEvaluationService = require('../services/examEvaluationService');
const examStudyPlanService = require('../services/examStudyPlanService');

// All exam-study endpoints require auth — practice + progress are user-scoped.
router.use(protect);

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

    // Speaking-prompt — still not wired (no Whisper integration yet).
    if (question.questionType === 'speaking-prompt') {
      return res.status(501).json({
        success: false,
        code: 'NOT_IMPLEMENTED',
        message:
          'Speaking evaluation is not yet available. Please check back soon.',
      });
    }

    return res.status(400).json({
      success: false,
      code: 'INVALID_QUESTION_TYPE',
      message: 'Unknown question type',
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

module.exports = router;
