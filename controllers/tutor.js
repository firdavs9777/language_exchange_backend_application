const asyncHandler   = require('../middleware/async');
const ErrorResponse  = require('../utils/errorResponse');
const TutorMemory    = require('../models/TutorMemory');
const AITutorSession = require('../models/AITutorSession');
const User           = require('../models/User');
const LearningProgress = require('../models/LearningProgress');
const tutorService   = require('../services/tutorService');

const VALID_PERSONAS = ['nana', 'sensei', 'riko'];

/**
 * Ensure a TutorMemory exists for the user; lazy-create with profile defaults
 * pulled from User + LearningProgress. Returns the memory doc.
 */
const ensureMemory = async (userId) => {
  let mem = await TutorMemory.findOne({ user: userId });
  if (mem) return mem;

  const [user, progress] = await Promise.all([
    User.findById(userId).select('name native_language language_to_learn').lean(),
    LearningProgress.findOne({ user: userId }).select('proficiencyLevel').lean(),
  ]);

  // `language_to_learn` is singular on the User schema; normalize into an array.
  const targets = user?.language_to_learn
    ? (Array.isArray(user.language_to_learn) ? user.language_to_learn : [user.language_to_learn])
    : [];

  mem = await TutorMemory.create({
    user: userId,
    proficiencyLevel: progress?.proficiencyLevel || 'A1',
    targetLanguages:  targets,
    nativeLanguage:   user?.native_language || '',
  });
  return mem;
};

/**
 * @route   GET /api/v1/tutor/me
 * @desc    Returns TutorMemory (lazy-creates with profile defaults)
 * @access  Private
 */
exports.getMyMemory = asyncHandler(async (req, res) => {
  const mem = await ensureMemory(req.user._id);
  res.status(200).json({ success: true, data: mem });
});

/**
 * @route   PUT /api/v1/tutor/persona
 * @desc    Set or change the user's persona
 * @body    { persona: 'nana' | 'sensei' | 'riko' }
 * @access  Private
 */
exports.setPersona = asyncHandler(async (req, res, next) => {
  const { persona } = req.body || {};
  if (!VALID_PERSONAS.includes(persona)) {
    return next(new ErrorResponse(`Invalid persona; must be one of ${VALID_PERSONAS.join(', ')}`, 400));
  }
  const mem = await ensureMemory(req.user._id);
  mem.persona = persona;
  await mem.save();
  res.status(200).json({ success: true, data: mem });
});

/**
 * @route   GET /api/v1/tutor/daily-plan
 * @desc    Returns today's plan; lazy-generates if missing/stale.
 *          Comparison key: UTC midnight date of dailyPlan.date.
 * @access  Private
 */
exports.getDailyPlan = asyncHandler(async (req, res) => {
  const mem = await ensureMemory(req.user._id);
  const todayUTC = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');

  if (!mem.dailyPlan || new Date(mem.dailyPlan.date).getTime() !== todayUTC.getTime()) {
    mem.dailyPlan = await tutorService.generateDailyPlan(req.user._id, mem);
    await mem.save();
  }

  res.status(200).json({ success: true, data: mem.dailyPlan });
});

/**
 * @route   PATCH /api/v1/tutor/daily-plan/task/:type/complete
 * @desc    Mark progress on a daily-plan task.
 *          - srs_review / tutor_chat: increments `completed` by req.body.delta (default 1)
 *          - grammar_drill:           flips `completed` to true
 * @access  Private
 */
exports.completeTask = asyncHandler(async (req, res, next) => {
  const { type } = req.params;
  const delta = Number.isFinite(req.body?.delta) ? req.body.delta : 1;

  const mem = await ensureMemory(req.user._id);
  if (!mem.dailyPlan) {
    return next(new ErrorResponse('No daily plan for today', 404));
  }
  const task = mem.dailyPlan.tasks.find(t => t.type === type);
  if (!task) {
    return next(new ErrorResponse(`No task of type ${type} in today's plan`, 404));
  }

  if (type === 'grammar_drill') {
    task.completed = true;
  } else {
    task.completed = Number(task.completed || 0) + delta;
  }
  mem.markModified('dailyPlan');
  await mem.save();

  res.status(200).json({ success: true, data: mem.dailyPlan });
});

/**
 * @route   GET /api/v1/tutor/sessions
 * @desc    Recent sessions for the requesting user (paginated, default 10)
 * @access  Private
 */
exports.listSessions = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const sessions = await AITutorSession.find({ user: req.user._id })
    .sort({ startedAt: -1 })
    .limit(limit)
    .select('persona startedAt endedAt summary');
  res.status(200).json({ success: true, data: sessions });
});

/**
 * @route   GET /api/v1/tutor/sessions/:id
 * @desc    Single session with full message history (owner-gated)
 * @access  Private
 */
exports.getSession = asyncHandler(async (req, res, next) => {
  const session = await AITutorSession.findById(req.params.id);
  if (!session) return next(new ErrorResponse('Session not found', 404));
  if (session.user.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized to view this session', 403));
  }
  res.status(200).json({ success: true, data: session });
});
