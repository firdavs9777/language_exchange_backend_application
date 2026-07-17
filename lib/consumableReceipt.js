/**
 * Shared, side-effect-free consumable receipt verifier (Coins v1, Task 4).
 *
 * Both the existing VIP verify controllers (via lib/appleReceipt +
 * lib/googlePlayReceipt) and the new coins verify-purchase controller (Task 5)
 * share the receipt-verification core. THIS function is the entry point Task 5
 * calls for coin-pack consumables. It performs NO activateVIP / subscription
 * side effects — it only proves the receipt is genuine and returns the pinned
 * per-platform idempotency id.
 *
 * Idempotency id (reviewer C3): the returned `transactionId` is the value Task
 * 5 writes into CoinTransaction.metadata.iapTransactionId so a replayed receipt
 * never double-credits:
 *   - iOS     = StoreKit `transactionId` of the CONSUMABLE purchase
 *               (NOT originalTransactionId).
 *   - Android = the `purchaseToken`.
 */

const { verifyIOSReceipt } = require('./appleReceipt');
const { verifyAndroidReceipt } = require('./googlePlayReceipt');

/**
 * @param {Object} args
 * @param {'ios'|'android'} args.platform
 * @param {String} args.productId          the coin-pack product id
 * @param {String} args.receipt            iOS: receiptData (JWS/legacy); Android: purchaseToken
 * @param {String} [args.purchaseIdentifier]  client-declared per-purchase id
 *                                            (iOS legacy lookup; ignored for android)
 * @returns {Promise<{valid:boolean, productId?:string, transactionId?:string}>}
 */
async function verifyConsumableReceipt({ platform, productId, receipt, purchaseIdentifier } = {}) {
  if (!receipt) {
    return { valid: false };
  }

  if (platform === 'ios') {
    const result = await verifyIOSReceipt(receipt, {
      productId,
      transactionId: purchaseIdentifier,
    });
    if (!result.valid) {
      return { valid: false };
    }
    // Pin the CONSUMABLE StoreKit transactionId (NOT originalTransactionId).
    const transactionId = result.transactionId || purchaseIdentifier || null;
    if (!transactionId) {
      // Without a stable per-purchase id we cannot guarantee idempotency.
      return { valid: false };
    }
    return {
      valid: true,
      productId: result.productId || productId,
      transactionId,
    };
  }

  if (platform === 'android') {
    // For Android the receipt IS the purchaseToken; that is also the pinned id.
    const purchaseToken = receipt;
    const result = await verifyAndroidReceipt({ purchaseToken, productId });
    if (!result.valid) {
      return { valid: false };
    }
    // A consumable is only genuinely purchased at purchaseState 0. Canceled (1)
    // / pending (2) must NOT credit coins.
    if (result.purchaseState !== undefined && result.purchaseState !== 0) {
      return { valid: false };
    }
    return {
      valid: true,
      productId: result.productId || productId,
      transactionId: purchaseToken,
    };
  }

  // Unknown platform
  return { valid: false };
}

module.exports = { verifyConsumableReceipt };
