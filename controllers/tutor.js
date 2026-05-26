const asyncHandler   = require('../middleware/async');
const ErrorResponse  = require('../utils/errorResponse');
const TutorMemory    = require('../models/TutorMemory');
const AITutorSession = require('../models/AITutorSession');
const User           = require('../models/User');
const Vocabulary = require('../models/Vocabulary');
const tutorService   = require('../services/tutorService');
const scenarios      = require('../services/tutorScenarios');
const tutorStoryService = require('../services/tutorStoryService');
const tutorImageVocabService = require('../services/tutorImageVocabService');
const speechService  = require('../services/speechService');
const aiProvider     = require('../services/aiProviderService');
const { score: scorePronunciation } = require('../services/pronunciationScoring');

const VALID_PERSONAS = ['nana', 'sensei', 'riko'];

/**
 * Ensure a TutorMemory exists for the user; lazy-create with profile defaults
 * pulled from User. Returns the memory doc.
 *
 * Level source: User.languageLevel (user-picked CEFR), not learningStats /
 * LearningProgress (gamification-derived). For existing memories, the cached
 * proficiencyLevel is auto-healed on every call so a profile edit takes
 * effect on the next tutor turn without a backfill.
 */
const ensureMemory = async (userId) => {
  const user = await User.findById(userId)
    .select('name native_language language_to_learn languageLevel')
    .lean();
  const desiredLevel = user?.languageLevel || 'A1';

  let mem = await TutorMemory.findOne({ user: userId });
  if (mem) {
    if (mem.proficiencyLevel !== desiredLevel) {
      mem.proficiencyLevel = desiredLevel;
      await mem.save();
    }
    return mem;
  }

  // `language_to_learn` is singular on the User schema; normalize into an array.
  const targets = user?.language_to_learn
    ? (Array.isArray(user.language_to_learn) ? user.language_to_learn : [user.language_to_learn])
    : [];

  mem = await TutorMemory.create({
    user: userId,
    proficiencyLevel: desiredLevel,
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
  // req.user is the full Mongoose User doc populated by protect middleware
  // (verified: middleware/auth.js#protect does findById without .lean()).
  // Loud failure if the method is missing — prevents silent null in prod.
  if (!req.user.getQuotasSnapshot) {
    throw new Error('getQuotasSnapshot missing from req.user — protect middleware may be using .lean()');
  }
  const quotas = req.user.getQuotasSnapshot();
  res.status(200).json({ success: true, data: mem, quotas });
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

  // Step 18: when the AI teaches a word, auto-queue it into the SRS vocabulary.
  // We set payload.queued so the Flutter VocabCard starts in "Added ✓" state.
  if (parsed.messageType === 'vocab_card' && parsed.payload?.word) {
    const word = String(parsed.payload.word).trim();
    if (word) {
      const targetLang = parsed.payload.language || req.user?.language_to_learn || 'en';
      const nativeLang = req.user?.native_language || 'en';
      const example = parsed.payload.example
        ? String(parsed.payload.example).slice(0, 500)
        : undefined;
      const now = new Date();
      try {
        await Vocabulary.findOneAndUpdate(
          { user: req.user._id, word },
          {
            $setOnInsert: {
              user: req.user._id,
              word,
              translation: String(parsed.payload.definition || '').slice(0, 500),
              language: targetLang,
              nativeLanguage: nativeLang,
              partOfSpeech: 'other',
              context: { source: 'conversation', ...(example ? { example } : {}) },
              srsLevel: 0,
              easeFactor: 2.5,
              interval: 0,
              nextReview: now,
              isArchived: false,
              isMastered: false,
            },
          },
          { upsert: true, new: false }
        );
        parsed.payload.queued = true;
      } catch (err) {
        console.error('[tutor.sendMessage] vocab_card → Vocabulary failed:', err.message);
      }
    }
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

  res.status(200).json({
    success: true,
    data: { message: aiMsg, sessionId: session._id },
    quotas: req.tutorQuotaResult?.snapshot || null,
  });
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
 * @route   POST /api/v1/tutor/image-vocab/describe
 * @desc    Step 1 of the describe-a-photo loop. Multipart 'image'.
 *          Returns a target-language prompt + suggested vocab visible
 *          in the scene.
 * @access  Private
 */
exports.imageVocabDescribe = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new ErrorResponse('Image is required', 400));
  try {
    const result = await tutorImageVocabService.describePhoto({
      userId: req.user._id,
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });
    res.status(200).json({
      success: true,
      data: result,
      quotas: req.tutorQuotaResult?.snapshot || null,
    });
  } catch (e) {
    console.error('[tutor.imageVocabDescribe] failed:', e.message);
    // 502, not 500: middleware/error.js masks 500 to "An unexpected
    // error occurred" in production, which hides the real OpenAI /
    // vision-model failure the operator needs to debug. 502 surfaces
    // e.message intact — matching the pronunciation endpoints below.
    return next(new ErrorResponse(e.message || 'Could not describe image', 502));
  }
});

/**
 * @route   POST /api/v1/tutor/image-vocab/grade
 * @desc    Step 2. Multipart 'image' + form field 'description'.
 *          Returns score + feedback + grammar notes + missing items.
 * @access  Private
 */
exports.imageVocabGrade = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new ErrorResponse('Image is required', 400));
  const description = (req.body?.description || '').toString().trim();
  if (!description) return next(new ErrorResponse('Description is required', 400));

  try {
    const result = await tutorImageVocabService.gradeDescription({
      userId: req.user._id,
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      description,
    });
    res.status(200).json({ success: true, data: result });
  } catch (e) {
    console.error('[tutor.imageVocabGrade] failed:', e.message);
    // 502 not 500 — see imageVocabDescribe above for rationale.
    return next(new ErrorResponse(e.message || 'Could not grade description', 502));
  }
});

