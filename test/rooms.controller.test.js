const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  decideAutoJoin,
  decideJoin,
  decideLeave,
  isRoomAdmin,
  sortRoomsForCaller
} = require('../lib/roomMembership');

// ---------------------------------------------------------------------------
// decideAutoJoin — pure decision logic for autoJoinMatchingHub
// ---------------------------------------------------------------------------

test('decideAutoJoin: no-op when language_to_learn does not normalize', () => {
  const user = { _id: 'u1', language_to_learn: 'Klingon', leftHubs: [] };
  const hub = { _id: 'hub-en', targetLanguage: 'en', participants: [] };
  const result = decideAutoJoin(user, hub);
  assert.equal(result.shouldJoin, false);
  assert.equal(result.reason, 'no-canonical-language');
});

test('decideAutoJoin: no-op when hub is null (no matching hub found)', () => {
  const user = { _id: 'u1', language_to_learn: 'English', leftHubs: [] };
  const result = decideAutoJoin(user, null);
  assert.equal(result.shouldJoin, false);
  assert.equal(result.reason, 'no-matching-hub');
});

test('decideAutoJoin: joins when user matches hub language and is not already a member', () => {
  const user = { _id: 'u1', language_to_learn: 'English', leftHubs: [] };
  const hub = { _id: 'hub-en', targetLanguage: 'en', participants: [] };
  const result = decideAutoJoin(user, hub);
  assert.equal(result.shouldJoin, true);
});

test('decideAutoJoin: idempotent — already a participant means no-op (second call adds none)', () => {
  const user = { _id: 'u1', language_to_learn: 'English', leftHubs: [] };
  const hub = { _id: 'hub-en', targetLanguage: 'en', participants: ['u1'] };
  const result = decideAutoJoin(user, hub);
  assert.equal(result.shouldJoin, false);
  assert.equal(result.reason, 'already-member');
});

test('decideAutoJoin: sticky-leave — hub in user.leftHubs blocks re-auto-join', () => {
  const user = { _id: 'u1', language_to_learn: 'English', leftHubs: ['hub-en'] };
  const hub = { _id: 'hub-en', targetLanguage: 'en', participants: [] };
  const result = decideAutoJoin(user, hub);
  assert.equal(result.shouldJoin, false);
  assert.equal(result.reason, 'left-hub');
});

test('decideAutoJoin: sticky-leave works with ObjectId-like ids (toString comparison)', () => {
  const hubId = { toString: () => 'hub-en' };
  const user = { _id: 'u1', language_to_learn: 'English', leftHubs: [{ toString: () => 'hub-en' }] };
  const hub = { _id: hubId, targetLanguage: 'en', participants: [] };
  const result = decideAutoJoin(user, hub);
  assert.equal(result.shouldJoin, false);
  assert.equal(result.reason, 'left-hub');
});

// ---------------------------------------------------------------------------
// decideJoin — explicit POST /rooms/:id/join
// ---------------------------------------------------------------------------

test('decideJoin: newly added when not already a participant', () => {
  const hub = { participants: [] };
  const result = decideJoin('u1', hub);
  assert.equal(result.isNewMember, true);
});

test('decideJoin: not newly added (no memberCount increment) when already a participant', () => {
  const hub = { participants: ['u1'] };
  const result = decideJoin('u1', hub);
  assert.equal(result.isNewMember, false);
});

// ---------------------------------------------------------------------------
// decideLeave — explicit POST /rooms/:id/leave
// ---------------------------------------------------------------------------

test('decideLeave: wasMember true (decrement) when user is currently a participant', () => {
  const hub = { participants: ['u1'] };
  const result = decideLeave('u1', hub);
  assert.equal(result.wasMember, true);
});

test('decideLeave: wasMember false (no decrement) when user is not a participant', () => {
  const hub = { participants: [] };
  const result = decideLeave('u1', hub);
  assert.equal(result.wasMember, false);
});

// ---------------------------------------------------------------------------
// isRoomAdmin — owner or admins[] gate
// ---------------------------------------------------------------------------

test('isRoomAdmin: true for owner', () => {
  const hub = { owner: 'u1', admins: [] };
  assert.equal(isRoomAdmin('u1', hub), true);
});

