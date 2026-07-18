/**
 * Coins v1 — REST routes (Workstream F), mounted at /api/v1/coins.
 *
 * Every route is wrapped by:
 *   1. `coinsEnabledGuard` — the centralized COINS_ENABLED kill switch;
 *      short-circuits the whole module to 404 when coins are disabled
 *      (mirrors routes/rooms.js's roomsEnabledGuard).
 *   2. `protect` — auth; populates req.user.
 *
 * See controllers/coins.js + docs/superpowers/specs/2026-07-13-coins-v1-design.md.
 */

const express = require('express');
const router = express.Router();

const {
  getBalance,
  getTransactions,
  getUnlockCatalog,
  verifyPurchase,
  unlock,
  claimDailyReward,
  getDailyRewardStatus,
  claimAdReward,
  coinsEnabledGuard,
} = require('../controllers/coins');

const { protect } = require('../middleware/auth');

// Kill switch first — returns 404 for every coin route when COINS_ENABLED is
// false, before any auth work.
router.use(coinsEnabledGuard);
router.use(protect);

router.get('/balance', getBalance);
router.get('/transactions', getTransactions);
router.get('/unlock-catalog', getUnlockCatalog);
router.post('/verify-purchase', verifyPurchase);
router.post('/unlock', unlock);

// Coins v2 (Task 17a) — free earn loop.
router.post('/daily-reward', claimDailyReward);
router.get('/daily-reward/status', getDailyRewardStatus);
router.post('/ad-reward', claimAdReward);

module.exports = router;
