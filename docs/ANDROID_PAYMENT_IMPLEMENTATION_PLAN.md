# Android Payment Backend Implementation Plan

## Overview

This document outlines the implementation plan for adding Google Play Billing support to the BananaTalk backend. The iOS payment infrastructure is already complete and production-ready, serving as a template for Android implementation.

## Current State

### What Exists
| Component | Status | Notes |
|-----------|--------|-------|
| `in-app-purchase` library | ✅ Installed | v1.11.4 - supports Google Play |
| User VIP schema | ✅ Ready | Can store `google_play` as payment method |
| iOS controller | ✅ Complete | 744 lines - template for Android |
| Purchase routes | ✅ Partial | Only iOS endpoints mounted |
| Validators | ✅ Partial | Only iOS validation rules |

### What's Missing
- Android purchase controller
- Android API endpoints
- Android validators
- Google Play credentials in `.env`
- Google Play webhook support (optional)

---

## Implementation Tasks

### Phase 1: Environment Setup

#### 1.1 Google Play Console Setup
- [ ] Create a Service Account in Google Cloud Console
- [ ] Grant Service Account access to Google Play Console (Finance permissions)
- [ ] Download Service Account JSON credentials
- [ ] Note the `packageName` from Play Console

#### 1.2 Environment Variables
Add to `.env`:
```bash
# Google Play Billing
GOOGLE_PLAY_PACKAGE_NAME=com.bananatalk.app
GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

### Phase 2: Backend Implementation

#### 2.1 Create Android Purchase Controller

**File:** `/controllers/androidPurchase.js`

**Methods to implement:**

```javascript
// 1. Verify Android purchase and activate VIP
exports.verifyAndroidPurchase = async (req, res) => {
  // Input: purchaseToken, productId, packageName
  // - Validate purchase token with Google Play API
  // - Extract subscription details
  // - Determine plan from productId
  // - Activate/extend VIP subscription
  // - Track transaction
  // - Return success with VIP status
};

// 2. Check subscription status
exports.checkAndroidSubscriptionStatus = async (req, res) => {
  // Input: purchaseToken, productId
  // - Query Google Play for current subscription state
  // - Return: isActive, expiryDate, autoRenewing, etc.
};

// 3. Handle Google Play webhook (optional)
exports.handleGooglePlayWebhook = async (req, res) => {
  // Input: Pub/Sub message from Google
  // - Decode base64 message data
  // - Parse notification type
  // - Update user subscription accordingly
};
```

**Implementation using `in-app-purchase` library:**

```javascript
const iap = require('in-app-purchase');

// Configure for Google Play
iap.config({
  googleServiceAccount: {
    clientEmail: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY,
  },
});

// Validate receipt
const validationResponse = await iap.validate({
  packageName: process.env.GOOGLE_PLAY_PACKAGE_NAME,
  productId: productId,
  purchaseToken: purchaseToken,
});

// Check if valid
if (iap.isValidated(validationResponse)) {
  const purchaseData = iap.getPurchaseData(validationResponse);
  // Process subscription...
}
```

#### 2.2 Product ID Mapping

**Google Play Product IDs** (must match Flutter app):
```javascript
const ANDROID_PRODUCTS = {
  'com.bananatalk.app.vip.monthly': { plan: 'monthly', days: 30 },
  'com.bananatalk.app.vip.quarterly': { plan: 'quarterly', days: 90 },
  'com.bananatalk.app.vip.yearly': { plan: 'yearly', days: 365 },
};
```

#### 2.3 Add Android Routes

**File:** `/routes/purchases.js`

```javascript
// Add to existing file
const androidPurchase = require('../controllers/androidPurchase');
const { verifyAndroidPurchaseValidation } = require('../validators/purchaseValidator');

// Android endpoints
router.post(
  '/android/verify',
  protect,
  verifyAndroidPurchaseValidation,
  androidPurchase.verifyAndroidPurchase
);

router.post(
  '/android/subscription-status',
  protect,
  androidPurchase.checkAndroidSubscriptionStatus
);

