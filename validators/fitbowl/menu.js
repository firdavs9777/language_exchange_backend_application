const { body } = require('express-validator');

/**
 * Validation rules for creating a menu item
 */
exports.createMenuItemValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must not exceed 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),

  body('category')
    .notEmpty().withMessage('Category is required')
    .isMongoId().withMessage('Category must be a valid ID'),

  body('basePrice')
    .notEmpty().withMessage('Base price is required')
    .isFloat({ min: 0 }).withMessage('Base price must be a positive number'),

  body('sizes')
    .optional()
    .isArray().withMessage('Sizes must be an array'),

  body('sizes.*.name')
    .optional()
    .trim()
    .notEmpty().withMessage('Size name is required'),

  body('sizes.*.priceModifier')
    .optional()
    .isFloat().withMessage('Size price modifier must be a number'),

  body('nutrition')
    .optional()
    .isObject().withMessage('Nutrition must be an object'),

  body('nutrition.calories')
    .optional()
    .isFloat({ min: 0 }).withMessage('Calories must be a positive number'),

  body('nutrition.protein')
    .optional()
    .isFloat({ min: 0 }).withMessage('Protein must be a positive number'),

  body('nutrition.carbs')
    .optional()
    .isFloat({ min: 0 }).withMessage('Carbs must be a positive number'),

  body('nutrition.fat')
    .optional()
    .isFloat({ min: 0 }).withMessage('Fat must be a positive number'),

  body('nutrition.fiber')
    .optional()
    .isFloat({ min: 0 }).withMessage('Fiber must be a positive number'),

  body('dietaryTags')
    .optional()
    .isArray().withMessage('Dietary tags must be an array'),

  body('allergens')
    .optional()
    .isArray().withMessage('Allergens must be an array'),

  body('ingredients')
    .optional()
    .isArray().withMessage('Ingredients must be an array'),

  body('preparationTime')
    .optional()
    .isInt({ min: 1 }).withMessage('Preparation time must be at least 1 minute')
];

/**
 * Validation rules for updating a menu item
 */
exports.updateMenuItemValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Name must not exceed 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),

  body('category')
    .optional()
    .isMongoId().withMessage('Category must be a valid ID'),

  body('basePrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Base price must be a positive number'),

  body('sizes')
    .optional()
    .isArray().withMessage('Sizes must be an array'),

  body('sizes.*.name')
    .optional()
    .trim()
    .notEmpty().withMessage('Size name is required'),

  body('sizes.*.priceModifier')
    .optional()
    .isFloat().withMessage('Size price modifier must be a number'),

  body('nutrition')
    .optional()
    .isObject().withMessage('Nutrition must be an object'),

  body('nutrition.calories')
    .optional()
    .isFloat({ min: 0 }).withMessage('Calories must be a positive number'),

  body('nutrition.protein')
    .optional()
    .isFloat({ min: 0 }).withMessage('Protein must be a positive number'),

  body('nutrition.carbs')
    .optional()
    .isFloat({ min: 0 }).withMessage('Carbs must be a positive number'),

  body('nutrition.fat')
    .optional()
    .isFloat({ min: 0 }).withMessage('Fat must be a positive number'),

  body('nutrition.fiber')
    .optional()
    .isFloat({ min: 0 }).withMessage('Fiber must be a positive number'),

  body('dietaryTags')
    .optional()
    .isArray().withMessage('Dietary tags must be an array'),

  body('allergens')
    .optional()
    .isArray().withMessage('Allergens must be an array'),

  body('ingredients')
    .optional()
    .isArray().withMessage('Ingredients must be an array'),

  body('preparationTime')
    .optional()
    .isInt({ min: 1 }).withMessage('Preparation time must be at least 1 minute')
];
