const express = require('express');
const {
  verifyIOSPurchase,
  verifySubscriptionStatus,
  handleAppleWebhook,
  getVIPPlans
} = require('../controllers/iosPurchase');
const {
  verifyAndroidPurchase,
  checkSubscriptionStatus: checkAndroidSubscriptionStatus,
  handleGoogleWebhook
} = require('../controllers/androidPurchase');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  verifyAppleWebhookSignature,
  verifyGoogleWebhookSignature,
  verifyWebhookIP,
  APPLE_IP_RANGES,
  GOOGLE_IP_RANGES
} = require('../middleware/webhookAuth');
const {
  verifyIOSPurchaseValidation,
  verifySubscriptionStatusValidation,
  verifyAndroidPurchaseValidation,
  verifyAndroidSubscriptionStatusValidation
} = require('../validators/purchaseValidator');
const router = express.Router();

// =====================
// Public Routes
// =====================

// Get available VIP plans (public endpoint for displaying prices before login)
router.get('/plans', getVIPPlans);

// =====================
// iOS Routes
// =====================

// Public webhook endpoint (called by Apple)
// Security: IP whitelist + signature verification
router.post(
  '/ios/webhook',
  verifyWebhookIP(APPLE_IP_RANGES),
  verifyAppleWebhookSignature,
  handleAppleWebhook
);

// Protected iOS endpoints
router.post('/ios/verify', protect, verifyIOSPurchaseValidation, validate, verifyIOSPurchase);
router.post('/ios/subscription-status', protect, verifySubscriptionStatusValidation, validate, verifySubscriptionStatus);

// =====================
// Android Routes
// =====================

// Public webhook endpoint (called by Google Play RTDN)
// Security: IP whitelist + bearer token verification
router.post(
  '/android/webhook',
  verifyWebhookIP(GOOGLE_IP_RANGES),
  verifyGoogleWebhookSignature,
  handleGoogleWebhook
);

// Protected Android endpoints
router.post('/android/verify', protect, verifyAndroidPurchaseValidation, validate, verifyAndroidPurchase);
router.post('/android/subscription-status', protect, verifyAndroidSubscriptionStatusValidation, validate, checkAndroidSubscriptionStatus);

module.exports = router;

