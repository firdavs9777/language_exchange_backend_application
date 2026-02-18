const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { logSecurityEvent } = require('../utils/securityLogger');
const { google } = require('googleapis');

// Google Play configuration
const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.bananatalk.app';

// Initialize Google Play API client
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
 * Verify purchase token with Google Play Developer API
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
 * @desc    Verify Android purchase and activate VIP
 * @route   POST /api/v1/purchases/android/verify
 * @access  Private
 */
exports.verifyAndroidPurchase = asyncHandler(async (req, res, next) => {
  const { purchaseToken, productId, orderId, packageName } = req.body;

  if (!purchaseToken) {
    return next(new ErrorResponse('Purchase token is required', 400));
  }

  if (!productId) {
    return next(new ErrorResponse('Product ID is required', 400));
  }

  const actualPackageName = packageName || PACKAGE_NAME;

  try {
    console.log('🤖 Starting Android purchase verification...');
    console.log('   Product ID:', productId);
    console.log('   Order ID:', orderId);
    console.log('   Package Name:', actualPackageName);
    console.log('   Token length:', purchaseToken?.length);

    // Verify with Google Play API
    const verificationResult = await verifyPurchaseWithGoogle(
      purchaseToken,
      productId,
      actualPackageName
    );

    if (!verificationResult.success) {
      logSecurityEvent('ANDROID_PURCHASE_VERIFICATION_FAILED', {
        userId: req.user.id,
        productId,
        error: verificationResult.error
      });
      return next(new ErrorResponse(`Purchase verification failed: ${verificationResult.error}`, 400));
    }

    const purchaseData = verificationResult.data;

    // Check purchase state
    // For subscriptions: 0 = purchased, 1 = canceled, 2 = pending
    // For products: 0 = purchased, 1 = canceled
    const purchaseState = purchaseData.paymentState || purchaseData.purchaseState;

    if (purchaseState === 1) {
      logSecurityEvent('ANDROID_PURCHASE_CANCELED', {
        userId: req.user.id,
        productId,
        orderId
      });
      return next(new ErrorResponse('Purchase was canceled', 400));
    }

    if (purchaseState === 2) {
      logSecurityEvent('ANDROID_PURCHASE_PENDING', {
        userId: req.user.id,
        productId,
        orderId
      });
      return next(new ErrorResponse('Purchase is pending', 400));
    }

    // Check expiration for subscriptions
    let expirationDate = null;
    if (purchaseData.expiryTimeMillis) {
      expirationDate = new Date(parseInt(purchaseData.expiryTimeMillis));
      if (expirationDate < new Date()) {
        logSecurityEvent('ANDROID_SUBSCRIPTION_EXPIRED', {
          userId: req.user.id,
          productId,
          expirationDate
        });
        return next(new ErrorResponse('Subscription has expired', 400));
      }
    }

    // Determine subscription plan based on productId
    let plan = 'monthly';
    const productIdLower = productId.toLowerCase();
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

    // Get the order ID from response or request
    const finalOrderId = purchaseData.orderId || orderId || purchaseToken.substring(0, 20);

    // Check if subscription already exists and is active
    if (user.isVIP() && user.vipSubscription.paymentMethod === 'google_play') {
      // If already VIP with Google Play, extend the subscription
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
      await user.activateVIP(plan, 'google_play');
    }

    // Store transaction information (avoid duplicates)
    if (!user.vipSubscription.transactions) {
      user.vipSubscription.transactions = [];
    }

    // Check if transaction already exists
    const existingTransaction = user.vipSubscription.transactions.find(
      t => t.transactionId === finalOrderId
    );

    if (!existingTransaction) {
      user.vipSubscription.transactions.push({
        transactionId: finalOrderId,
        productId: productId,
        plan,
        purchaseDate: new Date(),
        type: 'initial',
        platform: 'android',
        purchaseToken: purchaseToken.substring(0, 50) // Store truncated for reference
      });
    }

    await user.save();

    logSecurityEvent('ANDROID_PURCHASE_SUCCESS', {
      userId: user._id,
      email: user.email,
      productId: productId,
      orderId: finalOrderId,
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
    console.error('❌ Android Purchase Verification Error:', error);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);

    // Check for common configuration issues
    if (!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY) {
      console.error('❌ Google Play Service Account is not configured!');
      logSecurityEvent('ANDROID_PURCHASE_ERROR', {
        userId: req.user.id,
        error: 'Google Play Service Account not configured'
      });
      return next(new ErrorResponse('Server configuration error: Google Play credentials not configured', 500));
    }

    logSecurityEvent('ANDROID_PURCHASE_ERROR', {
      userId: req.user.id,
      error: error.message
    });

    return next(new ErrorResponse(`Failed to verify purchase: ${error.message}`, 500));
  }
});

/**
 * @desc    Check Android subscription status
 * @route   POST /api/v1/purchases/android/subscription-status
 * @access  Private
 */
exports.checkSubscriptionStatus = asyncHandler(async (req, res, next) => {
  const { purchaseToken, productId, packageName } = req.body;

  if (!purchaseToken || !productId) {
    return next(new ErrorResponse('Purchase token and product ID are required', 400));
  }

  const actualPackageName = packageName || PACKAGE_NAME;

  try {
    console.log('🤖 Checking Android subscription status...');
    console.log('   Product ID:', productId);
    console.log('   Package Name:', actualPackageName);

    // Verify with Google Play API
    const verificationResult = await verifyPurchaseWithGoogle(
      purchaseToken,
      productId,
      actualPackageName
    );

    if (!verificationResult.success) {
      return res.status(200).json({
        success: true,
        data: {
          isActive: false,
          error: verificationResult.error
        }
      });
    }

    const purchaseData = verificationResult.data;

    // Check if subscription is active
    let isActive = false;
    let expiresDate = null;

    if (purchaseData.expiryTimeMillis) {
      expiresDate = new Date(parseInt(purchaseData.expiryTimeMillis));
      isActive = expiresDate > new Date();
    } else {
      // For one-time purchases, check purchase state
      isActive = purchaseData.purchaseState === 0;
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
        isActive,
        expiresDate,
        productId,
        autoRenewing: purchaseData.autoRenewing || false,
        cancelReason: purchaseData.cancelReason,
        userVIPStatus
      }
    });

  } catch (error) {
    console.error('❌ Subscription Status Error:', error);
    logSecurityEvent('ANDROID_SUBSCRIPTION_STATUS_ERROR', {
      userId: req.user.id,
      error: error.message
    });
    return next(new ErrorResponse('Failed to check subscription status', 500));
  }
});

