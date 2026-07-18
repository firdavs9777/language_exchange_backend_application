const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveOnlineCount,
  getActiveRoomUserIds,
  buildRoomMessageDoc
} = require('../lib/roomPresence');

// ---------------------------------------------------------------------------
// deriveOnlineCount — presence must always be derived from the adapter room
// size at emit time, never a stored counter (reviewer requirement — this is
// what makes it survive an ungraceful disconnect).
// ---------------------------------------------------------------------------

test('deriveOnlineCount: returns the adapter room Set size when the room exists', () => {
  const rooms = new Map();
  rooms.set('room_abc', new Set(['socketA', 'socketB', 'socketC']));
  const io = { sockets: { adapter: { rooms } } };
  assert.equal(deriveOnlineCount(io, 'abc'), 3);
});

test('deriveOnlineCount: returns 0 when the room does not exist (everyone left/disconnected)', () => {
  const rooms = new Map();
  const io = { sockets: { adapter: { rooms } } };
  assert.equal(deriveOnlineCount(io, 'abc'), 0);
});

test('deriveOnlineCount: reflects a shrunk room size after disconnects (no stale counter)', () => {
  const roomSet = new Set(['socketA', 'socketB']);
  const rooms = new Map();
  rooms.set('room_abc', roomSet);
  const io = { sockets: { adapter: { rooms } } };
  assert.equal(deriveOnlineCount(io, 'abc'), 2);

  // Simulate a disconnect removing a socket from the adapter's room Set.
  roomSet.delete('socketA');
  assert.equal(deriveOnlineCount(io, 'abc'), 1);

  // Simulate the last socket leaving — Socket.IO deletes the room entry entirely.
  roomSet.delete('socketB');
  rooms.delete('room_abc');
  assert.equal(deriveOnlineCount(io, 'abc'), 0);
});

test('deriveOnlineCount: tolerates a missing adapter/rooms map gracefully', () => {
  assert.equal(deriveOnlineCount({ sockets: {} }, 'abc'), 0);
  assert.equal(deriveOnlineCount({}, 'abc'), 0);
});

// ---------------------------------------------------------------------------
// getActiveRoomUserIds (Task 15 follow-up — notifications) — used to skip
// the new-message push for topic-room members who already have a live
// socket in the room (they see the message via room:message already).
// ---------------------------------------------------------------------------

function fakeIo(roomMembers, socketUsers) {
  const rooms = new Map();
  if (roomMembers) rooms.set('room_abc', new Set(roomMembers));
  const sockets = new Map(Object.entries(socketUsers || {}).map(([socketId, userId]) => [
    socketId,
    { user: userId ? { id: userId } : undefined }
  ]));
  return { sockets: { adapter: { rooms }, sockets } };
}

test('getActiveRoomUserIds: returns the user ids behind every socket currently in the room', () => {
  const io = fakeIo(['socketA', 'socketB'], { socketA: 'u1', socketB: 'u2' });
  assert.deepEqual(getActiveRoomUserIds(io, 'abc'), new Set(['u1', 'u2']));
});

test('getActiveRoomUserIds: dedups when the same user has multiple sockets in the room', () => {
  const io = fakeIo(['socketA', 'socketB'], { socketA: 'u1', socketB: 'u1' });
  assert.deepEqual(getActiveRoomUserIds(io, 'abc'), new Set(['u1']));
});

test('getActiveRoomUserIds: empty set when the room does not exist', () => {
  const io = fakeIo(null, {});
  assert.deepEqual(getActiveRoomUserIds(io, 'abc'), new Set());
});

test('getActiveRoomUserIds: skips sockets with no attached user (defensive)', () => {
  const io = fakeIo(['socketA', 'socketB'], { socketA: 'u1', socketB: null });
  assert.deepEqual(getActiveRoomUserIds(io, 'abc'), new Set(['u1']));
});

test('getActiveRoomUserIds: tolerates a missing adapter/rooms/sockets map gracefully', () => {
  assert.deepEqual(getActiveRoomUserIds({ sockets: {} }, 'abc'), new Set());
  assert.deepEqual(getActiveRoomUserIds({}, 'abc'), new Set());
});

// ---------------------------------------------------------------------------
// buildRoomMessageDoc — the broadcast message path must NOT populate
// unreadCount[]/readBy[] fan-out fields (reviewer requirement: a 240-member
// hub must never per-message fan out those arrays).
// ---------------------------------------------------------------------------

test('buildRoomMessageDoc: builds a group-message doc for the hub conversation', () => {
  const doc = buildRoomMessageDoc({
    roomId: 'room123',
    senderId: 'user1',
    message: 'hello room',
    messageType: 'text'
  });

  assert.equal(doc.conversationId, 'room123');
  assert.equal(doc.sender, 'user1');
  assert.equal(doc.message, 'hello room');
  assert.equal(doc.isGroupMessage, true);
  assert.equal(doc.messageType, 'text');
});

test('buildRoomMessageDoc: never includes unreadCount or readBy fan-out fields', () => {
  const doc = buildRoomMessageDoc({
    roomId: 'room123',
    senderId: 'user1',
    message: 'hello room'
  });

  assert.equal('unreadCount' in doc, false);
  assert.equal('readBy' in doc, false);
});

test('buildRoomMessageDoc: defaults messageType to text and passes through mentions', () => {
  const mentions = [{ user: 'u2', username: 'bob', startIndex: 0, endIndex: 4 }];
  const doc = buildRoomMessageDoc({
    roomId: 'room123',
    senderId: 'user1',
    message: '@bob hi',
    mentions
  });

  assert.equal(doc.messageType, 'text');
  assert.deepEqual(doc.mentions, mentions);
});

test('buildRoomMessageDoc: rejects missing roomId/senderId/message', () => {
  assert.throws(() => buildRoomMessageDoc({ senderId: 'u1', message: 'hi' }));
  assert.throws(() => buildRoomMessageDoc({ roomId: 'r1', message: 'hi' }));
  assert.throws(() => buildRoomMessageDoc({ roomId: 'r1', senderId: 'u1' }));
});