/**
 * @route   POST /api/v1/tutor/stories/generate
 * @desc    Generate a short story at the user's level using N words from
 *          their vocab list. Stateless — not persisted.
 * @body    { wordCount?: number (3-15), theme?: string }
 * @access  Private
 */
exports.generateStory = asyncHandler(async (req, res, next) => {
  const wordCount = Math.max(3, Math.min(15, Number(req.body?.wordCount) || 5));
  const theme = tutorStoryService.VALID_THEMES.includes(req.body?.theme)
    ? req.body.theme
    : 'free';

  try {
    const story = await tutorStoryService.generateStory({
      userId: req.user._id,
      wordCount,
      theme,
    });
    res.status(200).json({
      success: true,
      data: story,
      quotas: req.tutorQuotaResult?.snapshot || null,
    });
  } catch (e) {
    console.error('[tutor.generateStory] failed:', e.message);
    return next(new ErrorResponse(e.message || 'Could not generate a story', 500));
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

  res.status(201).json({
    success: true,
    data: session,
    quotas: req.tutorQuotaResult?.snapshot || null,
  });
});

/**
 * @route   POST /api/v1/tutor/pronunciation/sentence
 * @desc    Generate (or accept custom) a target-language sentence sized
 *          to the user's proficiencyLevel, plus a TTS audio URL.
 * @body    { custom?: string, preferWeakWords?: boolean (default true) }
 * @access  Private
 */
exports.generatePronunciationSentence = asyncHandler(async (req, res, next) => {
  const { custom, preferWeakWords = true } = req.body || {};
  const mem = await ensureMemory(req.user._id);

  const level = mem.proficiencyLevel || 'A1';
  const targetLanguage = (mem.targetLanguages || [])[0] || 'en';

  let sentence;
  if (typeof custom === 'string' && custom.trim().length > 0) {
    sentence = custom.trim().slice(0, 300);
  } else {
    const weakWords = preferWeakWords && Array.isArray(mem.weakAreas)
      ? mem.weakAreas
          .filter(w => w.topic && w.topic.startsWith('pronunciation:'))
          .slice(0, 3)
          .map(w => w.topic.replace(/^pronunciation:/, ''))
      : [];

    const hint = weakWords.length > 0
      ? ` If natural, weave in one of these tricky words: ${weakWords.join(', ')}.`
      : '';

    const systemPrompt = `You are a sentence generator for pronunciation practice. Output a single sentence only — no quotes, no commentary, no leading "Sentence:" label.`;
    const userPrompt = `Generate ONE short ${level}-level sentence in ${targetLanguage} for pronunciation practice. Keep it 5-12 words. Prefer spelled-out numbers over digits.${hint}`;

    let response;
    try {
      response = await aiProvider.chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        feature: 'conversation',
        maxTokens: 60,
        temperature: 0.8,
      });
    } catch (e) {
      console.error('[tutor.generatePronunciationSentence] GPT failed:', e.message);
      return next(new ErrorResponse('Could not generate a sentence right now', 502));
    }

    sentence = (response?.content || '').trim().replace(/^["']|["']$/g, '');
    if (!sentence) {
      return next(new ErrorResponse('Empty sentence returned', 502));
    }
  }

  let ttsAudioUrl;
  try {
    const tts = await speechService.generateTTS({
      text: sentence,
      language: targetLanguage,
      format: 'mp3',
      sourceType: 'pronunciation',
      userId: req.user._id,
    });
    ttsAudioUrl = tts.audioUrl;
  } catch (e) {
    console.error('[tutor.generatePronunciationSentence] TTS failed:', e.message);
    return next(new ErrorResponse('Could not generate audio for sentence', 502));
  }

  res.status(200).json({
    success: true,
    data: { sentence, level, targetLanguage, ttsAudioUrl },
  });
});

/**
 * @route   POST /api/v1/tutor/pronunciation/score
 * @desc    Score a recorded attempt against the target sentence.
 * @body    multipart: audio (file) + targetSentence (string)
 * @access  Private
 */
exports.scorePronunciationAttempt = asyncHandler(async (req, res, next) => {
  const file = req.file;
  const { targetSentence } = req.body || {};
  if (!file) return next(new ErrorResponse('audio file is required', 400));
  if (!targetSentence || typeof targetSentence !== 'string') {
    return next(new ErrorResponse('targetSentence is required', 400));
  }

  let transcribed;
  try {
    transcribed = await speechService.transcribeAudio({
      audioBuffer: file.buffer,
      userId: req.user._id,
    });
  } catch (e) {
    console.error('[tutor.scorePronunciationAttempt] Whisper failed:', e.message);
    return next(new ErrorResponse('Transcription failed', 502));
  }
  const transcript = (transcribed && transcribed.text) || '';

  const result = scorePronunciation(transcript, targetSentence);
  res.status(200).json({ success: true, data: result });
});

/**
 * @route   POST /api/v1/tutor/pronunciation/summary
 * @desc    Upsert session weak words into TutorMemory.weakAreas with the
 *          'pronunciation:<word>' topic prefix. Capped at 5 words per call.
 * @body    { weakWords: string[] }
 * @access  Private
 */
exports.submitPronunciationSummary = asyncHandler(async (req, res, next) => {
  const raw = Array.isArray(req.body?.weakWords) ? req.body.weakWords : [];
  const weakWords = raw
    .filter(w => typeof w === 'string' && w.trim().length > 0)
    .slice(0, 5)
    .map(w => w.trim().toLowerCase());

  const mem = await ensureMemory(req.user._id);

  const now = new Date();
  const updated = [];
  for (const word of weakWords) {
    const topic = `pronunciation:${word}`;
    const existing = mem.weakAreas.find(w => w.topic === topic);
    if (existing) {
      existing.frequency = (existing.frequency || 1) + 1;
      existing.lastSeen = now;
    } else {
      mem.weakAreas.push({ topic, frequency: 1, lastSeen: now });
    }
    updated.push(topic);
  }

  // Tick the daily-plan pronunciation task if it exists. Pre-existing
  // plans (generated before tutor_pronunciation was added) won't have
  // the task — silently skip; the next regenerate will include it.
  let dailyPlanTicked = false;
  if (mem.dailyPlan && Array.isArray(mem.dailyPlan.tasks)) {
    const task = mem.dailyPlan.tasks.find(t => t.type === 'tutor_pronunciation');
    if (task) {
      task.completed = Number(task.completed || 0) + 1;
      mem.markModified('dailyPlan');
      dailyPlanTicked = true;
    }
  }

  await mem.save();

  // Step 17 — bridge into the SRS queue. Pronunciation weak words are
  // the canonical 'I'm bad at this' signal; routing them into Vocabulary
  // so they enter the existing spaced-repetition flow on the next
  // /learning/vocabulary/review fetch. Existing entries are no-op'd via
  // $setOnInsert (re-running this on a repeat word does NOT reset SRS
  // progress).
  const targetLang = req.user?.language_to_learn || mem?.targetLanguages?.[0] || 'en';
  const nativeLang = mem?.nativeLanguage || req.user?.native_language || 'en';
  await Promise.all(weakWords.map(word =>
    Vocabulary.findOneAndUpdate(
      { user: req.user._id, word },
      {
        $setOnInsert: {
          user: req.user._id,
          word,
          translation: '', // user fills in during review or via vocab dashboard
          language: targetLang,
          nativeLanguage: nativeLang,
          partOfSpeech: 'other',
          context: { source: 'conversation' }, // closest existing enum value
          srsLevel: 0,
          easeFactor: 2.5,
          interval: 0,
          nextReview: now,
          isArchived: false,
          isMastered: false,
        },
      },
      { upsert: true, new: false }
    ).catch(err => {
      console.error(`[pronounce-bridge] vocab upsert failed for "${word}":`, err.message);
      return null;
    })
  ));

  res.status(200).json({
    success: true,
    data: { weakAreasUpdated: updated, dailyPlanTicked },
    quotas: req.tutorQuotaResult?.snapshot || null,
  });
});
