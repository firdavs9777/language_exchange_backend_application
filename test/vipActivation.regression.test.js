const { test, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Task 4 regression (reviewer I1): after extracting the shared receipt
// verifier, the EXISTING VIP subscription verify controllers must STILL
// activate VIP. We mock the shared receipt core (lib/appleReceipt /
// lib/googlePlayReceipt) to return a valid subscription receipt, mock the User
// model, and assert the controller calls activateVIP + returns success.
// ---------------------------------------------------------------------------

const mockVerifyIOSReceipt = mock.fn();
const mockVerifyAndroidReceipt = mock.fn();
const mockUserFindById = mock.fn();
const mockLogSecurityEvent = mock.fn(async () => {});

mock.module('../lib/appleReceipt.js', {
  namedExports: {
    verifyIOSReceipt: mockVerifyIOSReceipt,
    verifyStoreKit2Transaction: mock.fn(),
    verifyLegacyReceipt: mock.fn(),
    isStoreKit2Format: mock.fn(),
  },
});

mock.module('../lib/googlePlayReceipt.js', {
  namedExports: {
    verifyAndroidReceipt: mockVerifyAndroidReceipt,
    verifyPurchaseWithGoogle: mock.fn(),
    getAndroidPublisher: mock.fn(),
    PACKAGE_NAME: 'com.bananatalk.app',
  },
});

mock.module('../models/User.js', {
  defaultExport: {
    findById: mockUserFindById,
  },
});

mock.module('../utils/securityLogger.js', {
  namedExports: {
    logSecurityEvent: mockLogSecurityEvent,
  },
});

const iosPurchase = require('../controllers/iosPurchase');
const androidPurchase = require('../controllers/androidPurchase');

// A fake user that records whether activateVIP fired.
function makeFakeUser() {
  const user = {
    _id: 'user_1',
    email: 'test@bananatalk.app',
    userMode: 'regular',
    vipFeatures: {},
    vipSubscription: { transactions: [], paymentMethod: null, endDate: null, nextBillingDate: null },
    activateVIPCalls: [],
    saveCalls: 0,
    isVIP() { return false; }, // not currently VIP -> takes the activateVIP branch
    async activateVIP(plan, method) {
      this.activateVIPCalls.push({ plan, method });
      this.userMode = 'vip';
      this.vipSubscription.paymentMethod = method;
      this.vipSubscription.plan = plan;
      this.vipSubscription.endDate = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      this.vipSubscription.nextBillingDate = this.vipSubscription.endDate;
    },
    async save() { this.saveCalls++; },
  };
  return user;
}

function makeResNext() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  const nextErrors = [];
  const next = (err) => { if (err) nextErrors.push(err); };
  return { res, next, nextErrors };
}

beforeEach(() => {
  mockVerifyIOSReceipt.mock.resetCalls();
  mockVerifyAndroidReceipt.mock.resetCalls();
  mockUserFindById.mock.resetCalls();
});

test('iOS VIP verify still activates VIP after the shared-core extraction', async () => {
  const user = makeFakeUser();
  mockUserFindById.mock.mockImplementation(async () => user);
  mockVerifyIOSReceipt.mock.mockImplementation(async () => ({
    valid: true,
    format: 'storekit2',
    productId: 'com.bananatalk.vip.yearly',
    transactionId: 'txn_vip_1',
    originalTransactionId: 'orig_vip_1',
    expiresDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    decoded: {},
  }));

  const req = { body: { receiptData: 'eyJ...vipJWS', productId: 'com.bananatalk.vip.yearly', transactionId: 'txn_vip_1' }, user: { id: 'user_1' } };
  const { res, next, nextErrors } = makeResNext();

  await iosPurchase.verifyIOSPurchase(req, res, next);

  assert.equal(nextErrors.length, 0, `no error expected, got: ${nextErrors[0] && nextErrors[0].message}`);
  assert.equal(user.activateVIPCalls.length, 1, 'activateVIP must be called exactly once');
  assert.equal(user.activateVIPCalls[0].plan, 'yearly');
  assert.equal(user.activateVIPCalls[0].method, 'apple_iap');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.plan, 'yearly');
  // The consumable transactionId is recorded on the VIP subscription unchanged.
  assert.ok(user.vipSubscription.transactions.some(t => t.transactionId === 'txn_vip_1'));
});

test('iOS VIP verify still rejects an invalid receipt (no activation)', async () => {
  const user = makeFakeUser();
  mockUserFindById.mock.mockImplementation(async () => user);
  mockVerifyIOSReceipt.mock.mockImplementation(async () => ({
    valid: false,
    format: 'storekit2',
    jwsError: new Error('bad signature'),
  }));

  const req = { body: { receiptData: 'eyJ...tampered' }, user: { id: 'user_1' } };
  const { res, next, nextErrors } = makeResNext();

  await iosPurchase.verifyIOSPurchase(req, res, next);

  assert.equal(user.activateVIPCalls.length, 0, 'no VIP activation on invalid receipt');
  assert.equal(nextErrors.length, 1);
  assert.equal(nextErrors[0].statusCode, 400);
  assert.match(nextErrors[0].message, /Transaction verification failed/);
});

test('Android VIP verify still activates VIP after the shared-core extraction', async () => {
  const user = makeFakeUser();
  mockUserFindById.mock.mockImplementation(async () => user);
  mockVerifyAndroidReceipt.mock.mockImplementation(async () => ({
    valid: true,
    productId: 'vip_monthly',
    transactionId: 'purchase_token_vip',
    purchaseState: 0,
    expiryTimeMillis: String(Date.now() + 30 * 24 * 3600 * 1000),
    raw: {
      purchaseState: 0,
      orderId: 'GPA.1234',
      expiryTimeMillis: String(Date.now() + 30 * 24 * 3600 * 1000),
    },
  }));

  const req = { body: { purchaseToken: 'purchase_token_vip', productId: 'vip_monthly', orderId: 'GPA.1234' }, user: { id: 'user_1' } };
  const { res, next, nextErrors } = makeResNext();

  await androidPurchase.verifyAndroidPurchase(req, res, next);

  assert.equal(nextErrors.length, 0, `no error expected, got: ${nextErrors[0] && nextErrors[0].message}`);
  assert.equal(user.activateVIPCalls.length, 1, 'activateVIP must be called exactly once');
  assert.equal(user.activateVIPCalls[0].plan, 'monthly');
  assert.equal(user.activateVIPCalls[0].method, 'google_play');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});
