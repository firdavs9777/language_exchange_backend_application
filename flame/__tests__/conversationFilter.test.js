// Stub Flame's S3 util so tests don't hit DigitalOcean.
require.cache[require.resolve('../utils/s3')] = {
  exports: {
    uploadBuffer: async (_buf, key) => `https://stub.example.com/${key}`,
    deleteObject: async () => {},
    bucket: 'stub-bucket',
  },
};

const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

// conversationFilterFor is extracted from listConversations so message search
// can REUSE the exclusion rule rather than copy it. Copying is what let the
// media send path drift from the text send path last phase; here the copy that
// drifted would be the one keeping blocked people out of results.
//
// These tests pin the filter's shape directly, and the last one pins the thing
// that actually matters: the extraction changed nothing.

async function setup(t) {
  await dbHelper.start();
  t.after(async () => {
    try { await require('../db').close(); } catch { /* never opened */ }
    await dbHelper.stop();
  });

  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  [
    '../db', '../models/User', '../models/Conversation', '../models/Message',
    '../models/Swipe', '../models/Match',
    '../services/visibilityService', '../services/chatService',
    '../services/matchService', '../services/userService',
  ].forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  return {
    chatService: require('../services/chatService'),
    User: require('../models/User'),
    Conversation: require('../models/Conversation'),
    Match: require('../models/Match'),
  };
}

// Names are >=2 characters: User.name has minlength 2, and a shorter one throws
// before the test body finishes, leaking the mongod.
let seq = 0;
async function makeUser(User, name) {
  seq += 1;
  return User.create({
    email: `u${seq}@x.com`, passwordHash: 'x'.repeat(20), name,
    age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
  });
}

async function makeConversation(Conversation, a, b) {
  return Conversation.create({
    participants: [a, b],
    unreadCount: [{ user: a, count: 0 }, { user: b, count: 0 }],
  });
}

test('with no blocks or ended matches the filter is the plain participant one', async (t) => {
  const { chatService, User } = await setup(t);
  const me = await makeUser(User, 'Me');

  const filter = await chatService.conversationFilterFor(me.id);

  assert.equal(filter.participants, me.id);
  assert.deepEqual(filter['archivedBy.user'], { $ne: me.id });
});

test('a blocked partner lands in $nin, and I stay in $all', async (t) => {
  const { chatService, User } = await setup(t);
  const me = await makeUser(User, 'Me');
  const them = await makeUser(User, 'Them');

  await User.updateOne(
    { _id: me.id },
    { $push: { blockedUsers: { user: them.id, blockedAt: new Date() } } },
  );

  const filter = await chatService.conversationFilterFor(me.id);

  assert.deepEqual(filter.participants.$nin, [them.id]);
  assert.deepEqual(filter.participants.$all, [me.id],
    'dropping $all would return conversations I am not even in');
});

test('an ended-match partner lands in the same $nin', async (t) => {
  const { chatService, User, Conversation, Match } = await setup(t);
  const me = await makeUser(User, 'Me');
  const them = await makeUser(User, 'Them');

  const conv = await makeConversation(Conversation, me.id, them.id);
  await Match.create({
    users: [me.id, them.id], conversationId: conv.id, endedBy: me.id,
  });

  const filter = await chatService.conversationFilterFor(me.id);

  assert.deepEqual(filter.participants.$nin, [them.id]);
});

test('someone both blocked and unmatched appears once', async (t) => {
  const { chatService, User, Conversation, Match } = await setup(t);
  const me = await makeUser(User, 'Me');
  const them = await makeUser(User, 'Them');

  await User.updateOne(
    { _id: me.id },
    { $push: { blockedUsers: { user: them.id, blockedAt: new Date() } } },
  );
  const conv = await makeConversation(Conversation, me.id, them.id);
  await Match.create({
    users: [me.id, them.id], conversationId: conv.id, endedBy: me.id,
  });

  const filter = await chatService.conversationFilterFor(me.id);

  assert.deepEqual(filter.participants.$nin, [them.id],
    'the two id sets are unioned, not concatenated');
});

test('archived: true inverts the condition rather than dropping it', async (t) => {
  const { chatService, User } = await setup(t);
  const me = await makeUser(User, 'Me');

  const filter = await chatService.conversationFilterFor(me.id, { archived: true });

  assert.equal(filter['archivedBy.user'], me.id,
    'dropping it would make the archived list show everything');
});

test("archived: 'any' omits the archive condition but keeps the exclusions", async (t) => {
  const { chatService, User } = await setup(t);
  const me = await makeUser(User, 'Me');
  const them = await makeUser(User, 'Them');

  await User.updateOne(
    { _id: me.id },
    { $push: { blockedUsers: { user: them.id, blockedAt: new Date() } } },
  );

  // Search spans both sides of the archive line — an archived conversation is
  // still mine to search — and must do it in ONE call rather than running the
  // block and ended-match lookups twice.
  const filter = await chatService.conversationFilterFor(me.id, { archived: 'any' });

  assert.equal('archivedBy.user' in filter, false);
  assert.deepEqual(filter.participants.$nin, [them.id],
    'spanning the archive line must not relax the block exclusion');
});

test('the filter selects exactly what listConversations returns', async (t) => {
  const { chatService, User, Conversation, Match } = await setup(t);
  const me = await makeUser(User, 'Me');
  const normal = await makeUser(User, 'Normal');
  const blocked = await makeUser(User, 'Blocked');
  const ended = await makeUser(User, 'Ended');

  await makeConversation(Conversation, me.id, normal.id);
  await makeConversation(Conversation, me.id, blocked.id);
  const endedConv = await makeConversation(Conversation, me.id, ended.id);

  await User.updateOne(
    { _id: me.id },
    { $push: { blockedUsers: { user: blocked.id, blockedAt: new Date() } } },
  );
  await Match.create({
    users: [me.id, ended.id], conversationId: endedConv.id, endedBy: me.id,
  });

  const filter = await chatService.conversationFilterFor(me.id);
  const viaFilter = await Conversation.find(filter).select('_id');

  const { conversations } = await chatService.listConversations(me.id, {
    limit: 50, offset: 0,
  });

  // This is the assertion that proves the extraction changed nothing.
  assert.deepEqual(
    viaFilter.map((c) => c._id.toString()).sort(),
    conversations.map((c) => c.id).sort(),
  );
  assert.equal(conversations.length, 1, 'only the un-blocked, still-matched one');
});
