const test = require('node:test');
const assert = require('node:assert/strict');
const { hash, compare } = require('../utils/password');

test('hash + compare round-trip works', async () => {
  const h = await hash('s3cret!');
  assert.notEqual(h, 's3cret!');
  assert.ok(h.startsWith('$2'));
  assert.equal(await compare('s3cret!', h), true);
  assert.equal(await compare('wrong', h), false);
});
