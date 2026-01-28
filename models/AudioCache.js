const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Audio Cache Schema
 * Caches TTS-generated audio to reduce API costs
 */
const AudioCacheSchema = new mongoose.Schema({
  // Content hash for deduplication
  contentHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Original text
  text: {
    type: String,
    required: true,
    maxlength: 4096
  },

  // Language code
  language: {
    type: String,
    required: true,
    index: true
  },

  // Voice settings
  voice: {
    type: String,
    default: 'nova'
  },

  // Speed factor
  speed: {
    type: Number,
    default: 1.0,
    min: 0.25,
    max: 4.0
  },

  // Generated audio URL in Spaces
  audioUrl: {
    type: String,
    required: true
  },

  // Audio format
  format: {
    type: String,
    enum: ['mp3', 'opus', 'aac', 'flac'],
    default: 'mp3'
  },

  // Duration in seconds
  duration: Number,

  // File size in bytes
  fileSize: Number,

  // Usage stats
  usageCount: {
    type: Number,
    default: 0
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },

  // Source type for analytics
  sourceType: {
    type: String,
    enum: ['vocabulary', 'lesson', 'example', 'message', 'custom'],
    default: 'custom',
    index: true
  },

  // Provider
  provider: {
    type: String,
    enum: ['openai', 'elevenlabs', 'google', 'azure'],
    default: 'openai'
  }
}, { timestamps: true });

// TTL index - delete unused audio after 90 days
AudioCacheSchema.index(
  { lastAccessedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

/**
 * Generate content hash for caching
 */
AudioCacheSchema.statics.generateHash = function(text, language, voice, speed) {
  const content = `${text}|${language}|${voice}|${speed}`;
  return crypto.createHash('sha256').update(content).digest('hex');
};

/**
 * Get cached audio or return null
 */
AudioCacheSchema.statics.getCached = async function(text, language, voice = 'nova', speed = 1.0) {
  const hash = this.generateHash(text, language, voice, speed);

  const cached = await this.findOneAndUpdate(
    { contentHash: hash },
    {
      $inc: { usageCount: 1 },
      $set: { lastAccessedAt: new Date() }
    },
    { new: true }
  );

  return cached;
};

/**
 * Save audio to cache
 */
AudioCacheSchema.statics.saveToCache = async function(options) {
  const {
    text,
    language,
    voice = 'nova',
    speed = 1.0,
    audioUrl,
    format = 'mp3',
    duration,
    fileSize,
    sourceType = 'custom',
    provider = 'openai'
  } = options;

  const hash = this.generateHash(text, language, voice, speed);

  return await this.findOneAndUpdate(
    { contentHash: hash },
    {
      $set: {
        text,
        language,
        voice,
        speed,
        audioUrl,
        format,
        duration,
        fileSize,
        sourceType,
        provider,
        lastAccessedAt: new Date()
      },
      $inc: { usageCount: 1 }
    },
    { upsert: true, new: true }
  );
};

/**
 * Get cache statistics
 */
AudioCacheSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        totalSize: { $sum: '$fileSize' },
        totalUsage: { $sum: '$usageCount' },
        avgDuration: { $avg: '$duration' }
      }
    }
  ]);

  return stats[0] || {
    totalEntries: 0,
    totalSize: 0,
    totalUsage: 0,
    avgDuration: 0
  };
};

module.exports = mongoose.model('AudioCache', AudioCacheSchema);
