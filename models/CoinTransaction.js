const mongoose = require('mongoose');

/**
 * Coins v1 ledger — every balance mutation (IAP purchase credit, à-la-carte
 * unlock spend, admin/refund adjustment) writes one row here. Serves both
 * the audit trail and the client-facing transaction history
 * (GET /coins/transactions).
 *
 * Idempotency (reviewer C3 — pinned exactly, do not substitute a different
 * identifier): `metadata.iapTransactionId` MUST be the per-purchase store
 * identifier, and the client MUST resend the identical value on every
 * retry of the same purchase:
 *   - iOS:     the StoreKit `transactionId` of the CONSUMABLE purchase
 *              itself — NOT `originalTransactionId` (that's stable across
 *              a subscription's renewals; a consumable coin pack has no
 *              renewals, so using it here would be fine too, but pin to
 *              `transactionId` for consistency with how iOS reports
 *              consumable purchases).
 *   - Android: the `purchaseToken`.
 * The unique sparse index below turns a replayed/retried verify-purchase
 * call into a no-op (see lib/coinLedger.js#credit) instead of a double
 * credit. `type: 'spend'` and `type: 'refund'` rows never set this field
 * (sparse), so the uniqueness constraint only ever applies to purchases.
 */
const CoinTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['purchase', 'spend', 'refund'],
    required: true,
  },
  // Signed. Positive for purchase/refund, negative for spend.
  amount: {
    type: Number,
    required: true,
  },
  // Balance snapshot immediately after this transaction applied — lets the
  // history view render without recomputing a running total.
  balanceAfter: {
    type: Number,
    required: true,
  },
  // Short machine-readable reason, e.g. 'iap_purchase', 'unlock:translation',
  // 'unlock:roleplay'.
  reason: {
    type: String,
    default: '',
  },
  // Free-form related identifier (e.g. the featureKey unlocked, or a pack id).
  relatedId: {
    type: String,
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

CoinTransactionSchema.index({ userId: 1, createdAt: -1 });

// Purchase idempotency — see file-level doc comment above for the exact
// per-platform identifier this must be.
CoinTransactionSchema.index(
  { 'metadata.iapTransactionId': 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model('CoinTransaction', CoinTransactionSchema);
