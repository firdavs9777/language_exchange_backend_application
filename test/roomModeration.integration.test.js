/**
 * Task 16 — moderation: kick-as-ban + join-request/approval for
 * user-created topic rooms. Integration tests against a real Mongo
 * (mongodb-memory-server, single standalone instance — no multi-doc
 * transactions needed here) exercising the actual exported controller
 * functions (controllers/rooms.js) with mock req/res, mirroring the
 * mock-req/res pattern used in test/reelsModeration.test.js and the
 * live-Mongo pattern used in test/coinLedger.integration.test.js /
 * test/coinBonus.enforcement.test.js.
 *
 * Covers the security-critical flows called out in the task:
 *   - kick -> ban -> rejoin blocked
 *   - request-join creates a pending request (+ dedupes)
 *   - approve adds member + clears ban + clears the request
 *   - deny clears the request WITHOUT banning
 *   - owner can never be kicked/banned
 *   - a non-admin member cannot approve/deny/list requests
 *
 * Run: ~/.nvm/versions/node/v24.18.0/bin/node \
 *        --experimental-test-module-mocks --test test/roomModeration.integration.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let User;
let Conversation;
let roomsController;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'room_moderation_test' });

  User = require('../models/User');
  Conversation = require('../models/Conversation');
  roomsController = require('../controllers/rooms');
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

let userCounter = 0;
async function makeUser(overrides = {}) {
  userCounter += 1;
  return User.create({
    name: `Room Mod User ${userCounter}`,
    email: `room-mod-${userCounter}-${new mongoose.Types.ObjectId()}@example.com`,
    password: 'hashed-password-placeholder',
    birth_year: '2000',
    birth_month: '1',
    birth_day: '1',
    gender: 'other',
    native_language: 'English',
    language_to_learn: 'Spanish',
    userMode: 'regular',
    ...overrides,
  });
}

async function makeTopicRoom(owner, overrides = {}) {
  return Conversation.create({
    roomType: 'topic',
    targetLanguage: 'es',
    title: 'Travel Talk',
    owner: owner._id,
    participants: [owner._id],
    memberCount: 1,
    isPublic: true,
    isSeeded: false,
    ...overrides,
  });
}

function mockReq({ user, params = {}, body = {} } = {}) {
  return {
    user,
    params,
    body,
    app: { get: () => undefined }, // no live socket.io in this sandbox
  };
}

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function callController(fn, req) {
  const res = mockRes();
  let nextError = null;
  await fn(req, res, (err) => { if (err) nextError = err; });
  return { res, error: nextError };
}

// ---------------------------------------------------------------------------
// kick -> ban -> rejoin blocked
// ---------------------------------------------------------------------------

test('removeMember bans a topic-room member on kick, and joinRoom then rejects their rejoin as BANNED_FROM_ROOM', async () => {
  const owner = await makeUser();
  const member = await makeUser();
  const room = await makeTopicRoom(owner);

  // member joins first
  await Conversation.updateOne({ _id: room._id }, { $addToSet: { participants: member._id }, $inc: { memberCount: 1 } });

  // owner kicks member
  const kickReq = mockReq({ user: owner, params: { id: String(room._id), userId: String(member._id) } });
  const { res: kickRes, error: kickErr } = await callController(roomsController.removeMember, kickReq);
  assert.equal(kickErr, null);
  assert.equal(kickRes.statusCode, 200);
  assert.equal(kickRes.body.message, 'Member removed and banned');

  const afterKick = await Conversation.findById(room._id).lean();
  assert.equal(afterKick.participants.some((p) => p.toString() === member._id.toString()), false);
  assert.equal(afterKick.bannedUsers.some((b) => b.toString() === member._id.toString()), true);

  // banned member tries to rejoin directly -> rejected
  const joinReq = mockReq({ user: member, params: { id: String(room._id) } });
  const { res: joinRes, error: joinErr } = await callController(roomsController.joinRoom, joinReq);
  assert.equal(joinRes.body, null); // res.json never called — next(err) path instead
  assert.ok(joinErr);
  assert.equal(joinErr.statusCode, 403);
  assert.equal(joinErr.errorCode, 'BANNED_FROM_ROOM');

  const afterRejoinAttempt = await Conversation.findById(room._id).lean();
  assert.equal(afterRejoinAttempt.participants.some((p) => p.toString() === member._id.toString()), false);
});

// ---------------------------------------------------------------------------
// request-join creates a pending request, dedupes, and notifies
// ---------------------------------------------------------------------------

test('requestJoin creates a pending join request and rejects a duplicate pending request', async () => {
  const owner = await makeUser();
  const requester = await makeUser();
  const room = await makeTopicRoom(owner);

  const req1 = mockReq({ user: requester, params: { id: String(room._id) } });
  const { res: res1, error: err1 } = await callController(roomsController.requestJoin, req1);
  assert.equal(err1, null);
  assert.equal(res1.statusCode, 200);

  const afterFirst = await Conversation.findById(room._id).lean();
  assert.equal(afterFirst.joinRequests.length, 1);
  assert.equal(afterFirst.joinRequests[0].user.toString(), requester._id.toString());
  assert.equal(afterFirst.joinRequests[0].status, 'pending');

  // second request from the same user is rejected (dedupe)
  const req2 = mockReq({ user: requester, params: { id: String(room._id) } });
  const { error: err2 } = await callController(roomsController.requestJoin, req2);
  assert.ok(err2);
  assert.equal(err2.statusCode, 400);
  assert.equal(err2.errorCode, 'REQUEST_ALREADY_PENDING');

  const afterSecond = await Conversation.findById(room._id).lean();
  assert.equal(afterSecond.joinRequests.length, 1); // still just one entry
});

test('requestJoin rejects a request from an existing member', async () => {
  const owner = await makeUser();
  const room = await makeTopicRoom(owner);

  const req = mockReq({ user: owner, params: { id: String(room._id) } });
  const { error } = await callController(roomsController.requestJoin, req);
  assert.ok(error);
  assert.equal(error.statusCode, 400);
  assert.equal(error.errorCode, 'ALREADY_MEMBER');
});

test('requestJoin is allowed for a banned user (this is how a banned user asks to rejoin)', async () => {
  const owner = await makeUser();
  const banned = await makeUser();
  const room = await makeTopicRoom(owner, { bannedUsers: [] });
  await Conversation.updateOne({ _id: room._id }, { $addToSet: { bannedUsers: banned._id } });

  const req = mockReq({ user: banned, params: { id: String(room._id) } });
  const { res, error } = await callController(roomsController.requestJoin, req);
  assert.equal(error, null);
  assert.equal(res.statusCode, 200);

  const after = await Conversation.findById(room._id).lean();
  assert.equal(after.joinRequests.some((r) => r.user.toString() === banned._id.toString()), true);
});

// ---------------------------------------------------------------------------
// approve: un-bans + adds member + clears the request
// ---------------------------------------------------------------------------

test('approveJoinRequest un-bans a previously-kicked user, adds them as a member, and clears the request', async () => {
  const owner = await makeUser();
  const member = await makeUser();
  const room = await makeTopicRoom(owner);
  await Conversation.updateOne({ _id: room._id }, { $addToSet: { participants: member._id }, $inc: { memberCount: 1 } });

  // kick -> ban
  const kickReq = mockReq({ user: owner, params: { id: String(room._id), userId: String(member._id) } });
  await callController(roomsController.removeMember, kickReq);

  // member requests to rejoin
  const requestReq = mockReq({ user: member, params: { id: String(room._id) } });
  await callController(roomsController.requestJoin, requestReq);

  const before = await Conversation.findById(room._id).lean();
  assert.equal(before.bannedUsers.some((b) => b.toString() === member._id.toString()), true);
  assert.equal(before.joinRequests.length, 1);
  const memberCountBefore = before.memberCount;

  // owner approves
  const approveReq = mockReq({ user: owner, params: { id: String(room._id), userId: String(member._id) } });
  const { res: approveRes, error: approveErr } = await callController(roomsController.approveJoinRequest, approveReq);
  assert.equal(approveErr, null);
  assert.equal(approveRes.statusCode, 200);

  const after = await Conversation.findById(room._id).lean();
  assert.equal(after.bannedUsers.some((b) => b.toString() === member._id.toString()), false, 'ban cleared');
  assert.equal(after.joinRequests.length, 0, 'request cleared');
  assert.equal(after.participants.some((p) => p.toString() === member._id.toString()), true, 'member re-added');
  assert.equal(after.memberCount, memberCountBefore + 1);

  // now that they're unbanned + a member, a direct join no longer 403s
  const rejoinReq = mockReq({ user: member, params: { id: String(room._id) } });
  const { error: rejoinErr } = await callController(roomsController.joinRoom, rejoinReq);
  assert.equal(rejoinErr, null);
});

test('approveJoinRequest is idempotent when the user is already a member (no double memberCount increment)', async () => {
  const owner = await makeUser();
  const alreadyMember = await makeUser();
  const room = await makeTopicRoom(owner);
  await Conversation.updateOne(
    { _id: room._id },
    { $addToSet: { participants: alreadyMember._id, joinRequests: { user: alreadyMember._id, requestedAt: new Date(), status: 'pending' } }, $inc: { memberCount: 1 } }
  );

  const before = await Conversation.findById(room._id).lean();
  const approveReq = mockReq({ user: owner, params: { id: String(room._id), userId: String(alreadyMember._id) } });
  const { error } = await callController(roomsController.approveJoinRequest, approveReq);
  assert.equal(error, null);

  const after = await Conversation.findById(room._id).lean();
  assert.equal(after.memberCount, before.memberCount, 'no double increment for an already-member approve');
  assert.equal(after.joinRequests.length, 0, 'stale request still cleared');
});

// ---------------------------------------------------------------------------
// deny: clears the request, does NOT ban
// ---------------------------------------------------------------------------

test('denyJoinRequest clears the pending request without banning the requester', async () => {
  const owner = await makeUser();
  const requester = await makeUser();
  const room = await makeTopicRoom(owner);

  const requestReq = mockReq({ user: requester, params: { id: String(room._id) } });
  await callController(roomsController.requestJoin, requestReq);

  const denyReq = mockReq({ user: owner, params: { id: String(room._id), userId: String(requester._id) } });
  const { res, error } = await callController(roomsController.denyJoinRequest, denyReq);
  assert.equal(error, null);
  assert.equal(res.statusCode, 200);

  const after = await Conversation.findById(room._id).lean();
  assert.equal(after.joinRequests.length, 0);
  assert.equal(after.bannedUsers.length, 0, 'denial must not ban');
  assert.equal(after.participants.some((p) => p.toString() === requester._id.toString()), false);

  // requester can still directly join afterward (denial isn't a ban)
  const joinReq = mockReq({ user: requester, params: { id: String(room._id) } });
  const { error: joinErr } = await callController(roomsController.joinRoom, joinReq);
  assert.equal(joinErr, null);
});

// ---------------------------------------------------------------------------
// owner cannot be kicked/banned
// ---------------------------------------------------------------------------

test('removeMember refuses to kick the room owner, even when called by an admin', async () => {
  const owner = await makeUser();
  const admin = await makeUser();
  const room = await makeTopicRoom(owner);
  await Conversation.updateOne({ _id: room._id }, { $addToSet: { participants: admin._id, admins: admin._id }, $inc: { memberCount: 1 } });

  const kickOwnerReq = mockReq({ user: admin, params: { id: String(room._id), userId: String(owner._id) } });
  const { error } = await callController(roomsController.removeMember, kickOwnerReq);
  assert.ok(error);
  assert.equal(error.statusCode, 400);
  assert.equal(error.errorCode, 'CANNOT_KICK_OWNER');

  const after = await Conversation.findById(room._id).lean();
  assert.equal(after.participants.some((p) => p.toString() === owner._id.toString()), true);
  assert.equal(after.bannedUsers.length, 0);
});

// ---------------------------------------------------------------------------
// non-admin cannot approve / deny / list requests
// ---------------------------------------------------------------------------

test('a regular (non-admin) member cannot approve, deny, or list join requests', async () => {
  const owner = await makeUser();
  const regularMember = await makeUser();
  const requester = await makeUser();
  const room = await makeTopicRoom(owner);
  await Conversation.updateOne({ _id: room._id }, { $addToSet: { participants: regularMember._id }, $inc: { memberCount: 1 } });

  const requestReq = mockReq({ user: requester, params: { id: String(room._id) } });
  await callController(roomsController.requestJoin, requestReq);

  const listReq = mockReq({ user: regularMember, params: { id: String(room._id) } });
  const { error: listErr } = await callController(roomsController.getJoinRequests, listReq);
  assert.ok(listErr);
  assert.equal(listErr.statusCode, 403);

  const approveReq = mockReq({ user: regularMember, params: { id: String(room._id), userId: String(requester._id) } });
  const { error: approveErr } = await callController(roomsController.approveJoinRequest, approveReq);
  assert.ok(approveErr);
  assert.equal(approveErr.statusCode, 403);

  const denyReq = mockReq({ user: regularMember, params: { id: String(room._id), userId: String(requester._id) } });
  const { error: denyErr } = await callController(roomsController.denyJoinRequest, denyReq);
  assert.ok(denyErr);
  assert.equal(denyErr.statusCode, 403);

  // request is untouched by the failed attempts
  const after = await Conversation.findById(room._id).lean();
  assert.equal(after.joinRequests.length, 1);
});

// ---------------------------------------------------------------------------
// getRoom/getRooms viewer-facing fields — isBanned / hasPendingRequest /
// pendingRequestCount, and the raw arrays are never leaked
// ---------------------------------------------------------------------------

test('getRoom exposes isBanned/hasPendingRequest to the viewer and pendingRequestCount only to the owner, never the raw arrays', async () => {
  const owner = await makeUser();
  const banned = await makeUser();
  const requester = await makeUser();
  const room = await makeTopicRoom(owner);
  await Conversation.updateOne({ _id: room._id }, { $addToSet: { bannedUsers: banned._id } });

  const requestReq = mockReq({ user: requester, params: { id: String(room._id) } });
  await callController(roomsController.requestJoin, requestReq);

  // banned viewer
  const bannedViewReq = mockReq({ user: banned, params: { id: String(room._id) } });
  const { res: bannedRes } = await callController(roomsController.getRoom, bannedViewReq);
  assert.equal(bannedRes.body.data.isBanned, true);
  assert.equal(bannedRes.body.data.hasPendingRequest, false);
  assert.equal(bannedRes.body.data.pendingRequestCount, undefined, 'non-admin must not see pendingRequestCount');
  assert.equal(bannedRes.body.data.bannedUsers, undefined, 'raw bannedUsers must never be serialized');
  assert.equal(bannedRes.body.data.joinRequests, undefined, 'raw joinRequests must never be serialized');

  // requester viewer
  const requesterViewReq = mockReq({ user: requester, params: { id: String(room._id) } });
  const { res: requesterRes } = await callController(roomsController.getRoom, requesterViewReq);
  assert.equal(requesterRes.body.data.isBanned, false);
  assert.equal(requesterRes.body.data.hasPendingRequest, true);

  // owner viewer
  const ownerViewReq = mockReq({ user: owner, params: { id: String(room._id) } });
  const { res: ownerRes } = await callController(roomsController.getRoom, ownerViewReq);
  assert.equal(ownerRes.body.data.isBanned, false);
  assert.equal(ownerRes.body.data.pendingRequestCount, 1, 'owner sees the pending count');
  assert.equal(ownerRes.body.data.bannedUsers, undefined);
  assert.equal(ownerRes.body.data.joinRequests, undefined);
});
