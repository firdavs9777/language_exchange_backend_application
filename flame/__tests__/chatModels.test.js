const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  ['../db', '../models/Conversation', '../models/Message'].forEach((p) => {
    try { delete require.cache[require.resolve(p)]; } catch {}
  });
  const { connect } = require('../db');
  await connect();
  return {
    Conversation: require('../models/Conversation'),
    Message: require('../models/Message'),
  };
}
async function teardown() {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
}

test('Conversation stores two string participants with defaults', async (t) => {
  const { Conversation } = await setup();
  t.after(teardown);

  const c = await Conversation.create({
    participants: ['a1', 'b2'],
    unreadCount: [{ user: 'a1', count: 0 }, { user: 'b2', count: 0 }],
  });
  assert.deepEqual(c.participants, ['a1', 'b2']);
  assert.equal(c.lastMessage, null);
  assert.equal(c.lastMessageAt, null);
  assert.equal(c.unreadCount.length, 2);
  assert.ok(c.createdAt instanceof Date);
});

test('Message defaults: type text, unread, no reactions', async (t) => {
  const { Message } = await setup();
  t.after(teardown);

  const m = await Message.create({
    conversationId: 'c1', sender: 'a1', receiver: 'b2', text: 'hi',
  });
  assert.equal(m.messageType, 'text');
  assert.equal(m.read, false);
  assert.equal(m.readAt, null);
  assert.deepEqual(m.reactions, []);
  assert.equal(m.isDeleted, false);
  assert.equal(m.text, 'hi');
  assert.ok(m.createdAt instanceof Date);
});