test('isRoomAdmin: true for a user in admins[]', () => {
  const hub = { owner: 'owner1', admins: ['u2', 'u3'] };
  assert.equal(isRoomAdmin('u2', hub), true);
});

test('isRoomAdmin: false for a regular member', () => {
  const hub = { owner: 'owner1', admins: ['u2'] };
  assert.equal(isRoomAdmin('u9', hub), false);
});

test('isRoomAdmin: works with ObjectId-like ids', () => {
  const owner = { toString: () => 'owner1' };
  const hub = { owner, admins: [{ toString: () => 'u2' }] };
  assert.equal(isRoomAdmin('owner1', hub), true);
  assert.equal(isRoomAdmin('u2', hub), true);
  assert.equal(isRoomAdmin('random', hub), false);
});

// ---------------------------------------------------------------------------
// sortRoomsForCaller — caller's matching hub first, then memberCount desc
// ---------------------------------------------------------------------------

test('sortRoomsForCaller: caller\'s matching-language hub is sorted first', () => {
  const rooms = [
    { _id: 'a', targetLanguage: 'ko', memberCount: 500 },
    { _id: 'b', targetLanguage: 'en', memberCount: 10 },
    { _id: 'c', targetLanguage: 'ja', memberCount: 300 }
  ];
  const sorted = sortRoomsForCaller(rooms, 'en');
  assert.equal(sorted[0]._id, 'b');
});

test('sortRoomsForCaller: falls back to memberCount desc when no caller language match', () => {
  const rooms = [
    { _id: 'a', targetLanguage: 'ko', memberCount: 500 },
    { _id: 'b', targetLanguage: 'en', memberCount: 10 },
    { _id: 'c', targetLanguage: 'ja', memberCount: 300 }
  ];
  const sorted = sortRoomsForCaller(rooms, null);
  assert.deepEqual(sorted.map(r => r._id), ['a', 'c', 'b']);
});

test('sortRoomsForCaller: memberCount desc ordering after the pinned hub', () => {
  const rooms = [
    { _id: 'a', targetLanguage: 'ko', memberCount: 500 },
    { _id: 'b', targetLanguage: 'en', memberCount: 10 },
    { _id: 'c', targetLanguage: 'ja', memberCount: 300 }
  ];
  const sorted = sortRoomsForCaller(rooms, 'en');
  assert.deepEqual(sorted.map(r => r._id), ['b', 'a', 'c']);
});

test('sortRoomsForCaller: does not mutate the input array', () => {
  const rooms = [
    { _id: 'a', targetLanguage: 'ko', memberCount: 500 },
    { _id: 'b', targetLanguage: 'en', memberCount: 10 }
  ];
  const original = [...rooms];
  sortRoomsForCaller(rooms, 'en');
  assert.deepEqual(rooms, original);
});

// ---------------------------------------------------------------------------
// ROOMS_ENABLED guard — centralized in config/limitations.js (Task 7).
// lib/roomMembership.js:getRoomsEnabled() re-requires that module fresh on
// every call, so toggling process.env.ROOMS_ENABLED + clearing
// config/limitations.js's require cache is sufficient to observe the change.
// ---------------------------------------------------------------------------

test('getRoomsEnabled reads config/limitations.js ROOMS_ENABLED with default-true', () => {
  const original = process.env.ROOMS_ENABLED;
  try {
    delete process.env.ROOMS_ENABLED;
    delete require.cache[require.resolve('../config/limitations')];
    delete require.cache[require.resolve('../lib/roomMembership')];
    const { getRoomsEnabled } = require('../lib/roomMembership');
    assert.equal(getRoomsEnabled(), true);

    process.env.ROOMS_ENABLED = 'false';
    delete require.cache[require.resolve('../config/limitations')];
    assert.equal(getRoomsEnabled(), false);
  } finally {
    if (original === undefined) delete process.env.ROOMS_ENABLED;
    else process.env.ROOMS_ENABLED = original;
    delete require.cache[require.resolve('../config/limitations')];
    delete require.cache[require.resolve('../lib/roomMembership')];
  }
});
