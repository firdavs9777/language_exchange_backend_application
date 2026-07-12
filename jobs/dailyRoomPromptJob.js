/**
 * Daily Room Prompt Job — Workstream D, Task 6.
 *
 * For each seeded language-room hub, posts one `messageType:'system'` Message
 * (from the reserved system owner user) containing that hub's target
 * language's prompt-of-the-day, then broadcasts it to the hub's live socket
 * room. Reuses the same deterministic day-of-year prompt rotation as
 * controllers/moments.js:getPromptOfDay, filtered to each hub's
 * targetLanguage (see lib/dailyRoomPrompt.js for the pure rotation + dedup
 * logic, unit tested in test/dailyRoomPromptJob.test.js).
 *
 * Dedup: guarded by checking whether a system prompt message has already
 * been posted to a given hub today (UTC calendar day) before creating a new
 * one — safe to invoke more than once per day (e.g. a server restart).
 *
 * Gated by ROOMS_ENABLED (config/limitations.js) — if rooms are disabled,
 * the job no-ops entirely rather than silently posting into a feature that's
 * pulled.
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Prompt = require('../models/Prompt');
const User = require('../models/User');
const { ROOMS_ENABLED } = require('../config/limitations');
const { selectPromptForLanguage, shouldPostToday } = require('../lib/dailyRoomPrompt');

const SYSTEM_OWNER_EMAIL = 'system@bananatalk.internal';

/**
 * Lazily fetch the live socket.io server instance. Required lazily (not at
 * module top) because jobs/scheduler.js — and therefore this job — is only
 * ever require()'d from inside server.js's `server.listen(...)` callback,
 * well after `module.exports = { app, server, io }` has already run, so the
 * require is safe and returns the fully-initialized `io`. No job in this
 * codebase currently needs `io` at module-load time; this keeps the pattern
 * consistent by deferring the require to call time.
 *
 * @returns {import('socket.io').Server|null}
 */
function getIo() {
  try {
    return require('../server').io || null;
  } catch (error) {
    console.error('[dailyRoomPromptJob] Failed to load io from server.js:', error.message);
    return null;
  }
}

/**
 * Post today's prompt into a single hub, if one hasn't already been posted
 * today and a prompt exists for the hub's targetLanguage.
 *
 * @param {Object} hub - hub Conversation lean doc (`_id`, `targetLanguage`)
 * @param {String} systemUserId
 * @param {import('socket.io').Server|null} io
 * @returns {Promise<{ posted: boolean, reason: string }>}
 */
async function postPromptForHub(hub, systemUserId, io) {
  const activePrompts = await Prompt.find({ language: hub.targetLanguage, active: true })
    .sort({ _id: 1 })
    .lean();

  const prompt = selectPromptForLanguage(activePrompts, hub.targetLanguage);
  if (!prompt) {
    console.log(`[dailyRoomPromptJob] Skipping hub ${hub._id} (${hub.targetLanguage}) — no active prompts for this language`);
    return { posted: false, reason: 'no-prompt-for-language' };
  }

  // Dedup guard: find the most recent system prompt message for this hub.
  const lastPromptMessage = await Message.findOne({
    conversationId: hub._id,
    messageType: 'system',
    promptId: { $ne: null }
  })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean();

  if (!shouldPostToday(lastPromptMessage)) {
    console.log(`[dailyRoomPromptJob] Skipping hub ${hub._id} (${hub.targetLanguage}) — already posted today`);
    return { posted: false, reason: 'already-posted-today' };
  }

  const messageText = prompt.emoji ? `${prompt.emoji} ${prompt.text}` : prompt.text;

  const newMessage = await Message.create({
    conversationId: hub._id,
    sender: systemUserId,
    participants: [],
    message: messageText,
    isGroupMessage: true,
    messageType: 'system',
    promptId: prompt._id
  });

  await Conversation.updateOne(
    { _id: hub._id },
    { $set: { lastActivityAt: new Date() } }
  );

  if (io) {
    await newMessage.populate('sender', 'name username images userMode');
    io.to(`room_${hub._id}`).emit('room:message', newMessage);
  } else {
    console.warn(`[dailyRoomPromptJob] No io instance available — hub ${hub._id} prompt message saved but not broadcast live`);
  }

  console.log(`[dailyRoomPromptJob] Posted prompt to hub ${hub._id} (${hub.targetLanguage}): "${messageText}"`);
  return { posted: true, reason: 'posted' };
}

/**
 * Run the daily room prompt job across every seeded hub.
 * @returns {Promise<{ posted: number, skipped: number }>}
 */
async function runDailyRoomPromptJob() {
  if (!ROOMS_ENABLED) {
    console.log('[dailyRoomPromptJob] ROOMS_ENABLED is false — skipping entirely');
    return { posted: 0, skipped: 0 };
  }

  const systemOwner = await User.findOne({ email: SYSTEM_OWNER_EMAIL }).select('_id').lean();
  if (!systemOwner) {
    console.error('[dailyRoomPromptJob] System owner user not found — has migrations/seedRooms.js been run?');
    return { posted: 0, skipped: 0 };
  }

  const hubs = await Conversation.find({ roomType: 'hub' }).select('_id targetLanguage').lean();
  if (hubs.length === 0) {
    console.log('[dailyRoomPromptJob] No seeded hubs found — nothing to do');
    return { posted: 0, skipped: 0 };
  }

  const io = getIo();

  let posted = 0;
  let skipped = 0;

  for (const hub of hubs) {
    try {
      const result = await postPromptForHub(hub, systemOwner._id, io);
      if (result.posted) posted += 1;
      else skipped += 1;
    } catch (error) {
      console.error(`[dailyRoomPromptJob] Failed to post prompt for hub ${hub._id}:`, error.message);
      skipped += 1;
    }
  }

  console.log(`[dailyRoomPromptJob] Done. Posted: ${posted}, skipped: ${skipped}, total hubs: ${hubs.length}`);
  return { posted, skipped };
}

module.exports = { runDailyRoomPromptJob, postPromptForHub };