// Optional: Google Play webhook
router.post(
  '/android/webhook',
  androidPurchase.handleGooglePlayWebhook
);
```

#### 2.4 Add Android Validators

**File:** `/validators/purchaseValidator.js`

```javascript
// Add to existing file
exports.verifyAndroidPurchaseValidation = [
  body('purchaseToken')
    .notEmpty()
    .withMessage('Purchase token is required'),
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required'),
  body('packageName')
    .optional()
    .isString(),
];
```

---

### Phase 3: Security Implementation

#### 3.1 Security Event Logging

Add to `utils/securityLogger.js` events:
- `ANDROID_PURCHASE_SUCCESS`
- `ANDROID_PURCHASE_FAILED`
- `ANDROID_RECEIPT_INVALID`
- `ANDROID_SUBSCRIPTION_EXPIRED`
- `ANDROID_WEBHOOK_RECEIVED`

#### 3.2 Duplicate Transaction Prevention

```javascript
// Check for existing transaction before processing
const existingTransaction = user.vipSubscription.transactions.find(
  t => t.transactionId === orderId
);
if (existingTransaction) {
  return res.status(200).json({
    success: true,
    message: 'Transaction already processed',
    alreadyProcessed: true,
  });
}
```

#### 3.3 Token Validation

- Always validate purchase tokens server-side
- Never trust client-provided subscription status
- Verify package name matches expected value

---

### Phase 4: Testing

#### 4.1 Test Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Valid new subscription | VIP activated, transaction stored |
| Valid renewal | VIP extended, new transaction added |
| Invalid token | 400 error, security event logged |
| Duplicate transaction | 200 with `alreadyProcessed: true` |
| Expired subscription | VIP deactivated |
| Cancelled subscription | VIP remains until end date |

#### 4.2 Test with License Testing

- Add test accounts in Google Play Console
- Use static response product IDs for testing
- Test in debug builds before production

---

## File Structure After Implementation

```
backend/
├── controllers/
│   ├── iosPurchase.js          # Existing
│   └── androidPurchase.js      # NEW
├── routes/
│   └── purchases.js            # Updated
├── validators/
│   └── purchaseValidator.js    # Updated
├── models/
│   └── User.js                 # No changes needed
└── utils/
    └── securityLogger.js       # Add Android events
```

---

## API Endpoints Summary

### New Android Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/purchases/android/verify` | JWT | Verify purchase & activate VIP |
| POST | `/api/v1/purchases/android/subscription-status` | JWT | Check subscription status |
| POST | `/api/v1/purchases/android/webhook` | None | Google Play notifications |

### Request/Response Examples

**Verify Purchase Request:**
```json
POST /api/v1/purchases/android/verify
Authorization: Bearer <jwt_token>

{
  "purchaseToken": "opaque-token-from-google-play",
  "productId": "com.bananatalk.app.vip.monthly",
  "packageName": "com.bananatalk.app"
}
```

**Verify Purchase Response:**
```json
{
  "success": true,
  "message": "VIP subscription activated successfully",
  "vipStatus": {
    "isActive": true,
    "plan": "monthly",
    "startDate": "2024-01-15T10:30:00Z",
    "endDate": "2024-02-15T10:30:00Z",
    "autoRenew": true,
    "paymentMethod": "google_play"
  }
}
```

---

## Dependencies

No new dependencies required. The existing `in-app-purchase` package (v1.11.4) supports Google Play validation.

---

## Estimated Effort

| Task | Complexity |
|------|------------|
| Environment setup | Low |
| Android controller | Medium |
| Routes & validators | Low |
| Security logging | Low |
| Testing | Medium |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Google API rate limits | Implement caching for subscription status |
| Service account key security | Store in environment variables, not code |
| Webhook replay attacks | Validate message age, deduplicate by orderId |
| Token theft | Always verify server-side, log suspicious activity |

---

## Flutter App Changes Required

After backend is ready, the Flutter app needs:

1. Create `AndroidPurchaseService` (mirror `IOSPurchaseService`)
2. Configure Google Play product IDs
3. Update `VipPaymentScreen` to use real billing flow
4. Add `VipService.verifyAndroidPurchase()` method

See separate Flutter implementation plan for details.

---

## References

- [Google Play Billing Library](https://developer.android.com/google/play/billing)
- [in-app-purchase npm package](https://www.npmjs.com/package/in-app-purchase)
- [Real-time Developer Notifications](https://developer.android.com/google/play/billing/rtdn-reference)
- Existing iOS implementation: `/controllers/iosPurchase.js`
