const test = require('node:test');
const assert = require('node:assert');
const { parseMentions } = require('../controllers/stories');

test('parseMentions caps at 5 and clamps position', () => {
  const raw = JSON.stringify(
    Array.from({ length: 7 }, (_, i) => ({
      user: `64b7f0000000000000000${i}0a`,
      x: 150,
      y: -20,
    }))
  );
  const parsed = parseMentions(raw);
  assert.strictEqual(parsed.length, 5);
  assert.strictEqual(parsed[0].position.x, 100);
  assert.strictEqual(parsed[0].position.y, 0);
});

test('parseMentions returns [] on malformed input', () => {
  assert.deepStrictEqual(parseMentions('not-json'), []);
  assert.deepStrictEqual(parseMentions(undefined), []);
  assert.deepStrictEqual(parseMentions(JSON.stringify({ nope: 1 })), []);
});

test('parseMentions drops entries with invalid ObjectIds', () => {
  const raw = JSON.stringify([
    { user: 'garbage-not-an-id', x: 10, y: 10 },
    { user: '64b7f00000000000000000aa', x: 10, y: 10 },
  ]);
  const parsed = parseMentions(raw);
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].user, '64b7f00000000000000000aa');
});
