/**
 * Apple receipt-verification core (Coins v1, Task 4).
 *
 * Extracted verbatim from controllers/iosPurchase.js so BOTH the existing VIP
 * subscription verify controller AND the new coins verify-purchase controller
 * (Task 5) share one receipt-verification implementation. This module contains
 * ONLY receipt verification — no VIP / activateVIP side effects.
 *
 * `verifyIOSReceipt` returns a normalized result the callers turn into their
 * own responses; the low-level primitives (verifyStoreKit2Transaction,
 * verifyLegacyReceipt, isStoreKit2Format) are re-exported so the subscription
 * status + webhook handlers can keep using them unchanged.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');

// Apple's App Store environments
const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

const appleSharedSecret = process.env.APPLE_SHARED_SECRET;

if (!appleSharedSecret) {
  console.warn('⚠️ APPLE_SHARED_SECRET not configured! iOS purchase verification may fail for legacy receipts.');
}

// Legacy verifyReceipt status-code messages (surfaced to the client by callers).
const LEGACY_STATUS_MESSAGES = {
  21000: 'The App Store could not read the receipt',
  21002: 'The receipt data is malformed',
  21003: 'The receipt could not be authenticated',
  21004: 'The shared secret does not match',
  21005: 'The receipt server is not available',
  21006: 'The receipt is valid but subscription has expired',
  21007: 'Sandbox receipt sent to production',
  21008: 'Production receipt sent to sandbox',
};

/**
 * Verify the certificate chain from x5c header
 */
