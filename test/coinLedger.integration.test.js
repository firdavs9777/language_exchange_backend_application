/**
 * Integration tests for lib/coinLedger.js — the DB-level money guarantees
 * that can't be exercised as pure units (Task 1b): a real balance-guarded
 * debit racing concurrent requests, and real dup-key credit idempotency
 * under the unique index + transaction. Spins up an ephemeral single-node
 * replica set (mongodb-memory-server) so multi-document transactions work,
 * matching prod (Atlas `replicaSet=atlas-bnfxlc-shard-0`).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replset;
let User;
let CoinTransaction;
let coinLedger;

test.before(async () => {
  replset = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replset.getUri(), { dbName: 'coins_test' });

  User = require('../models/User');
  CoinTransaction = require('../models/CoinTransaction');
  coinLedger = require('../lib/coinLedger');
});

test.after(async () => {
  await mongoose.disconnect();
  await replset.stop();
});

async function makeUser(overrides = {}) {
  const user = await User.create({
    name: 'Coin Test User',
    email: `coin-test-${new mongoose.Types.ObjectId()}@example.com`,
    password: 'hashed-password-placeholder',
    birth_year: '2000',
    birth_month: '1',
    birth_day: '1',
    gender: 'other',
    native_language: 'English',
    language_to_learn: 'Spanish',
    userMode: 'regular',
    coinBalance: 0,
    ...overrides,
  });
  return user;
}

// ---------------------------------------------------------------------------
// debit — concurrent races never drive the balance negative
// ---------------------------------------------------------------------------

test('debit: concurrent debits racing the same balance never drive it negative', async () => {
  const user = await makeUser({ coinBalance: 100 });
  const cost = 30; // floor(100/30) = 3 should succeed, out of 5 attempted
  const attempts = 5;

  const results = await Promise.all(
    Array.from({ length: attempts }, () =>
      coinLedger.debit(user._id, cost, { reason: 'test:race' }))
  );

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  assert.equal(succeeded.length, 3);
  assert.equal(failed.length, 2);
  failed.forEach((r) => assert.equal(r.reason, 'insufficient_balance'));

  const finalUser = await User.findById(user._id);
  assert.equal(finalUser.coinBalance, 100 - succeeded.length * cost);
  assert.ok(finalUser.coinBalance >= 0);

  const spendTxns = await CoinTransaction.find({ userId: user._id, type: 'spend' });
  assert.equal(spendTxns.length, succeeded.length);
});

test('debit: a larger fan-out never lets the balance go negative', async () => {
  const user = await makeUser({ coinBalance: 50 });
  const cost = 20; // floor(50/20) = 2 should succeed, out of 10 attempted

  const results = await Promise.all(
    Array.from({ length: 10 }, () => coinLedger.debit(user._id, cost, {}))
  );
  const succeeded = results.filter((r) => r.ok);

  assert.equal(succeeded.length, 2);

  const finalUser = await User.findById(user._id);
  assert.equal(finalUser.coinBalance, 10);
  assert.ok(finalUser.coinBalance >= 0);
});

// ---------------------------------------------------------------------------
// credit — idempotency under a real unique index + transaction
// ---------------------------------------------------------------------------

test('credit: calling twice with the same iapTransactionId increments the balance exactly once', async () => {
  const user = await makeUser({ coinBalance: 0 });
  const metadata = { iapTransactionId: `ios-txn-${user._id}` };

  const first = await coinLedger.credit(user._id, 500, { reason: 'iap_purchase', metadata });
  assert.equal(first.ok, true);
  assert.equal(first.alreadyCredited, false);
  assert.equal(first.balanceAfter, 500);

  // Simulated retry — client resends the identical purchase after e.g. a
  // dropped response.
  const second = await coinLedger.credit(user._id, 500, { reason: 'iap_purchase', metadata });
  assert.equal(second.ok, true);
  assert.equal(second.alreadyCredited, true);
  assert.equal(second.balanceAfter, 500); // unchanged — not 1000

  const finalUser = await User.findById(user._id);
  assert.equal(finalUser.coinBalance, 500);

  const purchaseTxns = await CoinTransaction.find({
    userId: user._id,
    'metadata.iapTransactionId': metadata.iapTransactionId,
  });
  assert.equal(purchaseTxns.length, 1);
});

test('credit: concurrent retries with the same iapTransactionId still credit exactly once', async () => {
  const user = await makeUser({ coinBalance: 0 });
  const metadata = { iapTransactionId: `ios-txn-concurrent-${user._id}` };

  const results = await Promise.all(
    Array.from({ length: 5 }, () => coinLedger.credit(user._id, 100, { metadata }))
  );

  results.forEach((r) => assert.equal(r.ok, true));
  const originalCredits = results.filter((r) => !r.alreadyCredited);
  assert.equal(originalCredits.length, 1);

  const finalUser = await User.findById(user._id);
  assert.equal(finalUser.coinBalance, 100);

  const purchaseTxns = await CoinTransaction.find({
    userId: user._id,
    'metadata.iapTransactionId': metadata.iapTransactionId,
  });
  assert.equal(purchaseTxns.length, 1);
});

test('credit: a transaction that throws mid-way leaves balance AND ledger unchanged (rollback)', async () => {
  const user = await makeUser({ coinBalance: 42 });

  // Force the ledger insert half of the transaction to fail by writing a
  // CoinTransaction with the SAME iapTransactionId directly (bypassing
  // coinLedger) so the real credit() call's insert hits the unique index
  // and the whole transaction — including the balance $inc — rolls back.
  const metadata = { iapTransactionId: `ios-txn-preexisting-${user._id}` };
  await CoinTransaction.create({
    userId: new mongoose.Types.ObjectId(), // different user, same idempotency id — still trips the unique index
    type: 'purchase',
    amount: 999,
    balanceAfter: 999,
    metadata,
  });

  await assert.rejects(() => coinLedger.credit(user._id, 500, { metadata }));

  const finalUser = await User.findById(user._id);
  assert.equal(finalUser.coinBalance, 42); // unchanged — rollback proven

  const txnsForUser = await CoinTransaction.find({ userId: user._id });
  assert.equal(txnsForUser.length, 0); // no half-applied ledger row
});
