const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const User = require('../models/User');
const chatService = require('./chatService');
const visibility = require('./visibilityService');
const { toPublicMinimal } = require('./userService');

const LIKE_ACTIONS = ['like', 'super'];

// Shape is dictated by the app's Match.fromJson (lib/models/match.dart):
// { id, user, matched_at, is_new, last_message }. Note there is NO
// conversation_id — the app resolves the conversation through
// conversationsProvider, which is why the conversation is created with the
// match. `user` must be a full user object, so we reuse userService's
// toPublicMinimal rather than inventing a second serialisation.
async function toMatchPayload(match, viewerId, isNew) {
  const otherId = match.users.find((u) => u !== viewerId);
  const other = await User.findById(otherId).lean();
  return {
    id: match._id.toString(),
    user: other ? toPublicMinimal(other) : { id: otherId },
    matched_at: match.createdAt,
    is_new: isNew,
    last_message: null,
  };
}

// Records a swipe and, when it completes a mutual like, creates the match and
// its conversation together.
async function record(fromId, toId, action) {
  await visibility.assertCanInteract(fromId, toId);

  // Idempotent: a retry or double-tap must not create a second row. The unique
  // (from,to) index makes this safe even under concurrency.
  await Swipe.updateOne(
    { from: fromId, to: toId },
    { $setOnInsert: { from: fromId, to: toId, action, createdAt: new Date() } },
    { upsert: true },
  );

  if (!LIKE_ACTIONS.includes(action)) return { isMatch: false, match: null };

  const reciprocal = await Swipe.findOne({
    from: toId, to: fromId, action: { $in: LIKE_ACTIONS },
  }).lean();
  if (!reciprocal) return { isMatch: false, match: null };

  const users = Match.pair(fromId, toId);

  const existing = await Match.findOne({ users }).lean();
  if (existing) {
    if (existing.endedBy) return { isMatch: false, match: null };
    return { isMatch: true, match: await toMatchPayload(existing, fromId, false) };
  }

  const conversation = await chatService.openConversation(fromId, toId);

  try {
    const match = await Match.create({ users, conversationId: conversation.id });
    return { isMatch: true, match: await toMatchPayload(match, fromId, true) };
  } catch (e) {
    // Both users liked each other at the same instant and the other request won
    // the unique index. Read their match rather than failing — same recovery
    // idiom as socialAuthService.findOrCreate.
    if (e.code === 11000) {
      const winner = await Match.findOne({ users }).lean();
      if (winner) {
        // We lost the race, so the conversation we just created is unreferenced.
        // It cannot contain a message yet, so removing it is safe — leaving it
        // would surface an empty ghost chat in both users' conversation lists.
        if (winner.conversationId !== conversation.id) {
          const Conversation = require('../models/Conversation');
          await Conversation.deleteOne({ _id: conversation.id });
        }
        return { isMatch: true, match: await toMatchPayload(winner, fromId, false) };
      }
    }
    throw e;
  }
}

module.exports = { record };
