/**
 * Tutor image-vocab service.
 *
 * The user uploads a photo. Two-step flow exposed by separate controller
 * actions:
 *
 *   describePhoto(image)            → returns { prompt, suggestedVocab[] }
 *     The AI looks at the image and produces (a) a target-language
 *     prompt asking the user to describe it, (b) a small vocab list
 *     of items visible in the scene for context.
 *
 *   gradeDescription(image, text)   → returns { score, feedback,
 *                                                grammarNotes, missingItems[] }
 *     Once the user has typed their description, we grade it. Score
 *     0-100 + 2-3 sentences of friendly feedback + per-item misses.
 *
 * Both calls go to gpt-4o (NOT mini — mini doesn't support vision in
 * a chat completion as of 2026-05). Image stays in OpenAI's request
 * scope only; we don't persist anywhere.
 */

const TutorMemory = require('../models/TutorMemory');
const { getOpenAIClient } = require('./aiProviderService');

const VISION_MODEL = 'gpt-4o';

const _bufferToDataUrl = (buffer, mime) =>
  `data:${mime || 'image/jpeg'};base64,${buffer.toString('base64')}`;

const _userContext = async (userId) => {
  const mem = await TutorMemory.findOne({ user: userId }).lean();
  return {
    level: mem?.proficiencyLevel || 'A2',
    targetLanguage: (mem?.targetLanguages || [])[0] || 'English',
    nativeLanguage: mem?.nativeLanguage || 'English',
  };
};

/**
 * Step 1: look at the image, produce a target-language prompt.
 */
const describePhoto = async ({ userId, imageBuffer, mimeType }) => {
  const { level, targetLanguage, nativeLanguage } = await _userContext(userId);
  const openai = getOpenAIClient();

  const systemPrompt =
    `You are a language tutor preparing a describe-the-photo exercise.\n` +
    `User's level: ${level}\n` +
    `Target language: ${targetLanguage}\n` +
    `Native language: ${nativeLanguage}\n\n` +
    `Look at the image. Output JSON only:\n` +
    `{\n` +
    `  "prompt": "<one-sentence question in the TARGET language asking the user to describe the scene at their level>",\n` +
    `  "suggestedVocab": [\n` +
    `    { "word": "<target-language word visible in image>", "definition": "<native-language def>" }\n` +
    `  ]   // 4-6 entries, picked from items clearly visible\n` +
    `}`;

  const response = await openai.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Generate the describe-the-photo prompt for this image.' },
          { type: 'image_url', image_url: { url: _bufferToDataUrl(imageBuffer, mimeType), detail: 'low' } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 500,
    temperature: 0.6,
  });

  const raw = response.choices[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return {
    prompt: (parsed.prompt || 'Describe what you see.').toString(),
    suggestedVocab: Array.isArray(parsed.suggestedVocab)
      ? parsed.suggestedVocab
          .filter(v => v && typeof v.word === 'string')
          .slice(0, 8)
          .map(v => ({
            word: v.word.toString(),
            definition: (v.definition || '').toString(),
          }))
      : [],
  };
};

/**
 * Step 2: grade the user's description against the image.
 */
const gradeDescription = async ({ userId, imageBuffer, mimeType, description }) => {
  const { level, targetLanguage, nativeLanguage } = await _userContext(userId);
  const openai = getOpenAIClient();

  const systemPrompt =
    `You are a friendly language tutor grading a describe-the-photo exercise.\n` +
    `User's level: ${level}\n` +
    `Target language: ${targetLanguage}\n` +
    `Native language: ${nativeLanguage}\n\n` +
    `Compare the user's written description to the image. Score on:\n` +
    `1. Coverage (did they mention the key things in the photo?)\n` +
    `2. Vocabulary range (used at-level words appropriately?)\n` +
    `3. Grammar accuracy\n\n` +
    `Output JSON only:\n` +
    `{\n` +
    `  "score": 0..100,\n` +
    `  "feedback": "<2-3 sentences in NATIVE language, encouraging, mention 1 thing to improve>",\n` +
    `  "grammarNotes": [ { "wrong": "<their phrase>", "correct": "<fix>", "note": "<brief why>" } ],\n` +
    `  "missingItems":  [ "<things in the image the user didn't mention, target-language>" ]\n` +
    `}`;

  const response = await openai.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: `User's description:\n"${description}"` },
          { type: 'image_url', image_url: { url: _bufferToDataUrl(imageBuffer, mimeType), detail: 'low' } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 600,
    temperature: 0.4,
  });

  const raw = response.choices[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return {
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    feedback: (parsed.feedback || '').toString().slice(0, 600),
    grammarNotes: Array.isArray(parsed.grammarNotes)
      ? parsed.grammarNotes.slice(0, 6).map(g => ({
          wrong: (g?.wrong || '').toString(),
          correct: (g?.correct || '').toString(),
          note: (g?.note || '').toString(),
        }))
      : [],
    missingItems: Array.isArray(parsed.missingItems)
      ? parsed.missingItems.slice(0, 8).map(s => s.toString())
      : [],
  };
};

module.exports = { describePhoto, gradeDescription };
