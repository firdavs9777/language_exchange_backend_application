const { default: mongoose } = require("mongoose");

const StorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true
  },
  mediaUrl: String,
  mediaUrls: [String], // NEW: To support multiple uploads per story (to Spaces)
  mediaType: {
    type: String,
    enum: ['image', 'video','text'], 
    required: false
  },
  text: { type: String, maxLength: 5000 },
  backgroundColor: { type: String, default: '#000000' },
  privacy: { type: String, enum: ['public', 'friends', 'close_friends'], default: 'friends' },
  views: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    viewedAt: { type: Date, default: Date.now }
  }],
  viewCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
}, { timestamps: true });

module.exports = mongoose.model('Story', StorySchema);