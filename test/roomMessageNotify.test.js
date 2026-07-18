const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isMemberMuted, resolveRoomMessageRecipients } = require('../lib/roomMessageNotify');

// ---------------------------------------------------------------------------
// isMemberMuted — pure re-implementation of Conversation.isMuted's read path
// ---------------------------------------------------------------------------

test('isMemberMuted: false when mutedBy is missing/empty', () => {
  assert.equal(isMemberMuted(undefined, 'u1'), false);
  assert.equal(isMemberMuted(null, 'u1'), false);
  assert.equal(isMemberMuted([], 'u1'), false);
});

test('isMemberMuted: true for a permanent mute (mutedUntil: null)', () => {
  const mutedBy = [{ user: 'u1', mutedUntil: null }];
  assert.equal(isMemberMuted(mutedBy, 'u1'), true);
});

test('isMemberMuted: true for a mute that has not expired yet', () => {
  const future = new Date(Date.now() + 60_000);
  const mutedBy = [{ user: 'u1', mutedUntil: future }];
  assert.equal(isMemberMuted(mutedBy, 'u1'), true);
});

test('isMemberMuted: false for a mute that already expired', () => {
  const past = new Date(Date.now() - 60_000);
  const mutedBy = [{ user: 'u1', mutedUntil: past }];
  assert.equal(isMemberMuted(mutedBy, 'u1'), false);
});

test('isMemberMuted: only matches the queried user, not other muted members', () => {
  const mutedBy = [{ user: 'u2', mutedUntil: null }];
  assert.equal(isMemberMuted(mutedBy, 'u1'), false);
});

test('isMemberMuted: tolerates ObjectId-like ids (toString-comparable)', () => {
  const uid = { toString: () => 'u1' };
  const mutedBy = [{ user: { toString: () => 'u1' }, mutedUntil: null }];
  assert.equal(isMemberMuted(mutedBy, uid), true);
});

// ---------------------------------------------------------------------------
// resolveRoomMessageRecipients — who gets a new-message push for a topic room
// ---------------------------------------------------------------------------

test('resolveRoomMessageRecipients: empty room has no recipients', () => {
  assert.deepEqual(
    resolveRoomMessageRecipients({ participants: [], mutedBy: [], activeUserIds: new Set(), senderId: 's1' }),
    []
  );
  assert.deepEqual(
    resolveRoomMessageRecipients({ participants: undefined, mutedBy: [], activeUserIds: new Set(), senderId: 's1' }),
    []
  );
});

test('resolveRoomMessageRecipients: never notifies the sender', () => {
  const result = resolveRoomMessageRecipients({
    participants: ['s1', 'u2'],
    mutedBy: [],
    activeUserIds: new Set(),
    senderId: 's1'
  });
  assert.deepEqual(result, ['u2']);
});

test('resolveRoomMessageRecipients: skips members currently active in the room', () => {
  const result = resolveRoomMessageRecipients({
    participants: ['s1', 'u2', 'u3'],
    mutedBy: [],
    activeUserIds: new Set(['u2']),
    senderId: 's1'
  });
  assert.deepEqual(result, ['u3']);
});

test('resolveRoomMessageRecipients: skips members who have muted the room', () => {
  const result = resolveRoomMessageRecipients({
    participants: ['s1', 'u2', 'u3'],
    mutedBy: [{ user: 'u2', mutedUntil: null }],
    activeUserIds: new Set(),
    senderId: 's1'
  });
  assert.deepEqual(result, ['u3']);
});

test('resolveRoomMessageRecipients: an expired mute does not suppress the push', () => {
  const past = new Date(Date.now() - 60_000);
  const result = resolveRoomMessageRecipients({
    participants: ['s1', 'u2'],
    mutedBy: [{ user: 'u2', mutedUntil: past }],
    activeUserIds: new Set(),
    senderId: 's1'
  });
  assert.deepEqual(result, ['u2']);
});

test('resolveRoomMessageRecipients: dedups repeated participant entries', () => {
  const result = resolveRoomMessageRecipients({
    participants: ['s1', 'u2', 'u2'],
    mutedBy: [],
    activeUserIds: new Set(),
    senderId: 's1'
  });
  assert.deepEqual(result, ['u2']);
});

test('resolveRoomMessageRecipients: accepts activeUserIds as a plain array too', () => {
  const result = resolveRoomMessageRecipients({
    participants: ['s1', 'u2', 'u3'],
    mutedBy: [],
    activeUserIds: ['u3'],
    senderId: 's1'
  });
  assert.deepEqual(result, ['u2']);
});

test('resolveRoomMessageRecipients: tolerates ObjectId-like ids (toString-comparable)', () => {
  const sender = { toString: () => 's1' };
  const p2 = { toString: () => 'u2' };
  const result = resolveRoomMessageRecipients({
    participants: [sender, p2],
    mutedBy: [],
    activeUserIds: new Set(),
    senderId: sender
  });
  assert.deepEqual(result, ['u2']);
});

test('resolveRoomMessageRecipients: a fully active + muted room yields zero recipients (no spam)', () => {
  const result = resolveRoomMessageRecipients({
    participants: ['s1', 'u2', 'u3'],
    mutedBy: [{ user: 'u3', mutedUntil: null }],
    activeUserIds: new Set(['u2']),
    senderId: 's1'
  });
  assert.deepEqual(result, []);
});
