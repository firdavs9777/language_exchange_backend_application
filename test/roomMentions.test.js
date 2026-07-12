const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveRoomMentionRecipients, dispatchRoomMentionPushes } = require('../lib/roomMentions');

test('resolveRoomMentionRecipients: empty for a plain (non-mention) message — this is the "0 pushes" guarantee', () => {
  assert.deepEqual(resolveRoomMentionRecipients(undefined, 'sender1'), []);
  assert.deepEqual(resolveRoomMentionRecipients(null, 'sender1'), []);
  assert.deepEqual(resolveRoomMentionRecipients([], 'sender1'), []);
});

test('resolveRoomMentionRecipients: returns the mentioned user id for a single mention', () => {
  const mentions = [{ user: 'user2', username: 'bob' }];
  assert.deepEqual(resolveRoomMentionRecipients(mentions, 'sender1'), ['user2']);
});

test('resolveRoomMentionRecipients: excludes a self-mention', () => {
  const mentions = [{ user: 'sender1', username: 'me' }];
  assert.deepEqual(resolveRoomMentionRecipients(mentions, 'sender1'), []);
});

test('resolveRoomMentionRecipients: dedups repeated mentions of the same user', () => {
  const mentions = [
    { user: 'user2', username: 'bob' },
    { user: 'user2', username: 'bob' }
  ];
  assert.deepEqual(resolveRoomMentionRecipients(mentions, 'sender1'), ['user2']);
});

test('resolveRoomMentionRecipients: multiple distinct mentions, self excluded, order preserved', () => {
  const mentions = [
    { user: 'user2' },
    { user: 'sender1' },
    { user: 'user3' }
  ];
  assert.deepEqual(resolveRoomMentionRecipients(mentions, 'sender1'), ['user2', 'user3']);
});

test('resolveRoomMentionRecipients: tolerates ObjectId-like ids (toString-comparable)', () => {
  const sender = { toString: () => 'sender1' };
  const mentionedUser = { toString: () => 'user2' };
  const mentions = [{ user: mentionedUser }];
  assert.deepEqual(resolveRoomMentionRecipients(mentions, sender), ['user2']);
});

test('resolveRoomMentionRecipients: skips malformed mention entries with no user id', () => {
  const mentions = [{ username: 'noid' }, { user: 'user2' }];
  assert.deepEqual(resolveRoomMentionRecipients(mentions, 'sender1'), ['user2']);
});

// ---------------------------------------------------------------------------
// dispatchRoomMentionPushes — the exact wiring socket/roomHandler.js's
// room:message handler performs, with sendFn injected so this is testable
// with a spy (roomHandler.js itself can't be require()'d standalone in this
// sandbox — transitively pulls in jsonwebtoken via models/User.js).
//
// This is the "plain room message -> 0 push sends, mention -> 1 push send"
// contract required by Workstream D Task 7 — a 240-member hub must never
// receive a per-message push fan-out, only the specifically @mentioned users.
// ---------------------------------------------------------------------------

test('dispatchRoomMentionPushes: a plain (non-mention) room message sends ZERO pushes', () => {
  const calls = [];
  const sendFn = (...args) => calls.push(args);

  const count = dispatchRoomMentionPushes({
    mentions: undefined, // plain message — no mentions[] at all
    senderId: 'sender1',
    roomId: 'hub-en',
    messageText: 'hello room, how is everyone today?',
    sendFn
  });

  assert.equal(count, 0);
  assert.deepEqual(calls, []);
});

test('dispatchRoomMentionPushes: a message mentioning one user sends EXACTLY ONE push', () => {
  const calls = [];
  const sendFn = (...args) => calls.push(args);

  const count = dispatchRoomMentionPushes({
    mentions: [{ user: 'user2', username: 'bob' }],
    senderId: 'sender1',
    roomId: 'hub-en',
    messageText: '@bob check this out',
    sendFn
  });

  assert.equal(count, 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['user2', 'sender1', 'hub-en', '@bob check this out']);
});

test('dispatchRoomMentionPushes: mentioning two distinct users sends two pushes, one each', () => {
  const calls = [];
  const sendFn = (...args) => calls.push(args);

  const count = dispatchRoomMentionPushes({
    mentions: [{ user: 'user2' }, { user: 'user3' }],
    senderId: 'sender1',
    roomId: 'hub-en',
    messageText: '@bob @carol look',
    sendFn
  });

  assert.equal(count, 2);
  assert.deepEqual(calls.map((c) => c[0]), ['user2', 'user3']);
});

test('dispatchRoomMentionPushes: self-mention sends zero pushes (never notify yourself)', () => {
  const calls = [];
  const sendFn = (...args) => calls.push(args);

  const count = dispatchRoomMentionPushes({
    mentions: [{ user: 'sender1' }],
    senderId: 'sender1',
    roomId: 'hub-en',
    messageText: 'talking to myself',
    sendFn
  });

  assert.equal(count, 0);
  assert.deepEqual(calls, []);
});

test('dispatchRoomMentionPushes: an empty mentions array sends zero pushes', () => {
  const calls = [];
  const sendFn = (...args) => calls.push(args);

  const count = dispatchRoomMentionPushes({
    mentions: [],
    senderId: 'sender1',
    roomId: 'hub-en',
    messageText: 'no mentions here',
    sendFn
  });

  assert.equal(count, 0);
  assert.deepEqual(calls, []);
});