/**
 * @desc    Handle Google Play Real-time Developer Notifications (RTDN)
 * @route   POST /api/v1/purchases/android/webhook
 * @access  Public (called by Google)
 */
exports.handleGoogleWebhook = asyncHandler(async (req, res) => {
  const notification = req.body;

  console.log('🤖 Google Play RTDN received');
  console.log('   Notification:', JSON.stringify(notification, null, 2));

  try {
    // Google sends data in base64 encoded format
    let data;
    if (notification.message && notification.message.data) {
      const decodedData = Buffer.from(notification.message.data, 'base64').toString();
      data = JSON.parse(decodedData);
    } else {
      data = notification;
    }

    console.log('📱 Decoded notification data:', JSON.stringify(data, null, 2));

    const subscriptionNotification = data.subscriptionNotification;
    const oneTimeProductNotification = data.oneTimeProductNotification;

    if (subscriptionNotification) {
      const { notificationType, purchaseToken, subscriptionId } = subscriptionNotification;

      console.log('   Subscription notification type:', notificationType);
      console.log('   Subscription ID:', subscriptionId);

      // Notification types:
      // 1 = SUBSCRIPTION_RECOVERED
      // 2 = SUBSCRIPTION_RENEWED
      // 3 = SUBSCRIPTION_CANCELED
      // 4 = SUBSCRIPTION_PURCHASED
      // 5 = SUBSCRIPTION_ON_HOLD
      // 6 = SUBSCRIPTION_IN_GRACE_PERIOD
      // 7 = SUBSCRIPTION_RESTARTED
      // 12 = SUBSCRIPTION_REVOKED
      // 13 = SUBSCRIPTION_EXPIRED

      if ([3, 12, 13].includes(notificationType)) {
        // Subscription canceled, revoked, or expired
        console.log('📱 Subscription ended, deactivating VIP...');

        // Find user by purchase token in transactions
        const user = await User.findOne({
          'vipSubscription.transactions.purchaseToken': { $regex: purchaseToken.substring(0, 50) }
        });

        if (user) {
          await user.deactivateVIP('Subscription ended');
          logSecurityEvent('ANDROID_SUBSCRIPTION_ENDED', {
            userId: user._id,
            notificationType,
            subscriptionId
          });
        }
      } else if ([1, 2, 4, 7].includes(notificationType)) {
        // Subscription recovered, renewed, purchased, or restarted
        console.log('📱 Subscription active, ensuring VIP status...');

        // Find user by purchase token
        const user = await User.findOne({
          'vipSubscription.transactions.purchaseToken': { $regex: purchaseToken.substring(0, 50) }
        });

        if (user && !user.isVIP()) {
          // Reactivate VIP if not active
          const plan = subscriptionId.includes('yearly') ? 'yearly' :
                       subscriptionId.includes('quarterly') ? 'quarterly' : 'monthly';
          await user.activateVIP(plan, 'google_play');
          logSecurityEvent('ANDROID_SUBSCRIPTION_REACTIVATED', {
            userId: user._id,
            notificationType,
            subscriptionId
          });
        }
      }
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ Google Webhook Error:', error);
    logSecurityEvent('ANDROID_WEBHOOK_ERROR', {
      error: error.message
    });
    // Still return 200 to prevent retries
    res.status(200).json({ success: true, error: error.message });
  }
});
