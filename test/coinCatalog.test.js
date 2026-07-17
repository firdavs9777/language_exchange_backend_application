const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getUnlock, getPackByProductId, UNLOCKS, PACKS } = require('../config/coinCatalog');

test('getUnlock returns correct cost/grant for real featureKeys', () => {
  assert.deepEqual(getUnlock('translation'), { cost: 50, grant: 10 });
  assert.deepEqual(getUnlock('moment'), { cost: 40, grant: 3 });
  assert.deepEqual(getUnlock('roleplay'), { cost: 80, grant: 3 });
  // all 5 tutor chips exist and cap independently
  for (const chip of ['chat', 'roleplay', 'story', 'photo', 'pronunciation']) {
    assert.ok(getUnlock(chip), `unlock for chip ${chip} must exist`);
  }
});

test('getUnlock returns null for unknown key', () => {
  assert.equal(getUnlock('tutor'), null); // generic bucket is NOT a key (reviewer I2)
  assert.equal(getUnlock('nonsense'), null);
  assert.equal(getUnlock(undefined), null);
});

test('getPackByProductId resolves per-platform IAP productIds', () => {
  const ios = getPackByProductId('ios', 'com.bananatalk.bananatalkApp.coins.100');
  assert.equal(ios.coins, 100);
  const android = getPackByProductId('android', 'com.bananatalk.app.coins.1500');
  assert.equal(android.coins, 1750);
  assert.equal(getPackByProductId('ios', 'bogus.product'), null);
  assert.equal(getPackByProductId('windows', 'anything'), null);
});

test('every pack has a positive coin amount', () => {
  for (const [id, pack] of Object.entries(PACKS)) {
    assert.ok(pack.coins > 0, `pack ${id} must grant coins`);
  }
});
