/**
 * Exam essay evaluation service.
 *
 * Wraps aiProviderService.chatCompletion with an IELTS-style scoring
 * rubric. Returns `{score, feedback, strengths, improvements}`.
 *
 * When `OPENAI_API_KEY` is missing (dev/CI environments) we return a
 * deterministic stub eval so the UX is exercised end-to-end without
 * paid API access. Production *must* set the key.
 */

const aiProviderService = require('./aiProviderService');

const MIN_CHARS = 50;
const MAX_CHARS = 5000;

/**
 * @param {Object} opts
 * @param {String} opts.essay        The user's answer text.
 * @param {String} [opts.rubric]     Rubric criteria comma-separated.
 * @param {Number} [opts.targetBand] Target band score (default 6).
 * @returns {Promise<{score:Number, feedback:String, strengths:String[], improvements:String[]}>}
 */
async function evaluateEssay({
  essay,
  rubric = 'grammar, vocabulary, coherence, task response',
  targetBand = 6,
}) {
  if (!essay || essay.trim().length < MIN_CHARS) {
    throw new Error(`Essay must be at least ${MIN_CHARS} characters`);
  }
  if (essay.length > MAX_CHARS) {
    throw new Error(`Essay must not exceed ${MAX_CHARS} characters`);
  }

  // No key configured? Fall back to a deterministic stub so the polling
  // UX is exercisable without burning OpenAI tokens.
  if (!process.env.OPENAI_API_KEY) {
    return _stubEvaluation(essay);
  }

  const prompt = `You are an IELTS examiner. Evaluate the following essay against these criteria: ${rubric}.

Essay:
${essay}

Target Band: ${targetBand}

Respond ONLY with JSON in this exact shape:
{
  "score": <integer 0-100>,
  "feedback": "<2-4 sentences of overall feedback>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"]
}`;

  const response = await aiProviderService.chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    feature: 'examEssayEvaluation',
    temperature: 0.4,
    json: true,
  });

  let parsed;
  try {
    parsed = JSON.parse(response.content);
  } catch (_) {
    // OpenAI occasionally wraps JSON in code fences when json mode is
    // off; we asked for json_object so this is rare, but be defensive.
    throw new Error('AI returned malformed evaluation');
  }

  return {
    score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
    feedback: String(parsed.feedback || ''),
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.map(String)
      : [],
    improvements: Array.isArray(parsed.improvements)
      ? parsed.improvements.map(String)
      : [],
  };
}

/**
 * Cheap deterministic evaluation used when OPENAI_API_KEY is unset.
 * Scores by length + sentence count so the result varies with input.
 */
function _stubEvaluation(essay) {
  const words = essay.trim().split(/\s+/).length;
  const sentences = essay.split(/[.!?]+/).filter(Boolean).length;
  const score = Math.min(
    95,
    Math.max(45, Math.round((words / 5) + (sentences * 4))),
  );
  return {
    score,
    feedback:
      'This is a placeholder evaluation. Configure OPENAI_API_KEY on the server to enable real AI scoring.',
    strengths: [
      'Essay submitted within the allowed length.',
      `Contains ${words} words across ${sentences || 1} sentences.`,
    ],
    improvements: [
      'Real AI feedback will appear here once the API key is configured.',
    ],
  };
}

/**
 * @param {Object} opts
 * @param {String} opts.transcript   Whisper-STT output of the user's spoken answer.
 * @param {String} [opts.rubric]     Rubric criteria comma-separated.
 * @param {Number} [opts.targetBand] Target band score (default 6).
 * @returns {Promise<{score:Number, feedback:String, strengths:String[], improvements:String[]}>}
 */
async function evaluateSpeaking({
  transcript,
  rubric = 'fluency and coherence, vocabulary range, grammar accuracy, task response',
  targetBand = 6,
}) {
  if (!transcript || transcript.trim().length < 5) {
    throw new Error('Transcript is too short to evaluate');
  }

  // No key configured? Deterministic stub so the polling UX works
  // without burning OpenAI tokens.
  if (!process.env.OPENAI_API_KEY) {
    return _stubSpeakingEvaluation(transcript);
  }

  const prompt = `You are an IELTS speaking examiner. Evaluate the following transcribed spoken response against these criteria: ${rubric}.

Note: The text is a Whisper STT transcript of a spoken answer, so allow for filler words ("um", "uh") and minor disfluency typical of speech.

Transcript:
${transcript}

Target Band: ${targetBand}

Respond ONLY with JSON in this exact shape:
{
  "score": <integer 0-100>,
  "feedback": "<2-4 sentences of overall feedback>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"]
}`;

  const response = await aiProviderService.chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    feature: 'examSpeakingEvaluation',
    temperature: 0.4,
    json: true,
  });

  let parsed;
  try {
    parsed = JSON.parse(response.content);
  } catch (_) {
    throw new Error('AI returned malformed speaking evaluation');
  }

  return {
    score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
    feedback: String(parsed.feedback || ''),
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.map(String)
      : [],
    improvements: Array.isArray(parsed.improvements)
      ? parsed.improvements.map(String)
      : [],
  };
}

/**
 * Deterministic placeholder used when OPENAI_API_KEY is unset.
 * Scores by transcript length + word count so the result varies.
 */
function _stubSpeakingEvaluation(transcript) {
  const words = transcript.trim().split(/\s+/).length;
  const score = Math.min(95, Math.max(40, Math.round(50 + words / 4)));
  return {
    score,
    feedback:
      'This is a placeholder speaking evaluation. Configure OPENAI_API_KEY on the server to enable real AI scoring.',
    strengths: [
      `Spoke for ${words} words — adequate length for a Part 1-style answer.`,
      'Transcript captured cleanly by speech-to-text.',
    ],
    improvements: [
      'Real AI feedback on fluency, vocabulary, and grammar will appear here once the API key is configured.',
    ],
  };
}

module.exports = {
  evaluateEssay,
  evaluateSpeaking,
  MIN_CHARS,
  MAX_CHARS,
};
