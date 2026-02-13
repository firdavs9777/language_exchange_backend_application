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
    enum: ['food_drink', 'travel', 'sports', 'entertainment', 'arts', 'lifestyle', 'pets_nature', 'learning', 'social', 'health', 'music', 'other'],
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
    // Food & Drink
    { topicId: 'eating_out', name: 'Eating Out', icon: '🍽️', category: 'food_drink', order: 1 },
    { topicId: 'cooking', name: 'Cooking', icon: '🍳', category: 'food_drink', order: 2 },
    { topicId: 'drinking', name: 'Drinking', icon: '🍻', category: 'food_drink', order: 3 },
    { topicId: 'coffee', name: 'Coffee', icon: '☕', category: 'food_drink', order: 4 },
    { topicId: 'tea', name: 'Tea', icon: '🍵', category: 'food_drink', order: 5 },
    { topicId: 'baking', name: 'Baking', icon: '🧁', category: 'food_drink', order: 6 },
    { topicId: 'wine', name: 'Wine', icon: '🍷', category: 'food_drink', order: 7 },
    { topicId: 'vegetarian', name: 'Vegetarian', icon: '🥗', category: 'food_drink', order: 8 },
    { topicId: 'desserts', name: 'Desserts', icon: '🍰', category: 'food_drink', order: 9 },
    { topicId: 'street_food', name: 'Street Food', icon: '🌮', category: 'food_drink', order: 10 },

    // Travel & Adventure
    { topicId: 'travel', name: 'Travel', icon: '✈️', category: 'travel', order: 11 },
    { topicId: 'backpacking', name: 'Backpacking', icon: '🎒', category: 'travel', order: 12 },
    { topicId: 'road_trips', name: 'Road Trips', icon: '🚗', category: 'travel', order: 13 },
    { topicId: 'beaches', name: 'Beaches', icon: '🏖️', category: 'travel', order: 14 },
    { topicId: 'mountains', name: 'Mountains', icon: '🏔️', category: 'travel', order: 15 },
    { topicId: 'camping', name: 'Camping', icon: '⛺', category: 'travel', order: 16 },
    { topicId: 'city_trips', name: 'City Trips', icon: '🏙️', category: 'travel', order: 17 },
    { topicId: 'culture_travel', name: 'Cultural Travel', icon: '🏛️', category: 'travel', order: 18 },

    // Sports & Fitness
    { topicId: 'gym', name: 'Gym', icon: '🏋️', category: 'sports', order: 19 },
    { topicId: 'running', name: 'Running', icon: '🏃', category: 'sports', order: 20 },
    { topicId: 'yoga', name: 'Yoga', icon: '🧘', category: 'sports', order: 21 },
    { topicId: 'swimming', name: 'Swimming', icon: '🏊', category: 'sports', order: 22 },
    { topicId: 'football', name: 'Football', icon: '⚽', category: 'sports', order: 23 },
    { topicId: 'basketball', name: 'Basketball', icon: '🏀', category: 'sports', order: 24 },
    { topicId: 'tennis', name: 'Tennis', icon: '🎾', category: 'sports', order: 25 },
    { topicId: 'hiking', name: 'Hiking', icon: '🥾', category: 'sports', order: 26 },
    { topicId: 'cycling', name: 'Cycling', icon: '🚴', category: 'sports', order: 27 },
    { topicId: 'dancing', name: 'Dancing', icon: '💃', category: 'sports', order: 28 },
    { topicId: 'martial_arts', name: 'Martial Arts', icon: '🥋', category: 'sports', order: 29 },
    { topicId: 'skiing', name: 'Skiing', icon: '⛷️', category: 'sports', order: 30 },

    // Entertainment
    { topicId: 'movies', name: 'Movies', icon: '🎬', category: 'entertainment', order: 31 },
    { topicId: 'tv_shows', name: 'TV Shows', icon: '📺', category: 'entertainment', order: 32 },
    { topicId: 'music', name: 'Music', icon: '🎵', category: 'entertainment', order: 33 },
    { topicId: 'concerts', name: 'Concerts', icon: '🎤', category: 'entertainment', order: 34 },
    { topicId: 'gaming', name: 'Gaming', icon: '🎮', category: 'entertainment', order: 35 },
    { topicId: 'anime', name: 'Anime', icon: '🎌', category: 'entertainment', order: 36 },
    { topicId: 'manga', name: 'Manga', icon: '📖', category: 'entertainment', order: 37 },
    { topicId: 'kpop', name: 'K-Pop', icon: '🇰🇷', category: 'entertainment', order: 38 },
    { topicId: 'kdrama', name: 'K-Drama', icon: '🎭', category: 'entertainment', order: 39 },
    { topicId: 'netflix', name: 'Netflix', icon: '🍿', category: 'entertainment', order: 40 },
    { topicId: 'podcasts', name: 'Podcasts', icon: '🎧', category: 'entertainment', order: 41 },
    { topicId: 'comedy', name: 'Comedy', icon: '😂', category: 'entertainment', order: 42 },

    // Arts & Culture
    { topicId: 'art', name: 'Art', icon: '🎨', category: 'arts', order: 43 },
    { topicId: 'photography', name: 'Photography', icon: '📷', category: 'arts', order: 44 },
    { topicId: 'books', name: 'Books', icon: '📚', category: 'arts', order: 45 },
    { topicId: 'writing', name: 'Writing', icon: '✍️', category: 'arts', order: 46 },
    { topicId: 'poetry', name: 'Poetry', icon: '📝', category: 'arts', order: 47 },
    { topicId: 'museums', name: 'Museums', icon: '🏛️', category: 'arts', order: 48 },
    { topicId: 'theater', name: 'Theater', icon: '🎭', category: 'arts', order: 49 },
    { topicId: 'history', name: 'History', icon: '📜', category: 'arts', order: 50 },
    { topicId: 'design', name: 'Design', icon: '🖌️', category: 'arts', order: 51 },

    // Lifestyle
    { topicId: 'fashion', name: 'Fashion', icon: '👗', category: 'lifestyle', order: 52 },
    { topicId: 'beauty', name: 'Beauty', icon: '💄', category: 'lifestyle', order: 53 },
    { topicId: 'shopping', name: 'Shopping', icon: '🛍️', category: 'lifestyle', order: 54 },
    { topicId: 'skincare', name: 'Skincare', icon: '🧴', category: 'lifestyle', order: 55 },
    { topicId: 'home_decor', name: 'Home Decor', icon: '🏠', category: 'lifestyle', order: 56 },
    { topicId: 'gardening', name: 'Gardening', icon: '🌱', category: 'lifestyle', order: 57 },
    { topicId: 'diy', name: 'DIY', icon: '🔨', category: 'lifestyle', order: 58 },
    { topicId: 'minimalism', name: 'Minimalism', icon: '✨', category: 'lifestyle', order: 59 },

    // Pets & Nature
    { topicId: 'dogs', name: 'Dogs', icon: '🐕', category: 'pets_nature', order: 60 },
    { topicId: 'cats', name: 'Cats', icon: '🐈', category: 'pets_nature', order: 61 },
    { topicId: 'pets', name: 'Pets', icon: '🐾', category: 'pets_nature', order: 62 },
    { topicId: 'nature', name: 'Nature', icon: '🌿', category: 'pets_nature', order: 63 },
    { topicId: 'animals', name: 'Animals', icon: '🦁', category: 'pets_nature', order: 64 },
    { topicId: 'birds', name: 'Birds', icon: '🐦', category: 'pets_nature', order: 65 },
    { topicId: 'aquarium', name: 'Aquarium', icon: '🐠', category: 'pets_nature', order: 66 },

    // Learning & Career
    { topicId: 'language_exchange', name: 'Language Exchange', icon: '🗣️', category: 'learning', order: 67 },
    { topicId: 'language_tips', name: 'Language Tips', icon: '💡', category: 'learning', order: 68 },
    { topicId: 'study_abroad', name: 'Study Abroad', icon: '🎓', category: 'learning', order: 69 },
    { topicId: 'career', name: 'Career', icon: '💼', category: 'learning', order: 70 },
    { topicId: 'technology', name: 'Technology', icon: '💻', category: 'learning', order: 71 },
    { topicId: 'programming', name: 'Programming', icon: '👨‍💻', category: 'learning', order: 72 },
    { topicId: 'business', name: 'Business', icon: '📊', category: 'learning', order: 73 },
    { topicId: 'startups', name: 'Startups', icon: '🚀', category: 'learning', order: 74 },
    { topicId: 'science', name: 'Science', icon: '🔬', category: 'learning', order: 75 },
    { topicId: 'finance', name: 'Finance', icon: '💰', category: 'learning', order: 76 },

    // Social
    { topicId: 'daily_life', name: 'Daily Life', icon: '☀️', category: 'social', order: 77 },
    { topicId: 'making_friends', name: 'Making Friends', icon: '🤝', category: 'social', order: 78 },
    { topicId: 'relationships', name: 'Relationships', icon: '💕', category: 'social', order: 79 },
    { topicId: 'family', name: 'Family', icon: '👨‍👩‍👧‍👦', category: 'social', order: 80 },
    { topicId: 'parenting', name: 'Parenting', icon: '👶', category: 'social', order: 81 },
    { topicId: 'news', name: 'News & Events', icon: '📰', category: 'social', order: 82 },
    { topicId: 'politics', name: 'Politics', icon: '🏛️', category: 'social', order: 83 },
    { topicId: 'volunteering', name: 'Volunteering', icon: '🙋', category: 'social', order: 84 },
    { topicId: 'nightlife', name: 'Nightlife', icon: '🌃', category: 'social', order: 85 },

    // Health & Wellness
    { topicId: 'mental_health', name: 'Mental Health', icon: '🧠', category: 'health', order: 86 },
    { topicId: 'meditation', name: 'Meditation', icon: '🧘‍♂️', category: 'health', order: 87 },
    { topicId: 'nutrition', name: 'Nutrition', icon: '🥑', category: 'health', order: 88 },
    { topicId: 'wellness', name: 'Wellness', icon: '💆', category: 'health', order: 89 },
    { topicId: 'self_improvement', name: 'Self Improvement', icon: '📈', category: 'health', order: 90 },
    { topicId: 'sleep', name: 'Sleep', icon: '😴', category: 'health', order: 91 },

    // Music
    { topicId: 'guitar', name: 'Guitar', icon: '🎸', category: 'music', order: 92 },
    { topicId: 'piano', name: 'Piano', icon: '🎹', category: 'music', order: 93 },
    { topicId: 'singing', name: 'Singing', icon: '🎤', category: 'music', order: 94 },
    { topicId: 'djing', name: 'DJing', icon: '🎧', category: 'music', order: 95 },
    { topicId: 'classical_music', name: 'Classical Music', icon: '🎻', category: 'music', order: 96 },
    { topicId: 'rock', name: 'Rock', icon: '🤘', category: 'music', order: 97 },
    { topicId: 'hiphop', name: 'Hip Hop', icon: '🎤', category: 'music', order: 98 },
    { topicId: 'electronic', name: 'Electronic', icon: '🎛️', category: 'music', order: 99 }
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
