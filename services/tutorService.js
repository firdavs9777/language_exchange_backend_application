/**
 * Tutor service — prompt construction, OpenAI invocation, JSON parsing,
 * daily-plan generation, and session summarization.
 *
 * Uses aiProviderService.chatCompletion under the hood so the tutor inherits
 * the existing retry/backoff/rate-limit behaviour and the centralized OpenAI
 * client.
 */

const TutorMemory     = require('../models/TutorMemory');
const Vocabulary      = require('../models/Vocabulary');
const aiProvider      = require('./aiProviderService');

const PERSONA_PROMPTS = {
  nana:   "You are Nana, a warm and encouraging tutor 🐻. Use light emoji. Praise effort first, then correct gently. Keep replies short (≤80 words) unless explaining grammar.",
  sensei: "You are Sensei, a precise and exam-focused tutor 🤖. No emoji. Address the user formally. When correcting, reference the specific rule. Reply length: bullet-point clarity.",
  riko:   "You are Riko, a playful and slangy tutor 🐙. Use jokes and target-language slang when the user's level allows (B1+). Keep it casual. Make mistakes funny, not scary.",
};

const RESPONSE_SCHEMA = `
Respond as valid JSON matching this exact shape:
{
  "type": "text" | "quiz_card" | "vocab_card" | "grammar_card" | "srs_due_card" | "mini_lesson_card",
  "content": "<conversational text — required for all types; for cards, this is the short intro before the card>",
  "payload": {
    // For "quiz_card":      { "question": string, "options": string[], "correctIdx": number, "explanation": string }
    // For "vocab_card":     { "word": string, "language": string, "definition": string, "example": string, "ipa"?: string }
    // For "grammar_card":   { "rule": string, "explanation": string, "examples": [{ "correct": string, "wrong"?: string, "note"?: string }] }
    // For "srs_due_card":   { "dueCount": number, "preview": [{ "word": string, "definition"?: string }]  // up to 3 preview entries
    //                       }   — emit when the user has SRS cards waiting and you want to suggest reviewing them now
    // For "mini_lesson_card":
    //   { "title": string, "bullets": [string, string, string], "practicePrompt"?: string }
    //   — emit when teaching a small concept; up to 3 bullets, optional practice prompt the user can tap to try
    // For "text": omit or null
  }
}

Output the JSON only. No code fences, no commentary.
`;

/**
 * Build the system prompt for a tutor turn from memory + user profile.
 * @param {Object} memory - TutorMemory doc (Mongoose or plain object)
 * @param {Object} user   - User doc with at least { name } (other fields optional)
 */
const buildSystemPrompt = (memory, user) => {
  const persona = memory.persona || 'nana';
  const recentSummary = memory.recentChatSummaries?.[0]?.summary || 'first chat';
  const weakAreaTopics = (memory.weakAreas || []).slice(0, 3).map(w => w.topic).join(', ') || 'none yet';
  const vocabFocusIds = (memory.vocabFocus || []).slice(0, 5).map(v => v.wordId?.toString?.() || v.wordId).join(', ') || 'none yet';

  return [
    `Today's date is ${new Date().toISOString().slice(0, 10)}.`,
    `User profile:`,
    `- Name: ${user?.name || 'Friend'}`,
    `- Level: ${memory.proficiencyLevel}`,
    `- Native language: ${memory.nativeLanguage || 'unknown'}`,
    `- Learning: ${(memory.targetLanguages || []).join(', ') || 'unspecified'}`,
    `- Recent weak areas: ${weakAreaTopics}`,
    `- Recent vocab focus (ids): ${vocabFocusIds}`,
    `- Summary of last chat: ${recentSummary}`,
    ``,
    `Your job: help the user practice and improve. Respond in their target language at their level when appropriate; switch to their native language to explain rules or correct mistakes.`,
    ``,
    `You can drop interactive cards into the chat:`,
    `- quiz_card: when you want to check understanding`,
    `- vocab_card: when you introduce a new word`,
    `- grammar_card: when you explain a rule`,
    ``,
    PERSONA_PROMPTS[persona],
    ``,
    RESPONSE_SCHEMA,
  ].join('\n');
};

