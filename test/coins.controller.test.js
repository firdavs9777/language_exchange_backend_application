/**
 * Coins v1 — controller decision unit tests (Task 5).
 *
 * Covers the pure controller-decision helpers exported by controllers/coins.js
 * (featureKey validation -> 404/400, insufficient -> 402 mapping is exercised
 * via the ledger contract, productId -> coins resolution, visitor gating,
 * verify-purchase input validation, transaction cursor query, limit clamping).
 *
 * DB-level money guarantees (balance-guarded debit, credit idempotency) are
 * covered by test/coinLedger.integration.test.js — not re-tested here.
 *
 * Run: ~/.nvm/versions/node/v24.18.0/bin/node --experimental-test-module-mocks \
 *        --test test/coins.controller.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { _helpers, coinsEnabledGuard } = require('../controllers/coins');
const {
  isVisitor,
  clampLimit,
  parseOffset,
  buildTransactionsQuery,
  validateVerifyInput,
  resolvePurchaseCoins,
  resolveUnlockRequest,
} = _helpers;

// ---------------------------------------------------------------- visitor gate
test('isVisitor: only visitor userMode is blocked from purchase/unlock', () => {
  assert.equal(isVisitor({ userMode: 'visitor' }), true);
  assert.equal(isVisitor({ userMode: 'regular' }), false);
  assert.equal(isVisitor({ userMode: 'vip' }), false);
  assert.equal(isVisitor(null), false);
  assert.equal(isVisitor(undefined), false);
});

// ------------------------------------------------------------- unlock decision
test('resolveUnlockRequest: known featureKey returns its catalog cost/grant', () => {
  assert.deepEqual(resolveUnlockRequest('translation'), { ok: true, cost: 50, grant: 10 });
  assert.deepEqual(resolveUnlockRequest('moment'), { ok: true, cost: 40, grant: 3 });
  for (const chip of ['chat', 'roleplay', 'story', 'photo', 'pronunciation']) {
    const d = resolveUnlockRequest(chip);
    assert.equal(d.ok, true, `chip ${chip} should resolve`);
    assert.equal(d.cost, 80);
    assert.equal(d.grant, 3);
  }
});

test('resolveUnlockRequest: unknown featureKey -> 404', () => {
  const d = resolveUnlockRequest('tutor'); // generic bucket is NOT a real key
  assert.equal(d.ok, false);
  assert.equal(d.status, 404);
  const d2 = resolveUnlockRequest('nonsense');
  assert.equal(d2.status, 404);
});

test('resolveUnlockRequest: missing/blank featureKey -> 400', () => {
  for (const bad of [undefined, null, '', 123, {}]) {
    const d = resolveUnlockRequest(bad);
    assert.equal(d.ok, false);
    assert.equal(d.status, 400, `input ${JSON.stringify(bad)} should be 400`);
  }
});

// --------------------------------------------------- verify-purchase resolution
test('resolvePurchaseCoins: maps per-platform productId -> coin amount', () => {
  assert.equal(resolvePurchaseCoins('ios', 'com.bananatalk.bananatalkApp.coins.100'), 100);
  assert.equal(resolvePurchaseCoins('android', 'com.bananatalk.app.coins.500'), 525);
  assert.equal(resolvePurchaseCoins('android', 'com.bananatalk.app.coins.1500'), 1750);
});

test('resolvePurchaseCoins: unknown product or platform -> null (no credit)', () => {
  assert.equal(resolvePurchaseCoins('ios', 'bogus.product'), null);
  assert.equal(resolvePurchaseCoins('windows', 'anything'), null);
  // cross-platform productId must not resolve
  assert.equal(resolvePurchaseCoins('ios', 'com.bananatalk.app.coins.100'), null);
});

test('validateVerifyInput: rejects bad platform / missing fields', () => {
  assert.equal(validateVerifyInput({ platform: 'ios', productId: 'p', receipt: 'r' }).ok, true);
  assert.equal(validateVerifyInput({ platform: 'android', productId: 'p', receipt: 'r' }).ok, true);
  assert.equal(validateVerifyInput({ platform: 'web', productId: 'p', receipt: 'r' }).status, 400);
  assert.equal(validateVerifyInput({ platform: 'ios', productId: '', receipt: 'r' }).status, 400);
  assert.equal(validateVerifyInput({ platform: 'ios', productId: 'p', receipt: '' }).status, 400);
});

// ------------------------------------------------------- transactions paging
test('clampLimit: default 20, cap 50, floor 1', () => {
  assert.equal(clampLimit(undefined), 20);
  assert.equal(clampLimit('0'), 20);
  assert.equal(clampLimit('-5'), 20);
  assert.equal(clampLimit('abc'), 20);
  assert.equal(clampLimit('10'), 10);
  assert.equal(clampLimit('999'), 50);
});

test('parseOffset: non-negative integer, else 0', () => {
  assert.equal(parseOffset(undefined), 0);
  assert.equal(parseOffset('-3'), 0);
  assert.equal(parseOffset('abc'), 0);
  assert.equal(parseOffset('7'), 7);
});

test('buildTransactionsQuery: scopes to user; cursor filters older rows', () => {
  const uid = new mongoose.Types.ObjectId();
  const base = buildTransactionsQuery(uid, undefined);
  assert.deepEqual(base, { userId: uid });

  const iso = '2026-07-13T00:00:00.000Z';
  const withCursor = buildTransactionsQuery(uid, iso);
  assert.equal(withCursor.userId, uid);
  assert.ok(withCursor.createdAt.$lt instanceof Date);
  assert.equal(withCursor.createdAt.$lt.toISOString(), iso);

  // Garbage cursor is ignored (no createdAt filter) rather than throwing.
  const badCursor = buildTransactionsQuery(uid, 'not-a-date');
  assert.deepEqual(badCursor, { userId: uid });
});

// ---------------------------------------------------------- kill-switch guard
test('coinsEnabledGuard: passes through when COINS_ENABLED (default on)', () => {
  // COINS_ENABLED defaults to true in the test env (no COINS_ENABLED=false set).
  let nexted = false;
  let statusCode = null;
  const req = {};
  const res = {
    status(code) { statusCode = code; return this; },
    json() { return this; },
  };
  coinsEnabledGuard(req, res, () => { nexted = true; });
  assert.equal(nexted, true);
  assert.equal(statusCode, null);
});
