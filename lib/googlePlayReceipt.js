/**
 * Google Play receipt-verification core (Coins v1, Task 4).
 *
 * Extracted verbatim from controllers/androidPurchase.js so BOTH the existing
 * VIP subscription verify controller AND the new coins verify-purchase
 * controller (Task 5) share one purchase-token verification implementation.
 * NO VIP / activateVIP side effects.
 */

const { google } = require('googleapis');

// Google Play configuration
const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.bananatalk.app';

// Initialize Google Play API client (cached)
let androidPublisher = null;

async function getAndroidPublisher() {
  if (androidPublisher) {
    return androidPublisher;
  }

  const serviceAccountEmail = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceAccountEmail || !privateKey) {
    console.error('❌ Google Play Service Account not configured!');
    console.error('   Required env vars: GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL, GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY');
    throw new Error('Google Play Service Account not configured');
  }

  // Create JWT auth client
  const auth = new google.auth.JWT(
    serviceAccountEmail,
    null,
    privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines in env var
    ['https://www.googleapis.com/auth/androidpublisher']
  );

  androidPublisher = google.androidpublisher({
    version: 'v3',
    auth
  });

  return androidPublisher;
}

/**
 * Verify purchase token with Google Play Developer API.
 * Tries the subscription endpoint first, then falls back to one-time products.
 */
async function verifyPurchaseWithGoogle(purchaseToken, productId, packageName) {
  try {
    const publisher = await getAndroidPublisher();

    // For subscriptions, use subscriptions.get
    const response = await publisher.purchases.subscriptions.get({
      packageName: packageName,
      subscriptionId: productId,
      token: purchaseToken
    });

    console.log('📱 Google Play API Response:', JSON.stringify(response.data, null, 2));

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('❌ Google Play API Error:', error.message);

    // Try as one-time purchase if subscription fails
    if (error.code === 404 || error.message.includes('not found')) {
      try {
        const publisher = await getAndroidPublisher();
        const response = await publisher.purchases.products.get({
          packageName: packageName,
          productId: productId,
          token: purchaseToken
        });

        console.log('📱 Google Play Product Response:', JSON.stringify(response.data, null, 2));

        return {
          success: true,
          data: response.data,
          isOneTime: true
        };
      } catch (productError) {
        console.error('❌ Google Play Product API Error:', productError.message);
        return {
          success: false,
          error: productError.message
        };
      }
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Normalized Android receipt-verification "core". Verifies a purchaseToken with
 * Google Play and returns a plain result object; NO VIP side effects. The
 * pinned idempotency id for Android is ALWAYS the purchaseToken (reviewer C3),
 * exposed as `transactionId`. Purchase-state / expiry gating is left to callers
 * (VIP subscriptions and coins consumables treat states differently).
 *
 * @param {Object} args
 * @param {String} args.purchaseToken
 * @param {String} args.productId
 * @param {String} [args.packageName]
 * @returns {Promise<Object>} On success:
 *   { valid:true, productId, transactionId:purchaseToken, raw, purchaseState, expiryTimeMillis, isOneTime }
 *   On failure: { valid:false, error }
 */
async function verifyAndroidReceipt({ purchaseToken, productId, packageName } = {}) {
  const actualPackageName = packageName || PACKAGE_NAME;
  const result = await verifyPurchaseWithGoogle(purchaseToken, productId, actualPackageName);

  if (!result.success) {
    return { valid: false, error: result.error };
  }

  const data = result.data || {};
  return {
    valid: true,
    productId,
    // Android idempotency id is the purchaseToken (reviewer C3).
    transactionId: purchaseToken,
    raw: data,
    // For subscriptions: paymentState; for products: purchaseState (0 = purchased).
    purchaseState: data.paymentState !== undefined ? data.paymentState : data.purchaseState,
    expiryTimeMillis: data.expiryTimeMillis,
    isOneTime: !!result.isOneTime,
  };
}

module.exports = {
  verifyAndroidReceipt,
  verifyPurchaseWithGoogle,
  getAndroidPublisher,
  PACKAGE_NAME,
};
