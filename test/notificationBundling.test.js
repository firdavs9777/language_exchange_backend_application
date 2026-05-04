const test = require('node:test');
const assert = require('node:assert/strict');
const { collect, _flushNow, _reset } = require('../services/notificationBundlingService');

test('emits a single push after window for 5 likes', async () => {
  _reset();
  const dispatched = [];
  const dispatcher = (payload) => { dispatched.push(payload); return Promise.resolve(); };

  for (let i = 0; i < 5; i++) {
    await collect('user1', 'moment_like', { momentId: 'm1', actorId: `actor${i}`, actorName: `A${i}` }, dispatcher);
  }
  await _flushNow('user1', 'moment_like', 'm1', dispatcher);

  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].count, 5);
  assert.equal(dispatched[0].actorIds.length, 5);
});

test('non-bundleable types pass through immediately', async () => {
  _reset();
  const dispatched = [];
  await collect('user1', 'chat_message', { actorName: 'X', message: 'hi' },
    (p) => { dispatched.push(p); return Promise.resolve(); });
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].count, 1);
});

test('different bundle keys do not coalesce', async () => {
  _reset();
  const dispatched = [];
  const dispatcher = (p) => { dispatched.push(p); return Promise.resolve(); };
  await collect('user1', 'moment_like', { momentId: 'm1', actorName: 'A' }, dispatcher);
  await collect('user1', 'moment_like', { momentId: 'm2', actorName: 'B' }, dispatcher);
  await _flushNow('user1', 'moment_like', 'm1', dispatcher);
  await _flushNow('user1', 'moment_like', 'm2', dispatcher);
  assert.equal(dispatched.length, 2);
});
