const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildConversationListQuery } = require('../lib/conversationListQuery');

test('excludes hubs and the requesting user\'s deleted conversations by default', () => {
  const userId = 'user123';
  const query = buildConversationListQuery(userId);

  assert.deepEqual(query, {
    participants: userId,
    deletedBy: { $ne: userId },
    roomType: { $ne: 'hub' }
  });
});

test('always includes roomType exclusion regardless of other filters', () => {
  const userId = 'user123';
  const query = buildConversationListQuery(userId, {
    archived: 'true',
    muted: 'false',
    pinned: 'true'
  });

  assert.deepEqual(query.roomType, { $ne: 'hub' });
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

test('never allows roomType:hub to be overridden by filters object', () => {
  // Defensive: even if a caller passed a roomType-like key in filters, our
  // builder only reads archived/muted/pinned, so hub exclusion always wins.
  const userId = 'u1';
  const query = buildConversationListQuery(userId, {
    archived: undefined,
    muted: undefined,
    pinned: undefined,
    roomType: 'hub' // should be ignored — not a recognized filter key
  });
  assert.deepEqual(query.roomType, { $ne: 'hub' });
});
