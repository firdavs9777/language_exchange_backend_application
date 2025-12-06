const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { logSecurityEvent } = require('../utils/securityLogger');
const iap = require('in-app-purchase');

// Configure in-app-purchase
iap.config({
  // Apple specific configuration
  applePassword: process.env.APPLE_SHARED_SECRET,
  // Use Apple's sandbox or production based on environment
  appleExcludeOldTransactions: true,
  verbose: process.env.NODE_ENV === 'development'
});

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
    // Setup IAP
    await iap.setup();

    // Validate the receipt
    const validationResponse = await iap.validate({
      receipt: receiptData,
      platform: 'apple'
    });

    console.log('📱 Receipt validation result:', validationResponse);

    // Check if receipt is valid
    if (!iap.isValidated(validationResponse)) {
      logSecurityEvent('IOS_RECEIPT_INVALID', {
        userId: req.user.id,
        reason: 'Receipt validation failed'
      });
      return next(new ErrorResponse('Invalid receipt', 400));
    }

    // Get purchase info
    const purchaseData = iap.getPurchaseData(validationResponse);
    
    if (!purchaseData || purchaseData.length === 0) {
      return next(new ErrorResponse('No purchase data found in receipt', 400));
    }

    // Find the specific purchase
    // If productId and transactionId provided, find exact match
    // Otherwise, use the latest purchase
    let purchase;
    if (productId && transactionId) {
      purchase = purchaseData.find(
        p => p.productId === productId && p.transactionId === transactionId
      );
    } else {
      // Use the most recent purchase
      purchase = purchaseData.sort((a, b) => {
        const dateA = a.purchaseDate ? new Date(a.purchaseDate) : new Date(0);
        const dateB = b.purchaseDate ? new Date(b.purchaseDate) : new Date(0);
        return dateB - dateA;
      })[0];
    }

    if (!purchase) {
      return next(new ErrorResponse('Purchase not found in receipt', 400));
    }

    // Use purchase productId if not provided in request
    const finalProductId = productId || purchase.productId;
    const finalTransactionId = transactionId || purchase.transactionId;

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
    logSecurityEvent('IOS_RECEIPT_ERROR', {
      userId: req.user.id,
      error: error.message
    });
    return next(new ErrorResponse('Failed to verify purchase', 500));
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
    await iap.setup();

    const validationResponse = await iap.validate({
      receipt: receiptData,
      platform: 'apple'
    });

    if (!iap.isValidated(validationResponse)) {
      return next(new ErrorResponse('Invalid receipt', 400));
    }

    const purchaseData = iap.getPurchaseData(validationResponse);
    
    // Check for active subscriptions
    const now = Date.now();
    const activeSubscriptions = purchaseData.filter(item => {
      if (item.expirationDate) {
        return new Date(item.expirationDate).getTime() > now;
      }
      return false;
    });

    // Get the most recent active subscription
    const activeSubscription = activeSubscriptions.sort((a, b) => {
      const dateA = a.expirationDate ? new Date(a.expirationDate) : new Date(0);
      const dateB = b.expirationDate ? new Date(b.expirationDate) : new Date(0);
      return dateB - dateA;
    })[0];

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
        expiresDate: activeSubscription?.expirationDate || null,
        productId: activeSubscription?.productId || null,
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
 * @desc    Handle iOS subscription webhook (Apple Server Notifications)
 * @route   POST /api/v1/purchases/ios/webhook
 * @access  Public (called by Apple)
 */
exports.handleAppleWebhook = asyncHandler(async (req, res, next) => {
  const notification = req.body;

  console.log('🍎 Apple Server Notification:', JSON.stringify(notification, null, 2));

  try {
    const notificationType = notification.notification_type;
    const unifiedReceipt = notification.unified_receipt;
    const latestReceiptInfo = unifiedReceipt?.latest_receipt_info?.[0];
    
    if (!latestReceiptInfo) {
      console.log('⚠️ No receipt info in notification');
      return res.status(200).json({ success: true });
    }

    const originalTransactionId = latestReceiptInfo.original_transaction_id;
    const productId = latestReceiptInfo.product_id;
    
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
    if (productId.includes('quarterly')) {
      plan = 'quarterly';
    } else if (productId.includes('yearly')) {
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
          transactionId: latestReceiptInfo.transaction_id,
          productId,
          plan,
          purchaseDate: now,
          type: 'renewal'
        });
        
        await user.save();
        
        logSecurityEvent('IOS_RENEWAL_SUCCESS', {
          userId: user._id,
          productId,
          transactionId: latestReceiptInfo.transaction_id
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