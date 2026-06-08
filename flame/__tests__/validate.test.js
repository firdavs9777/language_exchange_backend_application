const test = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { ValidationError } = require('../utils/errors');

test('validate.body passes valid input and assigns parsed value', () => {
  const mw = validate.body(z.object({ name: z.string() }));
  const req = { body: { name: 'Ada', extra: 'ignored' } };
  let nextCalled = false;
  mw(req, {}, (err) => { if (err) throw err; nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.body, { name: 'Ada' });  // zod strips extras
});

test('validate.body forwards ValidationError to next() on invalid input', () => {
  const mw = validate.body(z.object({ name: z.string() }));
  const req = { body: { name: 123 } };
  let captured;
  mw(req, {}, (err) => { captured = err; });
  assert.ok(captured instanceof ValidationError);
});

test('validate.query parses query params', () => {
  const mw = validate.query(z.object({ page: z.coerce.number().int().positive() }));
  const req = { query: { page: '3' } };
  mw(req, {}, () => {});
  assert.equal(req.query.page, 3);
});
