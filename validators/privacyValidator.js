const { body } = require('express-validator');

/**
 * Validation rules for updating privacy settings
 */
exports.updatePrivacySettingsValidation = [
  body('privacySettings')
    .optional()
    .isObject().withMessage('Privacy settings must be an object'),
  
  body('privacySettings.showCountryRegion')
    .optional()
    .isBoolean().withMessage('showCountryRegion must be a boolean'),
  
  body('privacySettings.showCity')
    .optional()
    .isBoolean().withMessage('showCity must be a boolean'),
  
  body('privacySettings.showAge')
    .optional()
    .isBoolean().withMessage('showAge must be a boolean'),
  
  body('privacySettings.showZodiac')
    .optional()
    .isBoolean().withMessage('showZodiac must be a boolean'),
  
  body('privacySettings.showOnlineStatus')
    .optional()
    .isBoolean().withMessage('showOnlineStatus must be a boolean'),
  
  body('privacySettings.showGiftingLevel')
    .optional()
    .isBoolean().withMessage('showGiftingLevel must be a boolean'),
  
  body('privacySettings.birthdayNotification')
    .optional()
    .isBoolean().withMessage('birthdayNotification must be a boolean'),
  
  body('privacySettings.personalizedAds')
    .optional()
    .isBoolean().withMessage('personalizedAds must be a boolean')
];

