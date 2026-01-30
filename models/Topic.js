const mongoose = require('mongoose');

/**
 * Topic Model
 * Represents community interest topics/tags
 */
const TopicSchema = new mongoose.Schema({
  // Topic identifier (e.g., "topic_travel", "topic_music")
  topicId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Display name
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  // Localized names
  localizedNames: {
    type: Map,
    of: String,
    default: {}
  },
  // Icon name (for Flutter icon lookup)
  icon: {
    type: String,
    default: 'tag'
  },
  // Category for grouping
  category: {
    type: String,
    enum: ['lifestyle', 'entertainment', 'education', 'sports', 'technology', 'culture', 'other'],
    default: 'other'
  },
  // Color for UI (hex code)
  color: {
    type: String,
    default: '#6200EE'
  },
  // Number of users interested in this topic
  userCount: {
    type: Number,
    default: 0
  },
  // Whether the topic is active/visible
  isActive: {
    type: Boolean,
    default: true
  },
  // Display order
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for listing active topics
TopicSchema.index({ isActive: 1, category: 1, order: 1 });
TopicSchema.index({ isActive: 1, userCount: -1 });

/**
 * Get topic name in a specific language
 */
TopicSchema.methods.getLocalizedName = function(lang = 'en') {
  return this.localizedNames?.get(lang) || this.name;
};

/**
 * Increment user count
 */
TopicSchema.statics.incrementUserCount = async function(topicId, increment = 1) {
  return this.findOneAndUpdate(
    { topicId },
    { $inc: { userCount: increment } },
    { new: true }
  );
};

/**
 * Seed default topics
 */
TopicSchema.statics.seedDefaults = async function() {
  const defaultTopics = [
    { topicId: 'topic_travel', name: 'Travel', icon: 'airplane', category: 'lifestyle', order: 1 },
    { topicId: 'topic_music', name: 'Music', icon: 'music_note', category: 'entertainment', order: 2 },
    { topicId: 'topic_movies', name: 'Movies & TV', icon: 'movie', category: 'entertainment', order: 3 },
    { topicId: 'topic_food', name: 'Food & Cooking', icon: 'restaurant', category: 'lifestyle', order: 4 },
    { topicId: 'topic_sports', name: 'Sports', icon: 'sports_soccer', category: 'sports', order: 5 },
    { topicId: 'topic_gaming', name: 'Gaming', icon: 'sports_esports', category: 'entertainment', order: 6 },
    { topicId: 'topic_books', name: 'Books & Reading', icon: 'menu_book', category: 'education', order: 7 },
    { topicId: 'topic_art', name: 'Art & Design', icon: 'palette', category: 'culture', order: 8 },
    { topicId: 'topic_technology', name: 'Technology', icon: 'computer', category: 'technology', order: 9 },
    { topicId: 'topic_fitness', name: 'Fitness', icon: 'fitness_center', category: 'sports', order: 10 },
    { topicId: 'topic_photography', name: 'Photography', icon: 'camera_alt', category: 'culture', order: 11 },
    { topicId: 'topic_nature', name: 'Nature', icon: 'park', category: 'lifestyle', order: 12 },
    { topicId: 'topic_fashion', name: 'Fashion', icon: 'checkroom', category: 'lifestyle', order: 13 },
    { topicId: 'topic_business', name: 'Business', icon: 'business', category: 'education', order: 14 },
    { topicId: 'topic_languages', name: 'Languages', icon: 'translate', category: 'education', order: 15 },
    { topicId: 'topic_pets', name: 'Pets', icon: 'pets', category: 'lifestyle', order: 16 },
    { topicId: 'topic_kpop', name: 'K-Pop', icon: 'star', category: 'entertainment', order: 17 },
    { topicId: 'topic_anime', name: 'Anime & Manga', icon: 'animation', category: 'entertainment', order: 18 }
  ];

  for (const topic of defaultTopics) {
    await this.findOneAndUpdate(
      { topicId: topic.topicId },
      topic,
      { upsert: true, new: true }
    );
  }
};

module.exports = mongoose.model('Topic', TopicSchema);
