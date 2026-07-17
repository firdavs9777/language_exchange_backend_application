/**
 * Coins v1 — REST controller (Workstream F).
 *
 * Endpoints (mounted at /api/v1/coins, all wrapped by `coinsEnabledGuard`
 * + `protect` in routes/coins.js):
 *   GET  /balance         -> current coin balance
 *   GET  /transactions    -> paginated ledger (newest first)
 *   GET  /unlock-catalog  -> live UNLOCKS map { featureKey: {cost, grant} }
 *   POST /verify-purchase -> idempotent IAP verify + credit
 *   POST /unlock          -> spend coins for an à-la-carte feature unlock
 *
 * MONEY-SAFETY: every balance mutation delegates to lib/coinLedger.js, whose
 * debit is balance-guarded (never negative) and whose credit is transactional
 * + idempotent per `metadata.iapTransactionId`. This controller never mutates
 * coinBalance directly — it only maps store/HTTP decisions onto the ledger.
 * The pure decision helpers at the bottom are exported for unit testing since
 * the DB-touching handlers can't be exercised without a live Mongo (those
 * guarantees live in test/coinLedger.integration.test.js).
 */

const asyncHandler = require('../middleware/async');
const CoinTransaction = require('../models/CoinTransaction');
const User = require('../models/User');
const coinLedger = require('../lib/coinLedger');
const { UNLOCKS, getUnlock, getPackByProductId } = require('../config/coinCatalog');
const { COINS_ENABLED } = require('../config/limitations');

const DEFAULT_TX_LIMIT = 20;
const MAX_TX_LIMIT = 50;

/**
 * Kill-switch guard — short-circuits every coin route to 404 when
 * COINS_ENABLED is false (mirrors roomsEnabledGuard/reelsEnabledGuard). Kept
 * as a standalone function so it's unit-testable with mock req/res without
 * pulling in the Express/auth chain.
 */
function coinsEnabledGuard(req, res, next) {
  if (!COINS_ENABLED) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  next();
}

/**
 * @desc    Current coin balance for the authed user
 * @route   GET /api/v1/coins/balance
 * @access  Private (COINS_ENABLED)
 */
exports.getBalance = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, balance: req.user.coinBalance || 0 });
});

/**
 * @desc    Paginated coin transaction history (newest first)
 * @route   GET /api/v1/coins/transactions?cursor=<ISO createdAt>&limit=20
 *          (also accepts ?offset=<n> for simple offset pagination)
 * @access  Private (COINS_ENABLED)
 */
exports.getTransactions = asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit);
  const query = buildTransactionsQuery(req.user._id, req.query.cursor);
  const offset = parseOffset(req.query.offset);

  let find = CoinTransaction.find(query).sort({ createdAt: -1 });
  if (offset > 0) find = find.skip(offset);
  // Fetch one extra row to know whether another page exists.
  const rows = await find.limit(limit + 1).lean();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? new Date(last.createdAt).toISOString() : null;

  res.status(200).json({
    success: true,
    transactions: page,
    nextCursor,
  });
});

/**
 * @desc    Live à-la-carte unlock catalog so the app never hardcodes
 *          cost/grant (they're tunable server-side).
 * @route   GET /api/v1/coins/unlock-catalog
 * @access  Private (COINS_ENABLED)
 *
 * Returns the UNLOCKS map at the TOP LEVEL of the body (each featureKey ->
 * {cost, grant}) — the app's CoinApiClient.getUnlockCatalog iterates the
 * body's entries expecting each value to be a {cost, grant} map.
 */
exports.getUnlockCatalog = asyncHandler(async (req, res) => {
  res.status(200).json({ ...UNLOCKS });
});

/**
 * @desc    Verify a completed store purchase and credit coins (idempotent).
 * @route   POST /api/v1/coins/verify-purchase
 * @access  Private (COINS_ENABLED, regular+; visitors 403)
 *
 * Body: { platform: 'ios'|'android', productId, receipt, transactionId }
 *   `transactionId` is the client-supplied per-purchase idempotency id; the
 *   verifier re-derives the authoritative one it returns.
 *
 * Money-safety:
 *   - If the receipt can't be verified we credit NOTHING and return a
 *     retryable error, so the client leaves the IAP un-consumed and the store
 *     can refund/retry (no coins without a valid receipt).
 *   - credit() is idempotent per metadata.iapTransactionId, so a replay of the
 *     same purchase returns the same balance without double-crediting.
 */
exports.verifyPurchase = asyncHandler(async (req, res) => {
  if (isVisitor(req.user)) {
    return res.status(403).json({
      success: false,
      error: 'Verify your account to purchase coins.',
    });
  }

  const { platform, productId, receipt, transactionId } = req.body || {};

  const inputCheck = validateVerifyInput({ platform, productId, receipt });
  if (!inputCheck.ok) {
    return res.status(inputCheck.status).json({ success: false, error: inputCheck.error });
  }

  // Lazy require so this controller loads even before the parallel-built
  // shared verifier lands (it's a hard runtime dependency of this handler,
  // not of the module).
  const { verifyConsumableReceipt } = require('../lib/consumableReceipt');

  const verified = await verifyConsumableReceipt({
    platform,
    productId,
    receipt,
    purchaseIdentifier: transactionId,
  });

  if (!verified || !verified.valid) {
    // Charged but unverifiable → no credit, retryable. Client keeps the IAP
    // un-consumed so the store can refund or retry.
    return res.status(400).json({
      success: false,
      error: 'Your purchase could not be verified. Please try again.',
    });
  }

  // Resolve coins from the verifier-authoritative productId (fall back to the
  // request's productId only if the verifier omits it).
  const resolvedProductId = verified.productId || productId;
  const coins = resolvePurchaseCoins(platform, resolvedProductId);
  if (!coins) {
    return res.status(400).json({
      success: false,
      error: 'Unrecognized coin pack product.',
    });
  }

  const iapTransactionId = verified.transactionId || transactionId;
  const result = await coinLedger.credit(req.user._id, coins, {
    type: 'purchase',
    reason: 'iap_purchase',
    metadata: {
      iapTransactionId,
      platform,
      productId: resolvedProductId,
      packCoins: coins,
    },
  });

  res.status(200).json({
    success: true,
    balance: result.balanceAfter,
    credited: result.alreadyCredited ? 0 : coins,
    alreadyCredited: result.alreadyCredited,
  });
});

