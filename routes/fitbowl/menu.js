const express = require('express');
const {
  getMenuItems,
  getFeaturedItems,
  getRecommendations,
  searchMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
} = require('../../controllers/fitbowl/menu');

const router = express.Router();
const { protect, authorize } = require('../../middleware/fitbowl/auth');
const { validate } = require('../../middleware/fitbowl/validate');
const {
  createMenuItemValidation,
  updateMenuItemValidation
} = require('../../validators/fitbowl/menu');

router
  .route('/')
  .get(getMenuItems)
  .post(protect, authorize('kitchen_admin'), createMenuItemValidation, validate, createMenuItem);

router
  .route('/featured')
  .get(getFeaturedItems);

router
  .route('/recommendations')
  .get(protect, getRecommendations);

router
  .route('/search')
  .get(searchMenuItems);

router
  .route('/:id')
  .get(getMenuItem)
  .put(protect, authorize('kitchen_admin'), updateMenuItemValidation, validate, updateMenuItem)
  .delete(protect, authorize('kitchen_admin'), deleteMenuItem);

module.exports = router;
