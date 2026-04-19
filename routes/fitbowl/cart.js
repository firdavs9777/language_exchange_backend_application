const express = require('express');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  applyPromoCode
} = require('../../controllers/fitbowl/cart');

const router = express.Router();
const { protect } = require('../../middleware/fitbowl/auth');
const { validate } = require('../../middleware/fitbowl/validate');
const {
  addToCartValidation,
  updateCartItemValidation,
  applyPromoValidation
} = require('../../validators/fitbowl/cart');

router.use(protect);

router
  .route('/')
  .get(getCart)
  .delete(clearCart);

router
  .route('/items')
  .post(addToCartValidation, validate, addToCart);

router
  .route('/items/:itemId')
  .put(updateCartItemValidation, validate, updateCartItem)
  .delete(removeCartItem);

router
  .route('/promo')
  .post(applyPromoValidation, validate, applyPromoCode);

module.exports = router;
