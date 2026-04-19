const express = require('express');
const {
  getKitchenOrders,
  updateOrderStatus,
  getKitchenStats
} = require('../../controllers/fitbowl/kitchen');

const router = express.Router();
const { protect, authorize } = require('../../middleware/fitbowl/auth');

router.use(protect);
router.use(authorize('kitchen_admin'));

router
  .route('/orders')
  .get(getKitchenOrders);

router
  .route('/orders/:id/status')
  .put(updateOrderStatus);

router
  .route('/stats')
  .get(getKitchenStats);

module.exports = router;
