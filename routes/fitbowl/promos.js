const express = require('express');
const {
  getPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  validatePromoCode
} = require('../../controllers/fitbowl/promos');

const router = express.Router();
const { protect, authorize } = require('../../middleware/fitbowl/auth');

router
  .route('/')
  .get(protect, authorize('kitchen_admin'), getPromoCodes)
  .post(protect, authorize('kitchen_admin'), createPromoCode);

router
  .route('/:id')
  .put(protect, authorize('kitchen_admin'), updatePromoCode)
  .delete(protect, authorize('kitchen_admin'), deletePromoCode);

router
  .route('/validate')
  .post(protect, validatePromoCode);

module.exports = router;
