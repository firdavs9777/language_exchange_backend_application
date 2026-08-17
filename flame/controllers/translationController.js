const translationService = require('../services/translationService');

async function translate(req, res) {
  const out = await translationService.translate({
    text: req.body.text,
    targetLang: req.body.target_lang,
    sourceLang: req.body.source_lang,
  });

  res.json({
    success: true,
    data: {
      // These key names are what lib/services/translation_service.dart parses.
      // The app is already shipped; renaming any of them breaks it silently,
      // because its _extractTranslation falls through to null rather than
      // erroring.
      translated_text: out.translatedText,
      detected_source_lang: out.detectedSourceLang,
      cached: out.cached,
    },
  });
}

module.exports = { translate };
