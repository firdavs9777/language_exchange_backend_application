const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  ['../db', '../models/Message'].forEach(p => {
    try { delete require.cache[require.resolve(p)]; } catch {}
  });
  const { connect } = require('../db');
  await connect();
  return require('../models/Message');
}

const teardown = (t) => t.after(async () => {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
});

test('every media kind is an accepted messageType', async (t) => {
  const Message = await setup();
  teardown(t);

  for (const kind of ['text', 'image', 'video', 'audio', 'voice']) {
    const m = await Message.create({
      conversationId: 'c1', sender: 'a', receiver: 'b', messageType: kind,
    });
    assert.equal(m.messageType, kind);
  }
});

test('an unknown messageType is still rejected', async (t) => {
  const Message = await setup();
  teardown(t);

  await assert.rejects(() => Message.create({
    conversationId: 'c1', sender: 'a', receiver: 'b', messageType: 'hologram',
  }));
});

test('media fields default to null so text messages stay unchanged', async (t) => {
  const Message = await setup();
  teardown(t);

  const m = await Message.create({
    conversationId: 'c1', sender: 'a', receiver: 'b', text: 'hi',
  });
  assert.equal(m.messageType, 'text');
  assert.equal(m.mediaUrl, null);
  assert.equal(m.thumbnailUrl, null);
  assert.equal(m.durationSeconds, null);
});
