const express = require('express');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../../controllers/fitbowl/categories');

const router = express.Router();
const { protect, authorize } = require('../../middleware/fitbowl/auth');
const { validate } = require('../../middleware/fitbowl/validate');
const {
  createCategoryValidation,
  updateCategoryValidation
} = require('../../validators/fitbowl/categories');

router
  .route('/')
  .get(getCategories)
  .post(protect, authorize('kitchen_admin'), createCategoryValidation, validate, createCategory);

router
  .route('/:id')
  .get(getCategory)
  .put(protect, authorize('kitchen_admin'), updateCategoryValidation, validate, updateCategory)
  .delete(protect, authorize('kitchen_admin'), deleteCategory);

module.exports = router;
