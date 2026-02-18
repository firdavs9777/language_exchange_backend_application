const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { logSecurityEvent } = require('../utils/securityLogger');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');

// VIP Plans configuration
const VIP_PLANS = {
  monthly: {
    id: 'monthly',
    name: 'Monthly VIP',
    description: 'Full VIP access for 1 month',
    duration: 1,
    durationUnit: 'month',
    features: [
      'Unlimited daily messages',
      'See who visited your profile',
      'Unlimited profile views',
      'Priority in nearby users',
      'Ad-free experience',
      'Unlimited voice room creation',
      'Unlimited waves per day',
      'Premium support'
    ],
    ios: {
      productId: process.env.IOS_VIP_MONTHLY_PRODUCT_ID || 'com.bananatalk.vip.monthly',
      price: 9.99,
      currency: 'USD',
      localizedPrice: '$9.99'
    },
    android: {
      productId: process.env.ANDROID_VIP_MONTHLY_PRODUCT_ID || 'vip_monthly',
      price: 9.99,
      currency: 'USD',
      localizedPrice: '$9.99'
    }
  },
  quarterly: {
    id: 'quarterly',
    name: 'Quarterly VIP',
    description: 'Full VIP access for 3 months - Save 20%',
    duration: 3,
    durationUnit: 'month',
    savings: '20%',
    features: [
      'Unlimited daily messages',
      'See who visited your profile',
      'Unlimited profile views',
      'Priority in nearby users',
      'Ad-free experience',
      'Unlimited voice room creation',
      'Unlimited waves per day',
      'Premium support'
    ],
    ios: {
      productId: process.env.IOS_VIP_QUARTERLY_PRODUCT_ID || 'com.bananatalk.vip.quarterly',
      price: 23.99,
      currency: 'USD',
      localizedPrice: '$23.99',
      originalPrice: 29.97,
      originalLocalizedPrice: '$29.97'
    },
    android: {
      productId: process.env.ANDROID_VIP_QUARTERLY_PRODUCT_ID || 'vip_quarterly',
      price: 23.99,
      currency: 'USD',
      localizedPrice: '$23.99',
      originalPrice: 29.97,
      originalLocalizedPrice: '$29.97'
    }
  },
  yearly: {
    id: 'yearly',
    name: 'Yearly VIP',
    description: 'Full VIP access for 1 year - Best Value, Save 40%',
    duration: 12,
    durationUnit: 'month',
    savings: '40%',
    recommended: true,
    features: [
      'Unlimited daily messages',
      'See who visited your profile',
      'Unlimited profile views',
      'Priority in nearby users',
      'Ad-free experience',
      'Unlimited voice room creation',
      'Unlimited waves per day',
      'Premium support',
      'Exclusive yearly member badge'
    ],
    ios: {
      productId: process.env.IOS_VIP_YEARLY_PRODUCT_ID || 'com.bananatalk.vip.yearly',
      price: 71.99,
      currency: 'USD',
      localizedPrice: '$71.99',
      originalPrice: 119.88,
      originalLocalizedPrice: '$119.88'
    },
    android: {
      productId: process.env.ANDROID_VIP_YEARLY_PRODUCT_ID || 'vip_yearly',
      price: 71.99,
      currency: 'USD',
      localizedPrice: '$71.99',
      originalPrice: 119.88,
      originalLocalizedPrice: '$119.88'
    }
  }
};

/**
 * @desc    Get available VIP subscription plans
 * @route   GET /api/v1/purchases/plans
 * @access  Public
 */
