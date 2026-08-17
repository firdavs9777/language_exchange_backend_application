const mongoose = require('mongoose');
const { getConn } = require('../db');

// One translated string.
//
// Keyed by a hash of the source text plus the language pair rather than the
// text itself: message text runs to 2000 characters, and an index on that is
// neither small nor fast. The hash is fixed-width and unique.
const translationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    sourceLang: { type: String, required: true },
    targetLang: { type: String, required: true },
    translatedText: { type: String, required: true },
  },
  { timestamps: true },
);

module.exports = getConn().model('Translation', translationSchema);
