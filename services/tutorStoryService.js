/**
 * Tutor story generator.
 *
 * Generates a short story at the user's level, weaving in N words from
 * their vocabulary list, then attaches one comprehension question per
 * paragraph. Stateless — no persistence; the client holds the story
 * for the session.
 */

const TutorMemory = require('../models/TutorMemory');
const Vocabulary  = require('../models/Vocabulary');
const aiProvider  = require('./aiProviderService');

const VALID_THEMES = ['adventure', 'mystery', 'romance', 'sci_fi', 'slice_of_life', 'free'];

const STORY_RESPONSE_SCHEMA = `
Output JSON with this exact shape:
{
  "title":      "<short title, ≤6 words>",
  "paragraphs": [
    {
      "text":     "<single paragraph, 40-80 words at the user's level>",
      "question": {
        "q":          "<comprehension question about THIS paragraph>",
        "options":    ["<3 options>", "<...>", "<...>"],
        "correctIdx": 0..2
      }
    }
    // Exactly 4 paragraphs total.
  ],
  "vocabUsed": [
    { "word": "<word from the user's vocab list>", "definition": "<short def>" }
  ]
}

No code fences. No commentary. JSON only.
`;

/**
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {number} opts.wordCount   Number of vocab words to weave in (5/10/15)
 * @param {string} opts.theme       One of VALID_THEMES or 'free'
 * @returns {Promise<Object>} The generated story (no persistence)
 */
const generateStory = async ({ userId, wordCount = 5, theme = 'free' }) => {
  const mem = await TutorMemory.findOne({ user: userId }).lean();
  const level = mem?.proficiencyLevel || 'A2';
  const targetLanguage = (mem?.targetLanguages || [])[0] || 'English';
  const nativeLanguage = mem?.nativeLanguage || 'English';

  // Pull the user's "learning" vocab as candidates. If they have none, fall
  // back to letting the AI pick contextually-appropriate words for the level.
  const focusWords = await Vocabulary.find({ user: userId })
    .sort({ updatedAt: -1 })
    .limit(40)
    .select('word definition language')
    .lean();

  const chosen = focusWords
    .slice(0, Math.max(3, Math.min(15, wordCount)));

  const wordsBlock = chosen.length
    ? chosen.map(w => `- ${w.word}${w.definition ? ` (${w.definition})` : ''}`).join('\n')
    : '(user has no vocab yet — pick 5 useful words for their level)';

  const themeBlock = theme === 'free'
    ? 'free choice of theme — pick whatever fits the words'
    : theme.replace(/_/g, ' ');

  const systemPrompt = [
    `You are a graded-reader generator for language learners.`,
    `Target language: ${targetLanguage}`,
    `Native language (for definitions): ${nativeLanguage}`,
    `User's CEFR level: ${level}`,
    `Theme: ${themeBlock}`,
    ``,
    `Required vocab to weave naturally into the story:`,
    wordsBlock,
    ``,
    `Constraints:`,
    `- Write in the TARGET language (not the native one).`,
    `- 4 short paragraphs, 40-80 words each, age-appropriate, fully self-contained.`,
    `- Use each listed word at least once across the story (in any paragraph).`,
    `- One multiple-choice comprehension question per paragraph (3 options).`,
    `- Story should make sense as a whole; later paragraphs build on earlier ones.`,
    `- Definitions in vocabUsed are written in the NATIVE language for clarity.`,
    ``,
    STORY_RESPONSE_SCHEMA,
  ].join('\n');

  const result = await aiProvider.chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the story now.' },
    ],
    feature: 'conversation',
    json: true,
    maxTokens: 1400,
    temperature: 0.85,
  });

  let parsed;
  try {
    parsed = JSON.parse(result?.content || '{}');
  } catch (e) {
    console.error('[tutor.story] JSON parse failed:', e.message);
    throw new Error('Could not generate a story right now — try again.');
  }

  // Defensive sanitization so a malformed AI response never crashes the client.
  const paragraphs = Array.isArray(parsed.paragraphs) ? parsed.paragraphs.slice(0, 6) : [];
  const safe = paragraphs
    .filter(p => p && typeof p.text === 'string' && p.text.trim().length > 0)
    .map(p => {
      const q = p.question || {};
      const opts = Array.isArray(q.options) ? q.options.slice(0, 4) : [];
      return {
        text: p.text.toString().trim(),
        question: opts.length >= 2
          ? {
              q: (q.q || '').toString(),
              options: opts.map(o => o?.toString() || ''),
              correctIdx: Math.max(0, Math.min(opts.length - 1, Number(q.correctIdx) || 0)),
            }
          : null,
      };
    });

  return {
    title: (parsed.title || 'Untitled').toString().slice(0, 80),
    theme,
    level,
    targetLanguage,
    paragraphs: safe,
    vocabUsed: Array.isArray(parsed.vocabUsed)
      ? parsed.vocabUsed
          .filter(v => v && typeof v.word === 'string')
          .slice(0, 20)
          .map(v => ({
            word: v.word.toString(),
            definition: (v.definition || '').toString(),
          }))
      : [],
  };
};

module.exports = { generateStory, VALID_THEMES };
