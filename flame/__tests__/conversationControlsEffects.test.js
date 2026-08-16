// Task 9: archive filters listConversations (per-user, on the conversation
// itself); mute keeps the conversation listed and unread — it only silences
// the push (covered separately in pushService.test.js).
//
// archivedBy has no route yet (by design), so every test here archives by
// writing the subdocument directly via the Conversation model, the same way
// conversationControls.test.js reaches into mutedBy for the expired-mute case.
const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  // utils/s3 throws at module load without these, and userService requires it.
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  [
    '../db', '../models/User', '../models/Swipe', '../models/Match',
    '../models/Conversation', '../models/Message',
    '../services/chatService', '../services/userService', '../services/swipeService',
    '../services/matchService', '../services/discoveryService',
    '../services/visibilityService', '../services/blockService',
    '../services/conversationControlsService',
  ].forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  const User = require('../models/User');
  // Names are two characters: flame/models/User.js enforces minlength 2, and a
  // throw here would happen before the teardown hook registers.
  const mk = (email, name) => User.create({
    email, name, age: 30, gender: 'other', lookingFor: 'other', passwordHash: 'x',
  });

  return {
    mk,
    chatService: require('../services/chatService'),
    conversationControls: require('../services/conversationControlsService'),
    blockService: require('../services/blockService'),
    matchService: require('../services/matchService'),
    swipeService: require('../services/swipeService'),
    Conversation: require('../models/Conversation'),
  };
}

const teardown = (t) => t.after(async () => {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
});

async function archiveFor(Conversation, convId, userId) {
  await Conversation.updateOne(
    { _id: convId },
    { $push: { archivedBy: { user: userId, archivedAt: new Date() } } },
  );
}

test('listConversations excludes a conversation the caller archived, and still includes it for the other participant', async (t) => {
  const { chatService, Conversation, mk } = await setup();
  teardown(t);

  const a = (await mk('a@x.com', 'Aa'))._id.toString();
  const b = (await mk('b@x.com', 'Bb'))._id.toString();
  const conv = await chatService.openConversation(a, b);

  await archiveFor(Conversation, conv.id, a);

  const mine = await chatService.listConversations(a, { limit: 20, offset: 0 });
  assert.equal(mine.conversations.length, 0, 'archived conversation must not appear for the archiver');
  assert.equal(mine.total, 0);

  const theirs = await chatService.listConversations(b, { limit: 20, offset: 0 });
  assert.equal(theirs.conversations.length, 1, 'archiving is per-user — the other participant still sees it');
  assert.equal(theirs.conversations[0].id, conv.id);
});

test('archiving does not disturb the existing block / ended-match exclusions', async (t) => {
  const {
    chatService, Conversation, blockService, matchService, swipeService, mk,
  } = await setup();
  teardown(t);

  const a = (await mk('a@x.com', 'Aa'))._id.toString();
  const archivedPartner = (await mk('arch@x.com', 'Ar'))._id.toString();
  const blockedPartner = (await mk('blk@x.com', 'Bl'))._id.toString();
  const endedPartner = (await mk('end@x.com', 'En'))._id.toString();
  const normalPartner = (await mk('nrm@x.com', 'No'))._id.toString();

  const convArchived = await chatService.openConversation(a, archivedPartner);
  await chatService.openConversation(a, blockedPartner);
  const convEnded = await chatService.openConversation(a, endedPartner);
  const convNormal = await chatService.openConversation(a, normalPartner);

  await archiveFor(Conversation, convArchived.id, a);
  await blockService.block(a, blockedPartner);
  await swipeService.record(a, endedPartner, 'like');
  const res = await swipeService.record(endedPartner, a, 'like');
  await matchService.unmatch(a, res.match.id);
  void convEnded;

  const { conversations, total } = await chatService.listConversations(a, { limit: 20, offset: 0 });
  assert.equal(conversations.length, 1, 'only the untouched conversation should survive all three filters');
  assert.equal(conversations[0].id, convNormal.id);
  assert.equal(total, 1);
});

test('countDocuments and find agree on the filtered total, independent of the page size', async (t) => {
  const { chatService, Conversation, mk } = await setup();
  teardown(t);

  const a = (await mk('a@x.com', 'Aa'))._id.toString();
  const keep1 = (await mk('k1@x.com', 'K1'))._id.toString();
  const keep2 = (await mk('k2@x.com', 'K2'))._id.toString();
  const dropped = (await mk('drp@x.com', 'Dr'))._id.toString();

  await chatService.openConversation(a, keep1);
  await chatService.openConversation(a, keep2);
  const convDropped = await chatService.openConversation(a, dropped);
  await archiveFor(Conversation, convDropped.id, a);

  // Full page: total must equal the returned length once the archived one is
  // filtered out of both countDocuments and find.
  const full = await chatService.listConversations(a, { limit: 20, offset: 0 });
  assert.equal(full.total, 2);
  assert.equal(full.conversations.length, 2);

  // Paginated: total still reflects the filtered count (2), not the raw
  // participant match (3) and not the page size (1) — this is what would
  // drift if the archive condition were applied to only one of the two
  // queries sharing the filter object.
  const paged = await chatService.listConversations(a, { limit: 1, offset: 0 });
  assert.equal(paged.total, 2, 'total must stay 2 regardless of page size');
  assert.equal(paged.conversations.length, 1, 'the page itself is still limited to 1');
});

test('a muted conversation still appears in the list and still accrues unread', async (t) => {
  const {
    chatService, conversationControls, mk,
  } = await setup();
  teardown(t);

  const a = (await mk('a@x.com', 'Aa'))._id.toString();
  const b = (await mk('b@x.com', 'Bb'))._id.toString();
  const conv = await chatService.openConversation(a, b);

  await conversationControls.mute(a, conv.id);

  await chatService.sendMessage(b, conv.id, { text: 'hi while muted' });

  const { conversations } = await chatService.listConversations(a, { limit: 20, offset: 0 });
  assert.equal(conversations.length, 1, 'a muted conversation must still be listed');
  assert.equal(conversations[0].id, conv.id);
  assert.equal(conversations[0].unread_count, 1, 'muting must not stop unread counting');
});
