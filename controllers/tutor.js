const asyncHandler   = require('../middleware/async');
const ErrorResponse  = require('../utils/errorResponse');
const TutorMemory    = require('../models/TutorMemory');
const AITutorSession = require('../models/AITutorSession');
const User           = require('../models/User');
const LearningProgress = require('../models/LearningProgress');
const tutorService   = require('../services/tutorService');
const scenarios      = require('../services/tutorScenarios');
const speechService  = require('../services/speechService');

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

/**
 * @route   POST /api/v1/tutor/sessions
 * @desc    Start a new chat session; AI generates an opening greeting
 *          flavored by the user's persona and last-chat summary.
 * @access  Private
 */
exports.startSession = asyncHandler(async (req, res, next) => {
  const mem = await ensureMemory(req.user._id);
  if (!mem.persona) {
    return next(new ErrorResponse('Pick a persona first', 400));
  }

  const user = await User.findById(req.user._id).select('name').lean();
  const session = await AITutorSession.create({
    user:    req.user._id,
    persona: mem.persona,
    messages: [],
  });

  // Generate opening greeting through the same prompt path as regular turns.
  // The "internal" instruction tells the model not to drop a card on turn 1.
  const systemPrompt = tutorService.buildSystemPrompt(mem, user || { name: 'Friend' });
  const openingHistory = [{
    role: 'user',
    content: '(internal) Greet the user briefly. Optionally reference our last chat. Suggest something to work on today. Do not output a card on the first turn.',
    messageType: 'text',
  }];

  let rawReply;
  try {
    rawReply = await tutorService.callTutorModel(systemPrompt, openingHistory);
  } catch (e) {
    console.error('[tutor.startSession] AI call failed:', e.message);
    rawReply = JSON.stringify({ type: 'text', content: "Hey there — what would you like to work on today?" });
  }
  const parsed = tutorService.parseTutorReply(rawReply);

  session.messages.push({
    role:        'assistant',
    content:     parsed.content,
    messageType: parsed.messageType,
    payload:     parsed.payload,
  });
  await session.save();

  res.status(201).json({ success: true, data: session });
});

/**
 * @route   POST /api/v1/tutor/sessions/:id/message
 * @desc    User sends a message; AI replies (may be a card).
 * @body    { content: string }
 * @access  Private (owner only)
 */
exports.sendMessage = asyncHandler(async (req, res, next) => {
  const { content } = req.body || {};
  if (!content || typeof content !== 'string' || !content.trim()) {
    return next(new ErrorResponse('Message content is required', 400));
  }

  const session = await AITutorSession.findById(req.params.id);
  if (!session) return next(new ErrorResponse('Session not found', 404));
  if (session.user.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }
  if (session.endedAt) {
    return next(new ErrorResponse('Session has ended; start a new one', 409));
  }

  // Persist the user message FIRST so we never lose input on an AI failure.
  session.messages.push({ role: 'user', content: content.trim(), messageType: 'text' });
  await session.save();

  const mem = await ensureMemory(req.user._id);
  const user = await User.findById(req.user._id).select('name').lean();
  const scenario = session.mode === 'roleplay' && session.scenarioId
    ? scenarios.findById(session.scenarioId)
    : null;
  const systemPrompt = tutorService.buildSystemPrompt(mem, user || { name: 'Friend' }, { scenario });

  let parsed;
  try {
    const rawReply = await tutorService.callTutorModel(systemPrompt, session.messages);
    parsed = tutorService.parseTutorReply(rawReply);
    // In roleplay mode, force text-only — we don't want quiz cards
    // breaking character.
    if (scenario && parsed.messageType !== 'text') {
      parsed = { messageType: 'text', content: parsed.content || '', payload: null };
    }
  } catch (e) {
    console.error('[tutor.sendMessage] AI call failed:', e.message);
    parsed = { messageType: 'text', content: "I'm having a moment — try again in a sec?", payload: null };
  }

  const aiMsg = {
    role:        'assistant',
    content:     parsed.content,
    messageType: parsed.messageType,
    payload:     parsed.payload,
    createdAt:   new Date(),
  };
  session.messages.push(aiMsg);
  await session.save();

  res.status(200).json({ success: true, data: { message: aiMsg, sessionId: session._id } });
});

/**
 * @route   POST /api/v1/tutor/sessions/:id/end
 * @desc    End session, generate ≤30-word summary, push it to TutorMemory.
 *          Idempotent — safe to call from app-background hooks.
 * @access  Private (owner only)
 */
exports.endSession = asyncHandler(async (req, res, next) => {
  const session = await AITutorSession.findById(req.params.id);
  if (!session) return next(new ErrorResponse('Session not found', 404));
  if (session.user.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }
  if (session.endedAt) {
    return res.status(200).json({ success: true, data: session, alreadyEnded: true });
  }

  session.endedAt = new Date();
  const summary = await tutorService.summarizeSession(session);
  if (summary) session.summary = summary;

  // Grade the user if this was a roleplay session.
  if (session.mode === 'roleplay' && session.scenarioId) {
    const scenario = scenarios.findById(session.scenarioId);
    if (scenario) {
      const score = await tutorService.gradeScenario(session, scenario);
      if (score) session.scenarioScore = score;
    }
  }

  await session.save();

  await tutorService.appendSummaryToMemory(req.user._id, session._id, summary);

  // Bump the tutor_chat task by elapsed minutes (rounded up to at least 1).
  try {
    const mem = await TutorMemory.findOne({ user: req.user._id });
    if (mem?.dailyPlan?.tasks) {
      const minutes = Math.max(
        1,
        Math.round((session.endedAt - session.startedAt) / 60000)
      );
      const chatTask = mem.dailyPlan.tasks.find(t => t.type === 'tutor_chat');
      if (chatTask) {
        chatTask.completed = Number(chatTask.completed || 0) + minutes;
        mem.markModified('dailyPlan');
        await mem.save();
      }
    }
  } catch (e) {
    console.error('[tutor.endSession] task bump failed (non-fatal):', e.message);
  }

  res.status(200).json({ success: true, data: session });
});