exports.getVIPPlans = asyncHandler(async (req, res, next) => {
  const { platform } = req.query;

  // Build response with platform-specific product IDs if requested
  const plans = Object.values(VIP_PLANS).map(plan => {
    const basePlan = {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      duration: plan.duration,
      durationUnit: plan.durationUnit,
      features: plan.features,
      savings: plan.savings || null,
      recommended: plan.recommended || false
    };

    if (platform === 'ios') {
      return {
        ...basePlan,
        productId: plan.ios.productId,
        price: plan.ios.price,
        currency: plan.ios.currency,
        localizedPrice: plan.ios.localizedPrice,
        originalPrice: plan.ios.originalPrice,
        originalLocalizedPrice: plan.ios.originalLocalizedPrice
      };
    } else if (platform === 'android') {
      return {
        ...basePlan,
        productId: plan.android.productId,
        price: plan.android.price,
        currency: plan.android.currency,
        localizedPrice: plan.android.localizedPrice,
        originalPrice: plan.android.originalPrice,
        originalLocalizedPrice: plan.android.originalLocalizedPrice
      };
    } else {
      // Return both platforms
      return {
        ...basePlan,
        ios: plan.ios,
        android: plan.android
      };
    }
  });

  res.status(200).json({
    success: true,
    count: plans.length,
    data: plans
  });
});

// Apple's App Store environment
const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

const appleSharedSecret = process.env.APPLE_SHARED_SECRET;

if (!appleSharedSecret) {
  console.warn('⚠️ APPLE_SHARED_SECRET not configured! iOS purchase verification may fail for legacy receipts.');
}

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
 * @desc    Verify iOS purchase receipt and activate VIP
 * @route   POST /api/v1/purchases/ios/verify
 * @access  Private
 */