/**
 * @desc    Spend coins to unlock extra uses of a gated feature.
 * @route   POST /api/v1/coins/unlock
 * @access  Private (COINS_ENABLED, regular+; visitors 403)
 *
 * Body: { featureKey }
 * Flow: visitor -> 403; unknown/missing featureKey -> 400/404; debit the
 * catalog cost (balance-guarded) -> 402 on insufficient coins; only on a
 * successful debit atomically $inc coinBonus[featureKey] by the grant. Debit
 * and grant never half-apply (grant runs only after debit.ok).
 */
exports.unlock = asyncHandler(async (req, res) => {
  if (isVisitor(req.user)) {
    return res.status(403).json({
      success: false,
      error: 'Verify your account to unlock features with coins.',
    });
  }

  const { featureKey } = req.body || {};
  const decision = resolveUnlockRequest(featureKey);
  if (!decision.ok) {
    return res.status(decision.status).json({ success: false, error: decision.error });
  }

  const { cost, grant } = decision;

  const debitResult = await coinLedger.debit(req.user._id, cost, {
    reason: `unlock:${featureKey}`,
    relatedId: featureKey,
  });

  if (!debitResult.ok) {
    return res.status(402).json({ success: false, error: 'insufficient_coins' });
  }

  // Grant only after a confirmed debit. Atomic $inc on the persistent bonus
  // pool — never read-modify-save (would clobber concurrent decrements from
  // the enforcement paths, Task 3).
  await User.findByIdAndUpdate(req.user._id, {
    $inc: { [`coinBonus.${featureKey}`]: grant },
  });

  res.status(200).json({
    success: true,
    newBalance: debitResult.balanceAfter,
    granted: grant,
    featureKey,
  });
});

// ==========================================================================
// Pure decision helpers (no DB) — exported for unit tests.
// ==========================================================================

/** @returns {boolean} true when the user may NOT purchase/unlock. */
function isVisitor(user) {
  return !!user && user.userMode === 'visitor';
}

/** Clamp a ?limit query param to [1, MAX_TX_LIMIT], default DEFAULT_TX_LIMIT. */
function clampLimit(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TX_LIMIT;
  return Math.min(n, MAX_TX_LIMIT);
}

/** Non-negative integer offset, 0 when absent/invalid. */
function parseOffset(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Build the Mongo query for a user's transaction page. A `cursor` (ISO
 * createdAt of the last row seen) fetches strictly older rows.
 */
function buildTransactionsQuery(userId, cursor) {
  const query = { userId };
  if (cursor) {
    const d = new Date(cursor);
    if (!Number.isNaN(d.getTime())) {
      query.createdAt = { $lt: d };
    }
  }
  return query;
}

/**
 * Validate verify-purchase input before touching the store verifier.
 * @returns {{ok:true}|{ok:false, status:number, error:string}}
 */
function validateVerifyInput({ platform, productId, receipt }) {
  if (platform !== 'ios' && platform !== 'android') {
    return { ok: false, status: 400, error: 'platform must be "ios" or "android".' };
  }
  if (!productId || typeof productId !== 'string') {
    return { ok: false, status: 400, error: 'productId is required.' };
  }
  if (!receipt || typeof receipt !== 'string') {
    return { ok: false, status: 400, error: 'receipt is required.' };
  }
  return { ok: true };
}

/**
 * Resolve how many coins a verified IAP productId is worth.
 * @returns {number|null} coin amount, or null for an unrecognized product.
 */
function resolvePurchaseCoins(platform, productId) {
  const pack = getPackByProductId(platform, productId);
  return pack ? pack.coins : null;
}

/**
 * Decide the outcome of an unlock request from its featureKey alone (before
 * any debit): missing key -> 400, unknown key -> 404, else the cost/grant.
 * @returns {{ok:true, cost:number, grant:number}|{ok:false, status:number, error:string}}
 */
function resolveUnlockRequest(featureKey) {
  if (!featureKey || typeof featureKey !== 'string') {
    return { ok: false, status: 400, error: 'featureKey is required.' };
  }
  const unlock = getUnlock(featureKey);
  if (!unlock) {
    return { ok: false, status: 404, error: 'unknown_feature' };
  }
  return { ok: true, cost: unlock.cost, grant: unlock.grant };
}

exports.coinsEnabledGuard = coinsEnabledGuard;
// Exported for unit tests.
exports._helpers = {
  isVisitor,
  clampLimit,
  parseOffset,
  buildTransactionsQuery,
  validateVerifyInput,
  resolvePurchaseCoins,
  resolveUnlockRequest,
};
