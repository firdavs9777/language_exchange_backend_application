const express = require('express');
const {
  verifyIOSPurchase,
  verifySubscriptionStatus,
  handleAppleWebhook
} = require('../controllers/iosPurchase');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { 
  verifyIOSPurchaseValidation, 
  verifySubscriptionStatusValidation 
} = require('../validators/purchaseValidator');
const router = express.Router();

// Public webhook endpoint (called by Apple)
// No authentication required - Apple calls this directly
router.post('/ios/webhook', handleAppleWebhook);

// Protected endpoints (require authentication)
router.post('/ios/verify', protect, verifyIOSPurchaseValidation, validate, verifyIOSPurchase);
router.post('/ios/subscription-status', protect, verifySubscriptionStatusValidation, validate, verifySubscriptionStatus);

module.exports = router;

