const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  delete process.env.FLAME_FIREBASE_PROJECT_ID;
  delete process.env.FLAME_FIREBASE_SERVICE_ACCOUNT;
  ['../db', '../models/User', '../services/pushService'].forEach((p) => {
    try { delete require.cache[require.resolve(p)]; } catch {}
  });
  const { connect } = require('../db');
  await connect();
  return {
    User: require('../models/User'),
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
