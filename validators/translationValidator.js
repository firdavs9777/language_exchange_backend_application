const { body } = require('express-validator');

/**
 * Validation for translation requests
 */
exports.translateValidation = [
  body('targetLanguage')
    .notEmpty().withMessage('Target language is required')
    .isString().withMessage('Target language must be a string')
    .isLength({ min: 2, max: 5 }).withMessage('Target language must be a valid ISO 639-1 code (2-5 characters)')
    .trim()
    .toLowerCase()
    .custom((value) => {
      // Validate against supported languages
      const supportedLanguages = [
        'en', 'zh', 'ko', 'ru', 'es', 'ar', 'fr', 'de', 'ja', 'pt', 'it', 'hi', 
        'th', 'vi', 'id', 'tr', 'pl', 'nl', 'sv', 'da', 'fi', 'no', 'cs', 'hu', 
        'ro', 'el', 'he', 'uk', 'bg', 'hr', 'sk', 'sl', 'et', 'lv', 'lt', 'mt', 
        'ga', 'cy'
      ];
      if (!supportedLanguages.includes(value)) {
        throw new Error(`Unsupported language code: ${value}`);
      }
      return true;
    })
];