/**
 * @route   POST /api/v1/tutor/sessions/:id/speak
 * @desc    Generate TTS audio for a specific assistant message in the
 *          session so the client can play it back in voice mode.
 * @body    { messageIndex: number, voice?: string, speed?: number }
 * @access  Private (owner only)
 */
exports.speakMessage = asyncHandler(async (req, res, next) => {
  const session = await AITutorSession.findById(req.params.id);
  if (!session) return next(new ErrorResponse('Session not found', 404));
  if (session.user.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }

  const idx = Number.isFinite(req.body?.messageIndex)
    ? req.body.messageIndex
    : session.messages.length - 1;
  const msg = session.messages[idx];
  if (!msg || msg.role !== 'assistant') {
    return next(new ErrorResponse('No assistant message at that index', 400));
  }

  // For card messages, speak the intro content only; the card body
  // (options, IPA, etc.) isn't worth narrating.
  const text = (msg.content || '').trim();
  if (!text) {
    return next(new ErrorResponse('Message has no spoken content', 400));
  }

  // Pick the first target language from the user's memory as the TTS
  // language hint; falls back to English. The OpenAI TTS model picks
  // a sensible voice for the language internally.
  const mem = await ensureMemory(req.user._id);
  const language = mem.targetLanguages?.[0] || 'en';

  try {
    const result = await speechService.generateTTS({
      text,
      language,
      voice:  req.body?.voice,
      speed:  Number.isFinite(req.body?.speed) ? req.body.speed : 1.0,
      format: 'mp3',
      sourceType: 'tutor',
      userId: req.user._id,
    });
    res.status(200).json({ success: true, data: result });
  } catch (e) {
    console.error('[tutor.speakMessage] TTS failed:', e.message);
    return next(new ErrorResponse('Could not generate audio', 500));
  }
});

/**
 * @route   POST /api/v1/tutor/sessions/:id/transcribe
 * @desc    Transcribe a recorded user voice message. Multipart 'audio'.
 *          Returns the transcription so the client can post it as a
 *          normal user message via /sessions/:id/message.
 * @access  Private (owner only)
 */
exports.transcribeVoice = asyncHandler(async (req, res, next) => {
  const session = await AITutorSession.findById(req.params.id);
  if (!session) return next(new ErrorResponse('Session not found', 404));
  if (session.user.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }
  if (!req.file) {
    return next(new ErrorResponse('Audio file is required', 400));
  }

  const mem = await ensureMemory(req.user._id);
  const language = req.body?.language || mem.targetLanguages?.[0];

  try {
    const result = await speechService.transcribeAudio({
      audioFile: req.file,
      language,
      userId: req.user._id,
    });
    res.status(200).json({ success: true, data: result });
  } catch (e) {
    console.error('[tutor.transcribeVoice] STT failed:', e.message);
    return next(new ErrorResponse('Could not transcribe audio', 500));
  }
});

/**
 * @route   GET /api/v1/tutor/scenarios
 * @desc    List available roleplay scenarios (no auth needed beyond protect)
 */
exports.listScenarios = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: scenarios.list() });
});

/**
 * @route   POST /api/v1/tutor/sessions/roleplay
 * @desc    Start a roleplay session with a specific scenario
 * @body    { scenarioId: string }
 * @access  Private
 */
exports.startRoleplaySession = asyncHandler(async (req, res, next) => {
  const { scenarioId } = req.body || {};
  const scenario = scenarios.findById(scenarioId);
  if (!scenario) {
    return next(new ErrorResponse('Unknown scenario', 400));
  }

  const mem = await ensureMemory(req.user._id);
  if (!mem.persona) {
    return next(new ErrorResponse('Pick a persona first', 400));
  }

  const user = await User.findById(req.user._id).select('name').lean();
  const session = await AITutorSession.create({
    user: req.user._id,
    persona: mem.persona,
    mode: 'roleplay',
    scenarioId: scenario.id,
    messages: [],
  });

  // First turn — AI greets in character, naturally setting the scene.
  const systemPrompt = tutorService.buildSystemPrompt(mem, user || { name: 'Friend' }, { scenario });
  const openingHistory = [{
    role: 'user',
    content: '(internal) Open the scene naturally in character. One short greeting/setup line — no card.',
    messageType: 'text',
  }];

  let rawReply;
  try {
    rawReply = await tutorService.callTutorModel(systemPrompt, openingHistory);
  } catch (e) {
    console.error('[tutor.startRoleplay] AI call failed:', e.message);
    rawReply = JSON.stringify({ type: 'text', content: 'Hello! How can I help you today?' });
  }
  const parsed = tutorService.parseTutorReply(rawReply);

  session.messages.push({
    role: 'assistant',
    content: parsed.content,
    messageType: 'text',
    payload: null,
  });
  await session.save();

  res.status(201).json({ success: true, data: session });
});
