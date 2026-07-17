const { test, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Task 4 — shared consumable receipt verifier (lib/consumableReceipt.js).
// We mock the per-platform verification core so no crypto / network / Google
// Play calls run: valid -> {valid:true, productId, transactionId}; invalid ->
// {valid:false}. transactionId is the PINNED per-platform idempotency id
// (reviewer C3): iOS = StoreKit consumable transactionId; Android = purchaseToken.
// ---------------------------------------------------------------------------

const mockVerifyIOSReceipt = mock.fn();
const mockVerifyAndroidReceipt = mock.fn();

mock.module('../lib/appleReceipt.js', {
  namedExports: {
    verifyIOSReceipt: mockVerifyIOSReceipt,
    // primitives are not used by consumableReceipt but keep the shape complete
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

const { verifyConsumableReceipt } = require('../lib/consumableReceipt');
const { getPackByProductId, PACKS } = require('../config/coinCatalog');

beforeEach(() => {
  mockVerifyIOSReceipt.mock.resetCalls();
  mockVerifyAndroidReceipt.mock.resetCalls();
});

test('ios: valid receipt -> {valid, productId, transactionId} (pinned StoreKit transactionId)', async () => {
  mockVerifyIOSReceipt.mock.mockImplementation(async () => ({
    valid: true,
    format: 'storekit2',
    productId: 'com.bananatalk.bananatalkApp.coins.100',
    transactionId: 'txn_consumable_123',
    originalTransactionId: 'txn_original_000',
    expiresDate: null,
  }));

  const out = await verifyConsumableReceipt({
    platform: 'ios',
    productId: 'com.bananatalk.bananatalkApp.coins.100',
    receipt: 'eyJ...someJWS',
    purchaseIdentifier: 'txn_consumable_123',
  });

  assert.deepEqual(out, {
    valid: true,
    productId: 'com.bananatalk.bananatalkApp.coins.100',
    transactionId: 'txn_consumable_123', // NOT the originalTransactionId (reviewer C3)
  });
});

test('ios: invalid receipt -> {valid:false}', async () => {
  mockVerifyIOSReceipt.mock.mockImplementation(async () => ({
    valid: false,
    format: 'storekit2',
    jwsError: new Error('bad signature'),
  }));

  const out = await verifyConsumableReceipt({
    platform: 'ios',
    productId: 'com.bananatalk.bananatalkApp.coins.100',
    receipt: 'eyJ...tampered',
    purchaseIdentifier: 'txn_1',
  });

  assert.deepEqual(out, { valid: false });
});

test('android: valid purchase -> transactionId is the purchaseToken (reviewer C3)', async () => {
  mockVerifyAndroidReceipt.mock.mockImplementation(async ({ purchaseToken }) => ({
    valid: true,
    productId: 'com.bananatalk.app.coins.1500',
    transactionId: purchaseToken,
    purchaseState: 0,
    raw: {},
  }));

  const out = await verifyConsumableReceipt({
    platform: 'android',
    productId: 'com.bananatalk.app.coins.1500',
    receipt: 'purchase_token_abc',
    purchaseIdentifier: 'purchase_token_abc',
  });

  assert.deepEqual(out, {
    valid: true,
    productId: 'com.bananatalk.app.coins.1500',
    transactionId: 'purchase_token_abc',
  });
});

test('android: canceled purchaseState (1) -> {valid:false} (no coins for a consumable)', async () => {
  mockVerifyAndroidReceipt.mock.mockImplementation(async ({ purchaseToken }) => ({
    valid: true,
    productId: 'com.bananatalk.app.coins.100',
    transactionId: purchaseToken,
    purchaseState: 1, // canceled
    raw: {},
  }));

  const out = await verifyConsumableReceipt({
    platform: 'android',
    productId: 'com.bananatalk.app.coins.100',
    receipt: 'purchase_token_canceled',
  });

  assert.deepEqual(out, { valid: false });
});

test('android: google verification failed -> {valid:false}', async () => {
  mockVerifyAndroidReceipt.mock.mockImplementation(async () => ({
    valid: false,
    error: 'purchase token not found',
  }));

  const out = await verifyConsumableReceipt({
    platform: 'android',
    productId: 'com.bananatalk.app.coins.100',
    receipt: 'bogus_token',
  });

  assert.deepEqual(out, { valid: false });
});

test('missing receipt -> {valid:false} without calling any platform verifier', async () => {
  const out = await verifyConsumableReceipt({ platform: 'ios', productId: 'x' });
  assert.deepEqual(out, { valid: false });
  assert.equal(mockVerifyIOSReceipt.mock.callCount(), 0);
});

test('unknown platform -> {valid:false}', async () => {
  const out = await verifyConsumableReceipt({
    platform: 'windows',
    productId: 'x',
    receipt: 'y',
  });
  assert.deepEqual(out, { valid: false });
});

test('verified coin-pack productId maps to coins via coinCatalog.PACKS', async () => {
  // This is the seam Task 5 relies on: verifier returns a productId, the catalog
  // resolves it to a coin amount.
  mockVerifyIOSReceipt.mock.mockImplementation(async () => ({
    valid: true,
    format: 'storekit2',
    productId: 'com.bananatalk.bananatalkApp.coins.500',
    transactionId: 'txn_medium',
    originalTransactionId: null,
    expiresDate: null,
  }));

  const out = await verifyConsumableReceipt({
    platform: 'ios',
    productId: 'com.bananatalk.bananatalkApp.coins.500',
    receipt: 'eyJ...medium',
    purchaseIdentifier: 'txn_medium',
  });

  assert.equal(out.valid, true);
  const pack = getPackByProductId('ios', out.productId);
  assert.ok(pack, 'productId must resolve to a known pack');
  assert.equal(pack.coins, PACKS.medium.coins); // 525
});
