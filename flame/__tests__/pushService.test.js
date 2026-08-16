const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  delete process.env.FLAME_FIREBASE_PROJECT_ID;
  delete process.env.FLAME_FIREBASE_SERVICE_ACCOUNT;
  // utils/s3 throws at module load without these, and chatService (pulled in
  // through conversationControlsService) requires it via matchService/userService.
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  [
    '../db', '../models/User', '../models/Swipe', '../models/Match',
    '../models/Conversation', '../models/Message',
    '../services/chatService', '../services/matchService', '../services/discoveryService',
    '../services/visibilityService', '../services/conversationControlsService',
    '../services/pushService',
  ].forEach((p) => {
    try { delete require.cache[require.resolve(p)]; } catch {}
  });
  const { connect } = require('../db');
  await connect();
  return {
    User: require('../models/User'),
    Conversation: require('../models/Conversation'),
    conversationControls: require('../services/conversationControlsService'),
    pushService: require('../services/pushService'),
  };
}

async function teardown() {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
}

async function makeUser(User, overrides = {}) {
  return User.create({
    email: `${Math.random().toString(36).slice(2)}@x.com`,
    passwordHash: 'hash',
    name: 'Test User',
    age: 25,
    gender: 'female',
    lookingFor: 'male',
    fcmTokens: [
      { token: 'tok-1', platform: 'ios', deviceId: 'dev-1', active: true },
    ],
    ...overrides,
  });
}

test('isConfigured() is false when FLAME_FIREBASE_PROJECT_ID is unset', async (t) => {
  const { pushService } = await setup();
  t.after(teardown);
  assert.equal(pushService.isConfigured(), false);
});

test('sendToUser never throws and returns {skipped:true} when unconfigured', async (t) => {
  const { User, pushService } = await setup();
  t.after(teardown);
  const user = await makeUser(User);

  const result = await pushService.sendToUser(user._id.toString(), {
    title: 'Hi',
    body: 'there',
    data: { foo: 'bar' },
  });

  assert.equal(result.skipped, true);
  assert.equal(result.sent, 0);
});

test('sendToUser never throws for a missing user', async (t) => {
  const { pushService } = await setup();
  t.after(teardown);

  const result = await pushService.sendToUser('0123456789abcdef01234567', {
    title: 'Hi',
    body: 'there',
  });

  assert.equal(result.skipped, true);
  assert.equal(result.sent, 0);
});

test('sendToUser never throws for a user with no tokens', async (t) => {
  const { User, pushService } = await setup();
  t.after(teardown);
  const user = await makeUser(User, { fcmTokens: [] });

  const result = await pushService.sendToUser(user._id.toString(), {
    title: 'Hi',
    body: 'there',
  });

  assert.equal(result.skipped, true);
  assert.equal(result.sent, 0);
});

test('sendChatMessage is skipped (unconfigured) for a normal user, no throw', async (t) => {
  const { User, pushService } = await setup();
  t.after(teardown);
  const user = await makeUser(User);

  const result = await pushService.sendChatMessage(user._id.toString(), {
    senderName: 'Alice',
    text: 'hello there',
    conversationId: 'conv-1',
  });

  assert.equal(result.skipped, true);
});

test('sendChatMessage respects notificationSettings.chatMessages=false (skipped deterministically)', async (t) => {
  const { User, pushService } = await setup();
  t.after(teardown);
  const user = await makeUser(User, {
    notificationSettings: { chatMessages: false },
  });

  const result = await pushService.sendChatMessage(user._id.toString(), {
    senderName: 'Alice',
    text: 'hello there',
    conversationId: 'conv-1',
  });

  assert.equal(result.skipped, true);
});

test('sendChatMessage respects notificationSettings.enabled=false (skipped via sendToUser gate)', async (t) => {
  const { User, pushService } = await setup();
  t.after(teardown);
  const user = await makeUser(User, {
    notificationSettings: { enabled: false },
  });

  const result = await pushService.sendChatMessage(user._id.toString(), {
    senderName: 'Alice',
    text: 'hello there',
    conversationId: 'conv-1',
  });

  assert.equal(result.skipped, true);
});

test('sendChatMessage is skipped with muted:true when the conversation is muted for the receiver', async (t) => {
  const {
    User, Conversation, conversationControls, pushService,
  } = await setup();
  t.after(teardown);
  const receiver = await makeUser(User);
  const sender = await makeUser(User);
  const conv = await Conversation.create({
    participants: [receiver._id.toString(), sender._id.toString()],
    unreadCount: [],
  });
  const convId = conv._id.toString();
  const receiverId = receiver._id.toString();

  await conversationControls.mute(receiverId, convId);

  const result = await pushService.sendChatMessage(receiverId, {
    senderName: 'Alice',
    text: 'hello there',
    conversationId: convId,
  });

  assert.equal(result.skipped, true);
  assert.equal(result.muted, true, 'the skip must be distinguishable as a mute, not just "unconfigured"');
});

test('sendChatMessage for an unmuted conversation is skipped (unconfigured) without the muted flag (control)', async (t) => {
  const {
    User, Conversation, pushService,
  } = await setup();
  t.after(teardown);
  const receiver = await makeUser(User);
  const sender = await makeUser(User);
  const conv = await Conversation.create({
    participants: [receiver._id.toString(), sender._id.toString()],
    unreadCount: [],
  });
  const convId = conv._id.toString();
  const receiverId = receiver._id.toString();

  const result = await pushService.sendChatMessage(receiverId, {
    senderName: 'Alice',
    text: 'hello there',
    conversationId: convId,
  });

  assert.equal(result.skipped, true);
  assert.ok(!result.muted, 'an unmuted conversation must not be reported as muted');
});

test('sendChatMessage never throws for a missing receiver', async (t) => {
  const { pushService } = await setup();
  t.after(teardown);

  const result = await pushService.sendChatMessage('0123456789abcdef01234567', {
    senderName: 'Alice',
    text: 'hello there',
    conversationId: 'conv-1',
  });

  assert.equal(result.skipped, true);
});
