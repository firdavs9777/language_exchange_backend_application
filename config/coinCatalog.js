/**
 * Coins v1 — tunable constants for coin packs (IAP consumables) and
 * à-la-carte unlocks. Costs/grants live server-side so the app can read
 * them live via GET /api/v1/coins/unlock-catalog and never drift out of
 * sync with what actually gets charged.
 *
 * featureKeys are the REAL enforcement keys (reviewer I2) — NOT a generic
 * "tutor" bucket: each of the 5 tutor chips caps independently, so each
 * gets its own unlock. See models/User.js's TUTOR_QUOTA_FIELDS +
 * coinBonus (Task 3) for where these are actually consumed.
 */

// Coin packs — see the spec table (docs/superpowers/specs/2026-07-13-coins-v1-design.md
// §3) for the matching iOS/Android product IDs and store prices. Keyed by
// pack id so verify-purchase can map an incoming productId -> coin amount.
const PACKS = {
  small: { id: 'small', coins: 100, priceUSD: 0.99 },
  medium: { id: 'medium', coins: 525, priceUSD: 3.99 }, // 500 base + 25 bonus
  large: { id: 'large', coins: 1750, priceUSD: 9.99 }, // 1500 base + 250 bonus
};

// Per-platform productId -> pack id, so verify-purchase can resolve how
// many coins a given IAP productId is worth.
const PACK_PRODUCT_IDS = {
  ios: {
    'com.bananatalk.bananatalkApp.coins.100': 'small',
    'com.bananatalk.bananatalkApp.coins.500': 'medium',
    'com.bananatalk.bananatalkApp.coins.1500': 'large',
  },
  android: {
    'com.bananatalk.app.coins.100': 'small',
    'com.bananatalk.app.coins.500': 'medium',
    'com.bananatalk.app.coins.1500': 'large',
  },
};

// À-la-carte unlocks — cost (coins) to grant `grant` extra uses, added to
// the persistent User.coinBonus[featureKey] pool (Task 3). `translation`
// and `moment` are their own quota systems; the 5 tutor chips
// (chat/roleplay/story/photo/pronunciation) each cap independently.
const UNLOCKS = {
  translation: { cost: 50, grant: 10 },
  moment: { cost: 40, grant: 3 },
  chat: { cost: 80, grant: 3 },
  roleplay: { cost: 80, grant: 3 },
  story: { cost: 80, grant: 3 },
  photo: { cost: 80, grant: 3 },
  pronunciation: { cost: 80, grant: 3 },
  // dm = extra direct messages for the CURRENT day only. Distinct from
  // 'chat' (which is the AI-tutor chat chip's quota). Raises
  // regularUserLimitations.messagesSentToday's effective daily cap by
  // `grant`; the bonus is reset to 0 on the next day's rollover (see
  // User.canSendMessage), not carried forward.
  dm: { cost: 40, grant: 5 },
};

/**
 * @param {String} featureKey
 * @returns {{cost:number, grant:number}|null}
 */
function getUnlock(featureKey) {
  return UNLOCKS[featureKey] || null;
}

/**
 * Resolve a coin pack from its per-platform IAP productId.
 * @param {'ios'|'android'} platform
 * @param {String} productId
 * @returns {{id:string, coins:number, priceUSD:number}|null}
 */
function getPackByProductId(platform, productId) {
  const packId = PACK_PRODUCT_IDS[platform] && PACK_PRODUCT_IDS[platform][productId];
  return packId ? PACKS[packId] : null;
}

module.exports = {
  PACKS,
  PACK_PRODUCT_IDS,
  UNLOCKS,
  getUnlock,
  getPackByProductId,
};