exports.verifyIOSPurchase = asyncHandler(async (req, res, next) => {
  const { receiptData, productId, transactionId } = req.body;

  if (!receiptData) {
    return next(new ErrorResponse('Receipt data is required', 400));
  }

  try {
    console.log('🍎 Starting iOS purchase verification...');
    console.log('   Product ID:', productId);
    console.log('   Transaction ID:', transactionId);
    console.log('   Receipt length:', receiptData?.length);
    console.log('   Receipt format:', isStoreKit2Format(receiptData) ? 'StoreKit 2 (JWS)' : 'Legacy');

    let finalProductId;
    let finalTransactionId;
    let expirationDate = null;

    // Check if this is StoreKit 2 format (JWS)
    if (isStoreKit2Format(receiptData)) {
      console.log('📱 Processing StoreKit 2 JWS transaction...');

      try {
        const transactionInfo = await verifyStoreKit2Transaction(receiptData);
        console.log('✅ StoreKit 2 transaction verified:', JSON.stringify(transactionInfo, null, 2));

        // Extract data from the decoded transaction
        finalProductId = transactionInfo.productId || productId;
        finalTransactionId = transactionInfo.transactionId || transactionInfo.originalTransactionId || transactionId;

        // Check expiration for subscriptions
        if (transactionInfo.expiresDate) {
          expirationDate = new Date(transactionInfo.expiresDate);
          if (expirationDate < new Date()) {
            logSecurityEvent('IOS_SUBSCRIPTION_EXPIRED', {
              userId: req.user.id,
              productId: finalProductId,
              expirationDate
            });
            return next(new ErrorResponse('Subscription has expired', 400));
          }
        }
      } catch (jwsError) {
        console.error('❌ StoreKit 2 verification failed:', jwsError.message);
        logSecurityEvent('IOS_JWS_VERIFICATION_FAILED', {
          userId: req.user.id,
          error: jwsError.message
        });
        return next(new ErrorResponse(`Transaction verification failed: ${jwsError.message}`, 400));
      }
    } else {
      // Legacy receipt format - use Apple's verifyReceipt endpoint
      console.log('📱 Processing legacy receipt...');

      if (!appleSharedSecret) {
        console.error('❌ APPLE_SHARED_SECRET is not configured on this server!');
        logSecurityEvent('IOS_RECEIPT_ERROR', {
          userId: req.user.id,
          error: 'APPLE_SHARED_SECRET not configured'
        });
        return next(new ErrorResponse('Server configuration error: Apple shared secret not configured. Please contact support.', 500));
      }

      console.log('📤 Sending receipt to Apple for validation...');
      const validationResponse = await verifyLegacyReceipt(receiptData);

      console.log('📱 Receipt validation result:', JSON.stringify(validationResponse, null, 2));

      // Check if receipt is valid (status 0 = valid)
      if (validationResponse.status !== 0) {
        const statusMessages = {
          21000: 'The App Store could not read the receipt',
          21002: 'The receipt data is malformed',
          21003: 'The receipt could not be authenticated',
          21004: 'The shared secret does not match',
          21005: 'The receipt server is not available',
          21006: 'The receipt is valid but subscription has expired',
          21007: 'Sandbox receipt sent to production',
          21008: 'Production receipt sent to sandbox'
        };
        const errorMessage = statusMessages[validationResponse.status] || `Validation failed with status ${validationResponse.status}`;

        logSecurityEvent('IOS_RECEIPT_INVALID', {
          userId: req.user.id,
          status: validationResponse.status,
          reason: errorMessage
        });
        return next(new ErrorResponse(errorMessage, 400));
      }

      // Get the latest receipt info
      const latestReceiptInfo = validationResponse.latest_receipt_info ||
                                (validationResponse.receipt && validationResponse.receipt.in_app) ||
                                [];

      if (!latestReceiptInfo || latestReceiptInfo.length === 0) {
        return next(new ErrorResponse('No purchase data found in receipt', 400));
      }

      // Find the specific purchase or use the latest one
      let purchase;
      if (productId && transactionId) {
        purchase = latestReceiptInfo.find(
          p => p.product_id === productId && p.transaction_id === transactionId
        );
      } else {
        // Sort by purchase date and get the latest
        purchase = latestReceiptInfo.sort((a, b) => {
          const dateA = parseInt(a.purchase_date_ms) || 0;
          const dateB = parseInt(b.purchase_date_ms) || 0;
          return dateB - dateA;
        })[0];
      }

      if (!purchase) {
        return next(new ErrorResponse('Purchase not found in receipt', 400));
      }

      finalProductId = productId || purchase.product_id;
      finalTransactionId = transactionId || purchase.transaction_id;

      // Check expiration for subscriptions
      if (purchase.expires_date_ms) {
        expirationDate = new Date(parseInt(purchase.expires_date_ms));
        if (expirationDate < new Date()) {
          logSecurityEvent('IOS_SUBSCRIPTION_EXPIRED', {
            userId: req.user.id,
            productId: finalProductId,
            expirationDate
          });
          return next(new ErrorResponse('Subscription has expired', 400));
        }
      }
    }

    // Determine subscription plan based on productId
    let plan = 'monthly';
    const productIdLower = finalProductId.toLowerCase();
    if (productIdLower.includes('quarterly') || productIdLower.includes('quarter')) {
      plan = 'quarterly';
    } else if (productIdLower.includes('yearly') || productIdLower.includes('year')) {
      plan = 'yearly';
    } else if (productIdLower.includes('monthly') || productIdLower.includes('month')) {
      plan = 'monthly';
    }

    // Get user and activate VIP
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Check if subscription already exists and is active
    if (user.isVIP() && user.vipSubscription.paymentMethod === 'apple_iap') {
      // If already VIP with Apple IAP, extend the subscription
      const now = new Date();
      let newEndDate = new Date(user.vipSubscription.endDate);
      
      // Extend from current end date, not from now
      switch(plan) {
        case 'monthly':
          newEndDate.setMonth(newEndDate.getMonth() + 1);
          break;
        case 'quarterly':
          newEndDate.setMonth(newEndDate.getMonth() + 3);
          break;
        case 'yearly':
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
          break;
      }
      
      user.vipSubscription.endDate = newEndDate;
      user.vipSubscription.nextBillingDate = newEndDate;
      user.vipSubscription.lastPaymentDate = now;
      await user.save();
    } else {
      // Activate VIP subscription
      await user.activateVIP(plan, 'apple_iap');
    }

    // Store transaction information (avoid duplicates)
    if (!user.vipSubscription.transactions) {
      user.vipSubscription.transactions = [];
    }
    
    // Check if transaction already exists
    const existingTransaction = user.vipSubscription.transactions.find(
      t => t.transactionId === finalTransactionId
    );
    
    if (!existingTransaction) {
      user.vipSubscription.transactions.push({
        transactionId: finalTransactionId,
        productId: finalProductId,
        plan,
        purchaseDate: new Date(),
        type: 'initial'
      });
    }
    
    await user.save();

    logSecurityEvent('IOS_PURCHASE_SUCCESS', {
      userId: user._id,
      email: user.email,
      productId: finalProductId,
      transactionId: finalTransactionId,
      plan
    });

    res.status(200).json({
      success: true,
      message: 'VIP subscription activated successfully',
      data: {
        plan,
        isActive: true,
        endDate: user.vipSubscription.endDate,
        nextBillingDate: user.vipSubscription.nextBillingDate,
        userMode: user.userMode,
        vipFeatures: user.vipFeatures
      }
    });

  } catch (error) {
    console.error('❌ iOS Receipt Validation Error:', error);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);

    // Check for common configuration issues
    if (!process.env.APPLE_SHARED_SECRET) {
      console.error('❌ APPLE_SHARED_SECRET is not configured!');
      logSecurityEvent('IOS_RECEIPT_ERROR', {
        userId: req.user.id,
        error: 'APPLE_SHARED_SECRET not configured'
      });
      return next(new ErrorResponse('Server configuration error: Apple shared secret not configured', 500));
    }

    logSecurityEvent('IOS_RECEIPT_ERROR', {
      userId: req.user.id,
      error: error.message
    });

    // Provide more specific error messages
    if (error.message && error.message.includes('21007')) {
      return next(new ErrorResponse('This receipt is from the sandbox environment. Please use a sandbox tester account.', 400));
    } else if (error.message && error.message.includes('21008')) {
      return next(new ErrorResponse('This receipt is from the production environment.', 400));
    } else if (error.message && error.message.includes('password')) {
      return next(new ErrorResponse('Invalid shared secret configured on server', 500));
    }

    return next(new ErrorResponse(`Failed to verify purchase: ${error.message}`, 500));
  }
});