function verifyCertificateChain(x5c) {
  if (!x5c || x5c.length < 2) {
    throw new Error('Invalid certificate chain');
  }

  // The first certificate is the signing certificate
  // The last certificate should chain to Apple Root CA
  // For simplicity, we trust certificates that have proper chain
  // In production, you should verify the full chain to Apple Root CA

  // Get the signing certificate (first in chain)
  const signingCertPem = `-----BEGIN CERTIFICATE-----\n${x5c[0].match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;

  return signingCertPem;
}

/**
 * Verify and decode a StoreKit 2 JWS transaction
 */
async function verifyStoreKit2Transaction(signedTransaction) {
  try {
    // Decode header to get certificate chain
    const parts = signedTransaction.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWS format');
    }

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const x5c = header.x5c;
    const alg = header.alg;

    console.log('   JWS Header alg:', alg);
    console.log('   JWS Header has x5c:', !!x5c);

    if (!x5c || x5c.length === 0) {
      throw new Error('No certificate chain in JWS header');
    }

    // Get the public key from the certificate chain
    const signingCertPem = verifyCertificateChain(x5c);

    // Create public key from certificate
    const publicKey = crypto.createPublicKey({
      key: signingCertPem,
      format: 'pem'
    });

    // Verify and decode the JWT
    const decoded = jwt.verify(signedTransaction, publicKey, {
      algorithms: ['ES256']
    });

    console.log('   Decoded transaction bundleId:', decoded.bundleId);
    console.log('   Decoded transaction productId:', decoded.productId);
    console.log('   Decoded transaction type:', decoded.type);

    return decoded;
  } catch (error) {
    console.error('JWS verification error:', error.message);
    throw error;
  }
}

/**
 * Check if receipt is StoreKit 2 JWS format
 */
function isStoreKit2Format(receiptData) {
  // StoreKit 2 JWS tokens start with 'eyJ' (base64url encoded JSON)
  return typeof receiptData === 'string' && receiptData.startsWith('eyJ');
}

/**
 * Verify legacy receipt with Apple's verifyReceipt endpoint
 */
async function verifyLegacyReceipt(receiptData, useSandbox = false) {
  const url = useSandbox ? APPLE_SANDBOX_URL : APPLE_PRODUCTION_URL;

  const requestBody = JSON.stringify({
    'receipt-data': receiptData,
    'password': appleSharedSecret,
    'exclude-old-transactions': true
  });

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          // Status 21007 means sandbox receipt sent to production
          if (response.status === 21007 && !useSandbox) {
            // Retry with sandbox
            verifyLegacyReceipt(receiptData, true)
              .then(resolve)
              .catch(reject);
            return;
          }

          resolve(response);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

/**
 * Normalized iOS receipt-verification "core". Verifies a StoreKit2 JWS or a
 * legacy receipt and returns a plain result object; NO VIP side effects. The
 * VIP controller and the coins consumable verifier both call this and derive
 * their own response/idempotency id from the fields below.
 *
 * @param {String} receiptData   the raw receipt (JWS string or legacy base64)
 * @param {Object} [opts]
 * @param {String} [opts.productId]      client-declared productId (fallback / legacy lookup)
 * @param {String} [opts.transactionId]  client-declared transactionId (legacy lookup)
 * @returns {Promise<Object>} On success:
 *   { valid:true, format:'storekit2'|'legacy', productId, transactionId,
 *     originalTransactionId, expiresDate:Date|null, decoded?, purchase?, validationResponse? }
 *   On failure: { valid:false, format, ...one of:
 *     { jwsError:Error } | { noSharedSecret:true } |
 *     { status:Number, statusMessage:String } |
 *     { errorCode:'NO_PURCHASE_DATA'|'PURCHASE_NOT_FOUND' } }
 */
async function verifyIOSReceipt(receiptData, { productId, transactionId } = {}) {
  // --- StoreKit 2 JWS ---
  if (isStoreKit2Format(receiptData)) {
    try {
      const t = await verifyStoreKit2Transaction(receiptData);
      return {
        valid: true,
        format: 'storekit2',
        productId: t.productId || productId,
        // Pinned CONSUMABLE idempotency id is the StoreKit transactionId (NOT
        // originalTransactionId) — reviewer C3. originalTransactionId is kept
        // separately so the VIP path can preserve its existing fallback.
        transactionId: t.transactionId || null,
        originalTransactionId: t.originalTransactionId || null,
        expiresDate: t.expiresDate ? new Date(t.expiresDate) : null,
        decoded: t,
      };
    } catch (jwsError) {
      return { valid: false, format: 'storekit2', jwsError };
    }
  }

  // --- Legacy receipt ---
  if (!appleSharedSecret) {
    return { valid: false, format: 'legacy', noSharedSecret: true };
  }

  const validationResponse = await verifyLegacyReceipt(receiptData);

  if (validationResponse.status !== 0) {
    const statusMessage = LEGACY_STATUS_MESSAGES[validationResponse.status] ||
      `Validation failed with status ${validationResponse.status}`;
    return {
      valid: false,
      format: 'legacy',
      status: validationResponse.status,
      statusMessage,
      validationResponse,
    };
  }

  const latestReceiptInfo = validationResponse.latest_receipt_info ||
    (validationResponse.receipt && validationResponse.receipt.in_app) ||
    [];

  if (!latestReceiptInfo || latestReceiptInfo.length === 0) {
    return { valid: false, format: 'legacy', errorCode: 'NO_PURCHASE_DATA', validationResponse };
  }

  // Find the specific purchase or use the latest one
  let purchase;
  if (productId && transactionId) {
    purchase = latestReceiptInfo.find(
      p => p.product_id === productId && p.transaction_id === transactionId
    );
  } else {
    purchase = latestReceiptInfo.slice().sort((a, b) => {
      const dateA = parseInt(a.purchase_date_ms) || 0;
      const dateB = parseInt(b.purchase_date_ms) || 0;
      return dateB - dateA;
    })[0];
  }

  if (!purchase) {
    return { valid: false, format: 'legacy', errorCode: 'PURCHASE_NOT_FOUND', validationResponse };
  }

  return {
    valid: true,
    format: 'legacy',
    productId: productId || purchase.product_id,
    transactionId: purchase.transaction_id || null,
    originalTransactionId: purchase.original_transaction_id || null,
    expiresDate: purchase.expires_date_ms ? new Date(parseInt(purchase.expires_date_ms)) : null,
    purchase,
    validationResponse,
  };
}

module.exports = {
  verifyIOSReceipt,
  verifyStoreKit2Transaction,
  verifyLegacyReceipt,
  isStoreKit2Format,
  verifyCertificateChain,
  LEGACY_STATUS_MESSAGES,
};