/**
 * Call gpt-4o-mini in JSON mode with the system prompt + last 20 messages.
 * Returns the raw string content (caller is responsible for parseTutorReply).
 */
const callTutorModel = async (systemPrompt, history) => {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-20).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.role === 'assistant' && m.messageType && m.messageType !== 'text'
        ? `${m.content}\n[previously sent card: ${m.messageType}]`
        : m.content,
    })),
  ];

  const result = await aiProvider.chatCompletion({
    messages,
    feature: 'conversation',
    json: true,
    maxTokens: 600,
    temperature: 0.7,
  });

  return result?.content || '';
};

/**
 * Defensive parser — if the AI emits non-JSON or unknown type, falls back to
 * a text bubble using whatever string came back. Never throws.
 */
const parseTutorReply = (raw) => {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const type = ['text', 'quiz_card', 'vocab_card', 'grammar_card', 'srs_due_card', 'mini_lesson_card']
      .includes(parsed.type)
      ? parsed.type
      : 'text';
    return {
      messageType: type,
      content:     parsed.content || '',
      payload:     type === 'text' ? null : parsed.payload || null,
    };
  } catch (e) {
    return {
      messageType: 'text',
      content:     typeof raw === 'string' && raw.length > 0
        ? raw
        : "Sorry, I got confused — say that again?",
      payload:     null,
    };
  }
};

/**
 * Compute today's plan from the user's SRS-due count + top weak area.
 * Always includes a 5-minute tutor_chat target.
 */
const generateDailyPlan = async (userId, memory) => {
  let dueCount = 0;
  try {
    dueCount = await Vocabulary.countDocuments({
      user: userId,
      nextReviewAt: { $lte: new Date() },
    });
  } catch (e) {
    console.error('[tutor] SRS due-count failed (non-fatal):', e.message);
  }

  const topWeakArea = (memory.weakAreas || [])
    .slice()
    .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))[0];

  const tasks = [];
  if (dueCount > 0) {
    tasks.push({ type: 'srs_review', count: dueCount, completed: 0 });
  }
  if (topWeakArea) {
    tasks.push({ type: 'grammar_drill', topic: topWeakArea.topic, completed: false });
  }
  tasks.push({ type: 'tutor_chat', minutes: 5, completed: 0 });

  return {
    date:  new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z'),
    tasks,
  };
};

/**
 * Generate a short (≤30 words / ≤200 chars) summary of a tutor session.
 * Returns null on failure or for sessions too short to summarize.
 */
const summarizeSession = async (session) => {
  if (!session?.messages || session.messages.length < 4) return null;

  const transcript = session.messages
    .slice(-12)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  try {
    const result = await aiProvider.chatCompletion({
      messages: [
        { role: 'system', content: 'Summarize this tutor session in ≤30 words, focusing on the main topic, what the user worked on, and any errors corrected. Output JSON: {"summary":"..."}.' },
        { role: 'user', content: transcript },
      ],
      feature: 'conversation',
      json: true,
      maxTokens: 80,
    });
    const parsed = JSON.parse(result?.content || '{}');
    return (parsed.summary || '').slice(0, 200);
  } catch (e) {
    console.error('[tutor] summarizeSession failed:', e.message);
    return null;
  }
};

/**
 * Push a session summary onto TutorMemory.recentChatSummaries (rolling 5).
 * No-op for falsy summary. Best-effort.
 */
const appendSummaryToMemory = async (userId, sessionId, summary) => {
  if (!summary) return;
  try {
    await TutorMemory.updateOne(
      { user: userId },
      {
        $push: {
          recentChatSummaries: {
            $each:  [{ sessionId, summary, createdAt: new Date() }],
            $slice: -5,
          },
        },
        $set: { lastSeen: new Date() },
      }
    );
  } catch (e) {
    console.error('[tutor] appendSummaryToMemory failed:', e.message);
  }
};

module.exports = {
  buildSystemPrompt,
  callTutorModel,
  parseTutorReply,
  generateDailyPlan,
  summarizeSession,
  appendSummaryToMemory,
  PERSONA_PROMPTS,
};