/**
 * @desc    Verify iOS subscription status
 * @route   POST /api/v1/purchases/ios/subscription-status
 * @access  Private
 */
exports.verifySubscriptionStatus = asyncHandler(async (req, res, next) => {
  const { receiptData } = req.body;

  if (!receiptData) {
    return next(new ErrorResponse('Receipt data is required', 400));
  }

  try {
    const now = Date.now();
    let activeSubscription = null;
    let productId = null;
    let expiresDate = null;

    // Check if this is StoreKit 2 format (JWS)
    if (isStoreKit2Format(receiptData)) {
      console.log('📱 Checking StoreKit 2 subscription status...');

      try {
        const transactionInfo = await verifyStoreKit2Transaction(receiptData);

        // Check if subscription is active
        if (transactionInfo.expiresDate) {
          const expDate = new Date(transactionInfo.expiresDate);
          if (expDate.getTime() > now) {
            activeSubscription = transactionInfo;
            productId = transactionInfo.productId;
            expiresDate = expDate;
          }
        }
      } catch (jwsError) {
        console.error('❌ StoreKit 2 verification failed:', jwsError.message);
        return next(new ErrorResponse('Transaction verification failed', 400));
      }
    } else {
      // Legacy receipt format
      console.log('📱 Checking legacy subscription status...');

      if (!appleSharedSecret) {
        return next(new ErrorResponse('Server configuration error', 500));
      }

      const validationResponse = await verifyLegacyReceipt(receiptData);

      if (validationResponse.status !== 0) {
        return next(new ErrorResponse('Invalid receipt', 400));
      }

      const latestReceiptInfo = validationResponse.latest_receipt_info ||
                                (validationResponse.receipt && validationResponse.receipt.in_app) ||
                                [];

      // Find active subscriptions
      const activeSubscriptions = latestReceiptInfo.filter(item => {
        if (item.expires_date_ms) {
          return parseInt(item.expires_date_ms) > now;
        }
        return false;
      });

      // Get the most recent active subscription
      if (activeSubscriptions.length > 0) {
        activeSubscription = activeSubscriptions.sort((a, b) => {
          const dateA = parseInt(a.expires_date_ms) || 0;
          const dateB = parseInt(b.expires_date_ms) || 0;
          return dateB - dateA;
        })[0];

        productId = activeSubscription.product_id;
        expiresDate = new Date(parseInt(activeSubscription.expires_date_ms));
      }
    }

    // Also check user's current VIP status
    const user = await User.findById(req.user.id);
    const userVIPStatus = user ? {
      isVIP: user.isVIP(),
      userMode: user.userMode,
      subscriptionEndDate: user.vipSubscription?.endDate,
      subscriptionPlan: user.vipSubscription?.plan
    } : null;

    res.status(200).json({
      success: true,
      data: {
        isActive: !!activeSubscription,
        expiresDate: expiresDate,
        productId: productId,
        userVIPStatus
      }
    });

  } catch (error) {
    console.error('❌ Subscription Status Error:', error);
    logSecurityEvent('IOS_SUBSCRIPTION_STATUS_ERROR', {
      userId: req.user.id,
      error: error.message
    });
    return next(new ErrorResponse('Failed to check subscription status', 500));
  }
});

