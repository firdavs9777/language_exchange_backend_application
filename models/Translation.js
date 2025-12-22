const mongoose = require('mongoose');

const TranslationSchema = new mongoose.Schema({
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  sourceType: {
    type: String,
    enum: ['moment', 'comment'],
    required: true,
    index: true
  },
  sourceLanguage: {
    type: String,
    required: true
  },
  targetLanguage: {
    type: String,
    required: true,
    index: true
  },
  translatedText: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    enum: ['google', 'deepl', 'microsoft'],
    default: 'google'
  },
  cached: {
    type: Boolean,
    default: true
  },
  cachedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound unique index for fast lookups
TranslationSchema.index({ sourceId: 1, sourceType: 1, targetLanguage: 1 }, { unique: true });

// TTL index for cache expiration (optional - 30 days)
TranslationSchema.index({ cachedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Static method to get translation
TranslationSchema.statics.getTranslation = async function(sourceId, sourceType, targetLanguage) {
  return await this.findOne({
    sourceId,
    sourceType,
    targetLanguage
  });
};

// Static method to get all translations for a source
TranslationSchema.statics.getTranslations = async function(sourceId, sourceType) {
  return await this.find({
    sourceId,
    sourceType
  }).sort({ targetLanguage: 1 });
};

// Static method to save or update translation
TranslationSchema.statics.saveTranslation = async function(data) {
  const { sourceId, sourceType, sourceLanguage, targetLanguage, translatedText, provider = 'google' } = data;
  
  return await this.findOneAndUpdate(
    { sourceId, sourceType, targetLanguage },
    {
      sourceId,
      sourceType,
      sourceLanguage,
      targetLanguage,
      translatedText,
      provider,
      cached: true,
      cachedAt: new Date(),
      updatedAt: new Date()
    },
    {
      upsert: true,
      new: true
    }
  );
};

module.exports = mongoose.model('Translation', TranslationSchema);

