/**
 * TTL index safety.
 *
 * A TTL index deletes the DOCUMENT its indexed path belongs to. When that
 * path sits inside a subdocument array, the document is the PARENT — so
 * `expires` on an array element silently destroys the whole record.
 *
 * That is not hypothetical: `refreshTokens.createdAt` carried
 * `expires: 30 days`, which Mongoose compiled into a TTL index on the users
 * collection. It deleted user accounts 30 days after their oldest surviving
 * refresh token — 1,489 accounts lost, with no audit trail, because the
 * deletions never passed through application code.
 *
 * These tests fail if that pattern is reintroduced anywhere.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const MODELS_DIR = path.join(__dirname, '..', 'models');

function loadModels(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { loadModels(full); continue; }
    if (!entry.name.endsWith('.js')) continue;
    try { require(full); } catch (_) { /* model needs runtime deps — skip */ }
  }
}

/**
 * Walk a dotted index path and report the prefix at which it enters a
 * subdocument array, or null if it never does.
 */
function documentArrayPrefix(schema, dottedPath) {
  const parts = dottedPath.split('.');
  for (let i = 1; i < parts.length; i++) {
    const prefix = parts.slice(0, i).join('.');
    const p = schema.path(prefix);
    if (p && (p.$isMongooseDocumentArray || p.instance === 'DocumentArray')) {
      return prefix;
    }
  }
  return null;
}

test('no model declares a TTL index on a path inside a subdocument array', () => {
  loadModels(MODELS_DIR);
  const offenders = [];

  for (const name of mongoose.modelNames()) {
    const schema = mongoose.model(name).schema;
    for (const [keys, options] of schema.indexes()) {
      if (!options || options.expireAfterSeconds === undefined) continue;
      for (const keyPath of Object.keys(keys)) {
        const arrayPrefix = documentArrayPrefix(schema, keyPath);
        if (arrayPrefix) {
          offenders.push(
            `${name}.${keyPath} — TTL on an element of the "${arrayPrefix}" array; ` +
            `this deletes the entire ${name} document, not the array element`
          );
        }
      }
    }
  }

  assert.deepStrictEqual(
    offenders, [],
    'TTL index would delete parent documents:\n  ' + offenders.join('\n  ')
  );
});

test('User schema declares no TTL index at all', () => {
  const User = require('../models/User');
  const ttl = User.schema.indexes().filter(
    ([, o]) => o && o.expireAfterSeconds !== undefined
  );
  assert.deepStrictEqual(
    ttl.map(([k]) => k), [],
    'A TTL index on users deletes user accounts. Expire tokens in application code instead.'
  );
});

test('refreshTokens.createdAt carries no `expires` option', () => {
  const User = require('../models/User');
  const createdAt = User.schema.path('refreshTokens').schema.path('createdAt');
  assert.strictEqual(
    createdAt.options.expires, undefined,
    '`expires` here becomes a TTL index on the users collection and deletes accounts'
  );
});

test('generateRefreshToken prunes tokens past their lifetime', () => {
  const User = require('../models/User');
  const user = new User({ name: 'ttl test', email: 'ttl-safety@example.test' });

  const DAY = 24 * 60 * 60 * 1000;
  user.refreshTokens.push(
    { token: 'stale', createdAt: new Date(Date.now() - 40 * DAY) },
    { token: 'fresh', createdAt: new Date(Date.now() - 5 * DAY) }
  );

  user.generateRefreshToken({ device: 'test' });

  const remaining = user.refreshTokens.map((t) => t.token);
  assert.ok(!remaining.includes('stale'), 'token older than 30 days should be pruned');
  assert.ok(remaining.includes('fresh'), 'token within 30 days should be kept');
  assert.strictEqual(user.refreshTokens.length, 2, 'fresh token plus the newly issued one');
});

test('generateRefreshToken still caps stored devices at 5', () => {
  const User = require('../models/User');
  const user = new User({ name: 'cap test', email: 'ttl-cap@example.test' });

  for (let i = 0; i < 7; i++) {
    user.refreshTokens.push({ token: `t${i}`, createdAt: new Date() });
  }
  user.generateRefreshToken({ device: 'test' });

  assert.strictEqual(user.refreshTokens.length, 5);
});
