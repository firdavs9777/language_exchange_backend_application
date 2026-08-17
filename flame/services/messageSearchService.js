const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { ValidationError } = require('../utils/errors');

const MAX_LIMIT = 100;

// Required lazily: chatService pulls in matchService and userService, and a
// top-level require here would close the import graph into a cycle.
const _chatService = () => require('./chatService');

/**
 * Searches the caller's messages.
 *
 * Scope comes from chatService.conversationFilterFor — the SAME filter the
 * Messages list uses — so a blocked or unmatched partner's messages are
 * unreachable here for exactly the reason they are unreachable there.
 * Re-deriving the exclusion would create a second copy to audit, and search is
 * the copy nobody would think to check.
 */
async function search(userId, { q, limit = 20, offset = 0 }) {
  const term = (q || '').trim();
  if (!term) throw new ValidationError('q is required');

  const take = Math.min(Number(limit) || 20, MAX_LIMIT);
  const skip = Math.max(Number(offset) || 0, 0);

  // 'any' spans both sides of the archive line — filing a conversation away is
  // not forgetting it — in ONE call. Calling this per archive state would run
  // the block and ended-match lookups twice for a single query.
  const scope = await _chatService().conversationFilterFor(userId, { archived: 'any' });
  const convs = await Conversation.find(scope).select('_id');
  const ids = convs.map((c) => c._id.toString());
  if (ids.length === 0) return { messages: [], total: 0 };

  const messageFilter = {
    conversationId: { $in: ids },
    isDeleted: false,
    deletedFor: { $ne: userId },
    $text: { $search: term },
  };

  const total = await Message.countDocuments(messageFilter);
  const messages = await Message.find(messageFilter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(take);

  return { messages, total };
}

module.exports = { search, MAX_LIMIT };