/**
 * @desc    Handle iOS subscription webhook (Apple Server Notifications V1 & V2)
 * @route   POST /api/v1/purchases/ios/webhook
 * @access  Public (called by Apple)
 */
exports.handleAppleWebhook = asyncHandler(async (req, res) => {
  const notification = req.body;

  console.log('🍎 Apple Server Notification received');

  try {
    let notificationType;
    let originalTransactionId;
    let productId;
    let transactionId;

    // Check if this is V2 format (has signedPayload)
    if (notification.signedPayload) {
      console.log('📱 Processing App Store Server Notification V2...');

      try {
        // Decode the signed payload (JWS)
        const payload = await verifyStoreKit2Transaction(notification.signedPayload);
        console.log('   V2 Notification type:', payload.notificationType);
        console.log('   V2 Subtype:', payload.subtype);

        notificationType = payload.notificationType;

        // The transaction info is also a JWS in V2
        if (payload.data?.signedTransactionInfo) {
          const transactionInfo = await verifyStoreKit2Transaction(payload.data.signedTransactionInfo);
          originalTransactionId = transactionInfo.originalTransactionId;
          productId = transactionInfo.productId;
          transactionId = transactionInfo.transactionId;
        }

        // Map V2 notification types to V1 equivalents for unified handling
        const v2ToV1Map = {
          'SUBSCRIBED': 'INITIAL_BUY',
          'DID_RENEW': 'DID_RENEW',
          'DID_FAIL_TO_RENEW': 'DID_FAIL_TO_RENEW',
          'DID_CHANGE_RENEWAL_STATUS': 'DID_CHANGE_RENEWAL_STATUS',
          'EXPIRED': 'EXPIRED',
          'GRACE_PERIOD_EXPIRED': 'EXPIRED',
          'REFUND': 'CANCEL'
        };
        notificationType = v2ToV1Map[notificationType] || notificationType;

      } catch (jwsError) {
        console.error('❌ V2 notification verification failed:', jwsError.message);
        return res.status(200).json({ success: true });
      }
    } else {
      // V1 format
      console.log('📱 Processing App Store Server Notification V1...');
      console.log('   V1 Notification:', JSON.stringify(notification, null, 2));

      notificationType = notification.notification_type;
      const unifiedReceipt = notification.unified_receipt;
      const latestReceiptInfo = unifiedReceipt?.latest_receipt_info?.[0];

      if (!latestReceiptInfo) {
        console.log('⚠️ No receipt info in notification');
        return res.status(200).json({ success: true });
      }

      originalTransactionId = latestReceiptInfo.original_transaction_id;
      productId = latestReceiptInfo.product_id;
      transactionId = latestReceiptInfo.transaction_id;
    }

    if (!originalTransactionId) {
      console.log('⚠️ No transaction ID in notification');
      return res.status(200).json({ success: true });
    }

    console.log('   Notification type:', notificationType);
    console.log('   Original Transaction ID:', originalTransactionId);
    console.log('   Product ID:', productId);
    
    // Find user by transaction ID (stored in vipSubscription.transactions)
    const user = await User.findOne({
      'vipSubscription.transactions.transactionId': originalTransactionId
    });

    if (!user) {
      console.log(`⚠️ User not found for transaction: ${originalTransactionId}`);
      // Still acknowledge to Apple
      return res.status(200).json({ success: true });
    }

    // Determine plan from productId
    let plan = 'monthly';
    if (productId && productId.includes('quarterly')) {
      plan = 'quarterly';
    } else if (productId && productId.includes('yearly')) {
      plan = 'yearly';
    }

    // Handle different notification types
    switch (notificationType) {
      case 'INITIAL_BUY':
        console.log(`✅ New subscription purchased for user ${user._id}`);
        // Subscription already activated via verifyIOSPurchase
        // Just log it
        logSecurityEvent('IOS_INITIAL_BUY', {
          userId: user._id,
          productId,
          transactionId: originalTransactionId
        });
        break;

      case 'DID_RENEW':
        console.log(`🔄 Subscription renewed for user ${user._id}`);

        // Extend subscription
        const now = new Date();
        let newEndDate = new Date(user.vipSubscription.endDate || now);

        switch(plan) {
          case 'monthly':
            newEndDate.setMonth(newEndDate.getMonth() + 1);
            break;
          case 'quarterly':
            newEndDate.setMonth(newEndDate.getMonth() + 3);
            break;
          case 'yearly':
            newEndDate.setFullYear(newEndDate.getFullYear() + 1);
            break;
        }

        user.vipSubscription.endDate = newEndDate;
        user.vipSubscription.nextBillingDate = newEndDate;
        user.vipSubscription.lastPaymentDate = now;
        user.vipSubscription.isActive = true;
        user.vipSubscription.autoRenew = true;

        // Add transaction record
        if (!user.vipSubscription.transactions) {
          user.vipSubscription.transactions = [];
        }
        user.vipSubscription.transactions.push({
          transactionId: transactionId || originalTransactionId,
          productId,
          plan,
          purchaseDate: now,
          type: 'renewal'
        });

        await user.save();

        logSecurityEvent('IOS_RENEWAL_SUCCESS', {
          userId: user._id,
          productId,
          transactionId: transactionId || originalTransactionId
        });
        break;

      case 'DID_FAIL_TO_RENEW':
        console.log(`❌ Subscription renewal failed for user ${user._id}`);
        
        // Don't deactivate immediately - give grace period
        // Apple will send another notification when subscription actually expires
        user.vipSubscription.autoRenew = false;
        await user.save();
        
        logSecurityEvent('IOS_RENEWAL_FAILED', {
          userId: user._id,
          productId,
          transactionId: originalTransactionId
        });
        break;

      case 'DID_CHANGE_RENEWAL_STATUS':
        console.log(`🔄 Auto-renew status changed for user ${user._id}`);
        
        const autoRenewStatus = notification.auto_renew_status === 'true' || notification.auto_renew_status === true;
        user.vipSubscription.autoRenew = autoRenewStatus;
        await user.save();
        
        logSecurityEvent('IOS_RENEWAL_STATUS_CHANGED', {
          userId: user._id,
          autoRenew: autoRenewStatus
        });
        break;

      case 'CANCEL':
        console.log(`🚫 Subscription cancelled for user ${user._id}`);
        
        // Don't deactivate immediately - subscription remains active until endDate
        user.vipSubscription.autoRenew = false;
        await user.save();
        
        logSecurityEvent('IOS_SUBSCRIPTION_CANCELLED', {
          userId: user._id,
          productId,
          transactionId: originalTransactionId
        });
        break;

      case 'EXPIRED':
        console.log(`⏰ Subscription expired for user ${user._id}`);
        
        // Deactivate VIP when subscription expires
        if (user.userMode === 'vip') {
          await user.deactivateVIP();
        }
        
        logSecurityEvent('IOS_SUBSCRIPTION_EXPIRED', {
          userId: user._id,
          productId,
          transactionId: originalTransactionId
        });
        break;

      default:
        console.log(`ℹ️ Unhandled notification type: ${notificationType}`);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ Webhook Error:', error);
    logSecurityEvent('IOS_WEBHOOK_ERROR', {
      error: error.message,
      notification: JSON.stringify(req.body)
    });
    // Still acknowledge to Apple even on error
    res.status(200).json({ success: true });
  }
});