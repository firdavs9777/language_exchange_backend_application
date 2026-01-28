const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Alternative Translation Schema
 */
const AlternativeSchema = new mongoose.Schema({
  text: String,
  context: String,
  formality: {
    type: String,
    enum: ['formal', 'neutral', 'informal', 'slang']
  }
}, { _id: false });

/**
 * Word Breakdown Schema
 */
const BreakdownSchema = new mongoose.Schema({
  original: String,
  translated: String,
  partOfSpeech: String,
  notes: String
}, { _id: false });

/**
 * Grammar Point Schema
 */
const GrammarPointSchema = new mongoose.Schema({
  aspect: String,
  sourceRule: String,
  targetRule: String,
  example: String
}, { _id: false });

/**
 * Idiom Schema
 */
const IdiomSchema = new mongoose.Schema({
  original: String,
  meaning: String,
  equivalent: String,
  literal: String
}, { _id: false });

/**
 * Enhanced Translation Schema
 * Caches AI-powered translations with educational context
 */
const EnhancedTranslationSchema = new mongoose.Schema({
  // Content hash for deduplication
  contentHash: {
    type: String,
    required: true,
    index: true
  },

  // Original text
  sourceText: {
    type: String,
    required: true,
    maxlength: 5000
  },

  // Source language
  sourceLanguage: {
    type: String,
    required: true,
    index: true
  },

  // Target language
  targetLanguage: {
    type: String,
    required: true,
    index: true
  },

  // Primary translation
  translation: {
    type: String,
    required: true
  },

  // Alternative translations
  alternatives: [AlternativeSchema],

  // Word-by-word breakdown
  breakdown: [BreakdownSchema],

  // Grammar explanations
  grammar: [GrammarPointSchema],

  // Idioms detected and explained
  idioms: [IdiomSchema],

  // Cultural context
  cultural: {
    notes: String,
    formality: String,
    region: String
  },

  // Analysis flags
  analysis: {
    isIdiom: { type: Boolean, default: false },
    isSlang: { type: Boolean, default: false },
    isInformal: { type: Boolean, default: false },
    tone: String,
    complexity: {
      type: String,
      enum: ['simple', 'moderate', 'complex']
    }
  },

  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },

  // Token usage for cost tracking
  tokensUsed: {
    input: Number,
    output: Number
  },

  // Provider used
  provider: {
    type: String,
    enum: ['openai', 'anthropic', 'google'],
    default: 'openai'
  }
}, { timestamps: true });

// Compound index for cache lookup
EnhancedTranslationSchema.index(
  { contentHash: 1, sourceLanguage: 1, targetLanguage: 1 },
  { unique: true }
);

// TTL index - delete old translations after 30 days of no access
EnhancedTranslationSchema.index(
  { lastAccessedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

/**
 * Generate content hash for caching
 */
EnhancedTranslationSchema.statics.generateHash = function(text, sourceLanguage, targetLanguage) {
  const content = `${text.toLowerCase().trim()}|${sourceLanguage}|${targetLanguage}`;
  return crypto.createHash('sha256').update(content).digest('hex');
};

/**
 * Get cached translation or return null
 */
EnhancedTranslationSchema.statics.getCached = async function(text, sourceLanguage, targetLanguage) {
  const hash = this.generateHash(text, sourceLanguage, targetLanguage);

  const cached = await this.findOneAndUpdate(
    {
      contentHash: hash,
      sourceLanguage,
      targetLanguage
    },
    {
      $inc: { usageCount: 1 },
      $set: { lastAccessedAt: new Date() }
    },
    { new: true }
  );

  return cached;
};

/**
 * Save translation to cache
 */
EnhancedTranslationSchema.statics.saveToCache = async function(options) {
  const {
    sourceText,
    sourceLanguage,
    targetLanguage,
    translation,
    alternatives = [],
    breakdown = [],
    grammar = [],
    idioms = [],
    cultural = {},
    analysis = {},
    tokensUsed = {},
    provider = 'openai'
  } = options;

  const hash = this.generateHash(sourceText, sourceLanguage, targetLanguage);

  return await this.findOneAndUpdate(
    {
      contentHash: hash,
      sourceLanguage,
      targetLanguage
    },
    {
      $set: {
        sourceText,
        translation,
        alternatives,
        breakdown,
        grammar,
        idioms,
        cultural,
        analysis,
        tokensUsed,
        provider,
        lastAccessedAt: new Date()
      },
      $inc: { usageCount: 1 }
    },
    { upsert: true, new: true }
  );
};

/**
 * Get popular translations
 */
EnhancedTranslationSchema.statics.getPopular = async function(language, limit = 10) {
  return await this.find({
    targetLanguage: language
  })
    .sort({ usageCount: -1 })
    .limit(limit)
    .select('sourceText translation sourceLanguage usageCount')
    .lean();
};

/**
 * Get cache statistics
 */
EnhancedTranslationSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        totalUsage: { $sum: '$usageCount' },
        avgUsage: { $avg: '$usageCount' },
        totalTokensInput: { $sum: '$tokensUsed.input' },
        totalTokensOutput: { $sum: '$tokensUsed.output' }
      }
    }
  ]);

  const byLanguage = await this.aggregate([
    {
      $group: {
        _id: { source: '$sourceLanguage', target: '$targetLanguage' },
        count: { $sum: 1 },
        usage: { $sum: '$usageCount' }
      }
    },
    { $sort: { usage: -1 } },
    { $limit: 10 }
  ]);

  return {
    ...(stats[0] || {
      totalEntries: 0,
      totalUsage: 0,
      avgUsage: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0
    }),
    byLanguagePair: byLanguage
  };
};

module.exports = mongoose.model('EnhancedTranslation', EnhancedTranslationSchema);
