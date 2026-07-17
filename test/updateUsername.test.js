const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveEditUsername } = require('../controllers/users');

test('absent username => undefined (no change)', async () => {
  assert.equal(await resolveEditUsername(undefined, 'me', { existsOther: async () => false }), undefined);
});
test('own unchanged username ok (excludes self)', async () => {
  assert.equal(await resolveEditUsername('MyName', 'me', { existsOther: async (u, id) => false }), 'myname');
});
test('taken by another throws USERNAME_TAKEN', async () => {
  await assert.rejects(() => resolveEditUsername('taken', 'me', { existsOther: async () => true }), (e) => e.code === 'USERNAME_TAKEN');
});
test('invalid throws USERNAME_INVALID', async () => {
  await assert.rejects(() => resolveEditUsername('a b', 'me', { existsOther: async () => false }), (e) => e.code === 'USERNAME_INVALID');
});
