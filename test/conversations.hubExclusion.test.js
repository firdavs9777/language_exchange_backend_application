const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildConversationListQuery } = require('../lib/conversationListQuery');

test('excludes hubs, topic rooms, and the requesting user\'s deleted conversations by default', () => {
  const userId = 'user123';
  const query = buildConversationListQuery(userId);

  assert.deepEqual(query, {
    participants: userId,
    deletedBy: { $ne: userId },
    roomType: { $nin: ['hub', 'topic'] }
  });
});

test('always includes roomType exclusion (hub + topic) regardless of other filters', () => {
  const userId = 'user123';
  const query = buildConversationListQuery(userId, {
    archived: 'true',
    muted: 'false',
    pinned: 'true'
  });

  assert.deepEqual(query.roomType, { $nin: ['hub', 'topic'] });
  assert.deepEqual(query.participants, userId);
  assert.deepEqual(query.deletedBy, { $ne: userId });
});

test('applies archived filter variants', () => {
  const userId = 'u1';
  assert.equal(buildConversationListQuery(userId, { archived: 'true' }).archivedBy, userId);
  assert.deepEqual(
    buildConversationListQuery(userId, { archived: 'false' }).archivedBy,
    { $ne: userId }
  );
  assert.equal(buildConversationListQuery(userId, {}).archivedBy, undefined);
});

test('applies muted filter variants', () => {
  const userId = 'u1';
  assert.equal(buildConversationListQuery(userId, { muted: 'true' })['mutedBy.user'], userId);
  assert.deepEqual(
    buildConversationListQuery(userId, { muted: 'false' })['mutedBy.user'],
    { $ne: userId }
  );
  assert.equal(buildConversationListQuery(userId, {})['mutedBy.user'], undefined);
});

test('applies pinned filter variants', () => {
  const userId = 'u1';
  assert.equal(buildConversationListQuery(userId, { pinned: 'true' })['pinnedBy.user'], userId);
  assert.deepEqual(
    buildConversationListQuery(userId, { pinned: 'false' })['pinnedBy.user'],
    { $ne: userId }
  );
  assert.equal(buildConversationListQuery(userId, {})['pinnedBy.user'], undefined);
});

test('never allows roomType exclusion to be overridden by filters object', () => {
  // Defensive: even if a caller passed a roomType-like key in filters, our
  // builder only reads archived/muted/pinned, so hub+topic exclusion always wins.
  const userId = 'u1';
  const query = buildConversationListQuery(userId, {
    archived: undefined,
    muted: undefined,
    pinned: undefined,
    roomType: 'hub' // should be ignored — not a recognized filter key
  });
  assert.deepEqual(query.roomType, { $nin: ['hub', 'topic'] });
});
