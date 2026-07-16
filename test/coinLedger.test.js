const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

// ALL mock.module calls before require('../lib/coinLedger') — pure decision
// logic only. The two DB-level guarantees that mocks can't exercise
// (balance-guarded debit under real concurrency, dup-key credit idempotency
// under a real unique index + transaction) are covered by the integration
// test (test/coinLedger.integration.test.js, Task 1b) against a real Mongo.

const mockUserFindOneAndUpdate = mock.fn();
const mockCoinTxnCreate = mock.fn();
const mockCoinTxnFindOne = mock.fn();

mock.module('../models/User.js', {
  defaultExport: {
    findOneAndUpdate: mockUserFindOneAndUpdate,
  },
});

mock.module('../models/CoinTransaction.js', {
  defaultExport: {
    create: mockCoinTxnCreate,
    findOne: mockCoinTxnFindOne,
  },
});

// coinLedger's `credit` opens a mongoose session/transaction — fake it so
// the unit test never touches a real DB. `withTransaction` just invokes the
// callback directly (the callback's own DB calls are the already-mocked
// User/CoinTransaction functions above).
const mockWithTransaction = mock.fn(async (fn) => fn());
const mockEndSession = mock.fn(async () => {});
const mockStartSession = mock.fn(async () => ({
  withTransaction: mockWithTransaction,
  endSession: mockEndSession,
}));

mock.module('mongoose', {
  defaultExport: {
    startSession: mockStartSession,
  },
});

const coinLedger = require('../lib/coinLedger');

test.beforeEach(() => {
  mockUserFindOneAndUpdate.mock.resetCalls();
  mockCoinTxnCreate.mock.resetCalls();
  mockCoinTxnFindOne.mock.resetCalls();
  mockWithTransaction.mock.resetCalls();
  mockStartSession.mock.resetCalls();
});

// ---------------------------------------------------------------------------
// debit
// ---------------------------------------------------------------------------

test('debit: returns {ok:false, reason: insufficient_balance} and writes no ledger row when balance < cost', async () => {
  mockUserFindOneAndUpdate.mock.mockImplementationOnce(() => Promise.resolve(null));

  const result = await coinLedger.debit('user1', 50, { reason: 'unlock:translation' });

  assert.deepEqual(result, { ok: false, reason: 'insufficient_balance' });
  assert.equal(mockCoinTxnCreate.mock.callCount(), 0);
});

test('debit: guards the decrement with coinBalance >= cost in the filter', async () => {
  mockUserFindOneAndUpdate.mock.mockImplementationOnce(() => Promise.resolve(null));
  await coinLedger.debit('user1', 80, {});

  const [filter, update] = mockUserFindOneAndUpdate.mock.calls[0].arguments;
  assert.equal(filter._id, 'user1');
  assert.deepEqual(filter.coinBalance, { $gte: 80 });
  assert.deepEqual(update, { $inc: { coinBalance: -80 } });
});

test('debit: returns correct balanceAfter and writes a spend txn when sufficient', async () => {
  mockUserFindOneAndUpdate.mock.mockImplementationOnce(() =>
    Promise.resolve({ _id: 'user1', coinBalance: 20 })
  );
  mockCoinTxnCreate.mock.mockImplementationOnce((doc) => Promise.resolve({ ...doc, _id: 'txn1' }));

  const result = await coinLedger.debit('user1', 80, { reason: 'unlock:translation', relatedId: 'translation' });

  assert.equal(result.ok, true);
  assert.equal(result.balanceAfter, 20);
  assert.equal(result.transaction.type, 'spend');
  assert.equal(result.transaction.amount, -80);
  assert.equal(result.transaction.balanceAfter, 20);
  assert.equal(result.transaction.reason, 'unlock:translation');
  assert.equal(result.transaction.relatedId, 'translation');
});

test('debit: rejects a non-positive cost without touching the DB', async () => {
  await assert.rejects(() => coinLedger.debit('user1', 0, {}));
  await assert.rejects(() => coinLedger.debit('user1', -5, {}));
  assert.equal(mockUserFindOneAndUpdate.mock.callCount(), 0);
});

// ---------------------------------------------------------------------------
// credit
// ---------------------------------------------------------------------------

test('credit: computes correct balanceAfter and marks the txn "purchase"', async () => {
  mockUserFindOneAndUpdate.mock.mockImplementationOnce(() =>
    Promise.resolve({ _id: 'user1', coinBalance: 600 })
  );
  mockCoinTxnCreate.mock.mockImplementationOnce((docs) =>
    Promise.resolve(docs.map((d, i) => ({ ...d, _id: `txn-${i}` })))
  );

  const result = await coinLedger.credit('user1', 500, {
    reason: 'iap_purchase',
    metadata: { iapTransactionId: 'ios-txn-abc' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.alreadyCredited, false);
  assert.equal(result.balanceAfter, 600);
  assert.equal(result.transaction.type, 'purchase');
  assert.equal(result.transaction.amount, 500);
  assert.equal(result.transaction.balanceAfter, 600);
  assert.equal(mockWithTransaction.mock.callCount(), 1);
});

test('credit: $inc uses the signed positive amount', async () => {
  mockUserFindOneAndUpdate.mock.mockImplementationOnce(() =>
    Promise.resolve({ _id: 'user1', coinBalance: 100 })
  );
  mockCoinTxnCreate.mock.mockImplementationOnce((docs) =>
    Promise.resolve(docs.map((d, i) => ({ ...d, _id: `txn-${i}` })))
  );

  await coinLedger.credit('user1', 100, { metadata: { iapTransactionId: 'ios-txn-1' } });

  const [filter, update] = mockUserFindOneAndUpdate.mock.calls[0].arguments;
  assert.equal(filter._id, 'user1');
  assert.deepEqual(update, { $inc: { coinBalance: 100 } });
});

test('credit: on duplicate iapTransactionId, returns the EXISTING transaction without a second increment', async () => {
  const dupError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
  mockWithTransaction.mock.mockImplementationOnce(async () => {
    throw dupError;
  });
  mockCoinTxnFindOne.mock.mockImplementationOnce(() =>
    Promise.resolve({ _id: 'existing-txn', type: 'purchase', amount: 500, balanceAfter: 600 })
  );

  const result = await coinLedger.credit('user1', 500, {
    metadata: { iapTransactionId: 'ios-txn-abc' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.alreadyCredited, true);
  assert.equal(result.balanceAfter, 600);
  assert.equal(result.transaction._id, 'existing-txn');
});

test('credit: rejects a non-positive amount without opening a session', async () => {
  await assert.rejects(() => coinLedger.credit('user1', 0, {}));
  assert.equal(mockStartSession.mock.callCount(), 0);
});
