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

module.exports = {
  evaluateEssay,
  MIN_CHARS,
  MAX_CHARS,
};
