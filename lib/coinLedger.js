/**
 * Coins v1 — atomic, idempotent balance mutations.
 *
 * Money-safety contract (do not weaken without re-reading the design doc
 * review rounds — docs/superpowers/specs/2026-07-13-coins-v1-design.md):
 *   - `debit` NEVER lets coinBalance go negative: the decrement is a single
 *     balance-guarded `findOneAndUpdate`, so concurrent debits racing the
 *     same balance can't both succeed past zero.
 *   - `credit` NEVER double-credits the same IAP purchase: the ledger
 *     insert (unique on `metadata.iapTransactionId`) and the balance
 *     `$inc` commit together inside one Mongo session/transaction, so a
 *     crash mid-credit can't leave a ledger row without its balance
 *     increment (or vice versa). A retried/replayed purchase with the
 *     same idempotency id hits the unique index, the whole attempt's
 *     `$inc` rolls back with it, and the ORIGINAL transaction is returned.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');

/**
 * Atomically debit `cost` coins from a user's balance, guarded so the
 * balance can never go below zero, then write the `spend` ledger row.
 *
 * @param {String|import('mongoose').Types.ObjectId} userId
 * @param {Number} cost - positive integer number of coins to remove.
 * @param {Object} [opts]
 * @param {String} [opts.reason] - short machine-readable reason, e.g. 'unlock:translation'.
 * @param {String} [opts.relatedId] - e.g. the featureKey being unlocked.
 * @returns {Promise<{ok: true, balanceAfter: number, transaction: object} | {ok: false, reason: 'insufficient_balance'}>}
 */
async function debit(userId, cost, { reason = '', relatedId = null } = {}) {
  if (!(Number.isFinite(cost) && cost > 0)) {
    throw new Error('coinLedger.debit: cost must be a positive number');
  }

  const updated = await User.findOneAndUpdate(
    { _id: userId, coinBalance: { $gte: cost } },
    { $inc: { coinBalance: -cost } },
    { new: true }
  );

  if (!updated) {
    return { ok: false, reason: 'insufficient_balance' };
  }

  const transaction = await CoinTransaction.create({
    userId,
    type: 'spend',
    amount: -cost,
    balanceAfter: updated.coinBalance,
    reason,
    relatedId,
  });

  return { ok: true, balanceAfter: updated.coinBalance, transaction };
}

/**
 * Atomically credit `amount` coins (IAP purchase, or a refund reversal),
 * idempotent per `metadata.iapTransactionId` (see models/CoinTransaction.js
 * for exactly which per-platform field that must be).
 *
 * @param {String|import('mongoose').Types.ObjectId} userId
 * @param {Number} amount - positive integer number of coins to add.
 * @param {Object} [opts]
 * @param {'purchase'|'refund'} [opts.type]
 * @param {String} [opts.reason]
 * @param {Object} [opts.metadata] - MUST include `iapTransactionId` for
 *   purchase credits so a retry/replay is idempotent.
 * @returns {Promise<{ok: true, balanceAfter: number, transaction: object, alreadyCredited: boolean}>}
 */
async function credit(userId, amount, { type = 'purchase', reason = '', metadata = {} } = {}) {
  if (!(Number.isFinite(amount) && amount > 0)) {
    throw new Error('coinLedger.credit: amount must be a positive number');
  }

  const iapTransactionId = metadata && metadata.iapTransactionId;

  const session = await mongoose.startSession();
  try {
    let balanceAfter = null;
    let transaction = null;

    await session.withTransaction(async () => {
      const updated = await User.findOneAndUpdate(
        { _id: userId },
        { $inc: { coinBalance: amount } },
        { new: true, session }
      );
      if (!updated) {
        throw new Error('coinLedger.credit: user not found');
      }
      balanceAfter = updated.coinBalance;

      const created = await CoinTransaction.create(
        [{
          userId,
          type,
          amount,
          balanceAfter,
          reason,
          metadata,
        }],
        { session }
      );
      transaction = created[0];
    });

    return { ok: true, balanceAfter, transaction, alreadyCredited: false };
  } catch (err) {
    // Duplicate key on metadata.iapTransactionId → this exact purchase was
    // already credited (by an earlier attempt, or a concurrent one that
    // committed first). This attempt's $inc was rolled back with the
    // aborted transaction, so the balance was NOT double-incremented —
    // return the transaction that WAS committed.
    if (isDuplicateIapTransactionError(err) && iapTransactionId) {
      const existing = await CoinTransaction.findOne({
        'metadata.iapTransactionId': iapTransactionId,
      });
      if (existing) {
        return {
          ok: true,
          balanceAfter: existing.balanceAfter,
          transaction: existing,
          alreadyCredited: true,
        };
      }
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

function isDuplicateIapTransactionError(err) {
  if (!err) return false;
  // Mongo duplicate-key error, possibly wrapped by a transaction-aborted
  // wrapper depending on driver version — check both the top-level code
  // and a nested cause.
  if (err.code === 11000 || err.code === 11001) return true;
  if (err.cause && (err.cause.code === 11000 || err.cause.code === 11001)) return true;
  return false;
}

module.exports = { debit, credit };
