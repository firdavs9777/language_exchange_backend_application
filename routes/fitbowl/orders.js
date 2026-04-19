const express = require('express');
const {
  placeOrder,
  getOrders,
  getActiveOrders,
  getOrder,
  cancelOrder,
  reorder,
  rateOrder
} = require('../../controllers/fitbowl/orders');

const router = express.Router();
const { protect } = require('../../middleware/fitbowl/auth');
const { validate } = require('../../middleware/fitbowl/validate');
const {
  placeOrderValidation,
  rateOrderValidation
} = require('../../validators/fitbowl/orders');

router.use(protect);

router
  .route('/')
  .post(placeOrderValidation, validate, placeOrder)
  .get(getOrders);

router
  .route('/active')
  .get(getActiveOrders);

router
  .route('/:id')
  .get(getOrder);

router
  .route('/:id/cancel')
  .put(cancelOrder);

router
  .route('/:id/reorder')
  .post(reorder);

router
  .route('/:id/rate')
  .post(rateOrderValidation, validate, rateOrder);

module.exports = router;
