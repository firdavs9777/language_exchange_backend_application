const mongoose = require('mongoose');

/**
 * Story Highlight Schema
 * Allows users to save stories to their profile permanently
 * Similar to Instagram Highlights
 */
const StoryHighlightSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Highlight info
  title: {
    type: String,
    required: [true, 'Highlight title is required'],
    maxlength: [50, 'Title cannot exceed 50 characters'],
    trim: true
  },
  
  // Cover image (first story or custom)
  coverImage: {
    type: String,
    default: null
  },
  
  // Stories in this highlight
  stories: [{
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Story'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Story count (for quick access)
  storyCount: {
    type: Number,
    default: 0
  },
  
  // Order in profile (for sorting)
  order: {
    type: Number,
    default: 0
  },
  
  // Privacy (inherit from stories or override)
  privacy: {
    type: String,
    enum: ['public', 'friends', 'close_friends'],
    default: 'public'
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
  
}, { timestamps: true });

// Indexes
StoryHighlightSchema.index({ user: 1, order: 1 });

// Method to add story to highlight
StoryHighlightSchema.methods.addStory = async function(storyId) {
  // Check if already added
  const exists = this.stories.some(s => s.story.toString() === storyId.toString());
  if (exists) return this;
  
  this.stories.push({ story: storyId, addedAt: new Date() });
  this.storyCount = this.stories.length;
  
  // Update cover if first story
  if (this.stories.length === 1 && !this.coverImage) {
    const Story = mongoose.model('Story');
    const story = await Story.findById(storyId);
    if (story && story.mediaUrls && story.mediaUrls.length > 0) {
      this.coverImage = story.mediaUrls[0];
    }
  }
  
  // Update story's highlight reference
  const Story = mongoose.model('Story');
  await Story.findByIdAndUpdate(storyId, { highlight: this._id });
  
  return this.save();
};

// Method to remove story from highlight
StoryHighlightSchema.methods.removeStory = async function(storyId) {
  this.stories = this.stories.filter(s => s.story.toString() !== storyId.toString());
  this.storyCount = this.stories.length;
  
  // Clear story's highlight reference
  const Story = mongoose.model('Story');
  await Story.findByIdAndUpdate(storyId, { $unset: { highlight: 1 } });
  
  return this.save();
};

// Method to reorder stories
StoryHighlightSchema.methods.reorderStories = function(storyIds) {
  const reordered = [];
  
  for (const id of storyIds) {
    const story = this.stories.find(s => s.story.toString() === id.toString());
    if (story) {
      reordered.push(story);
    }
  }
  
  this.stories = reordered;
  return this.save();
};

// Method to set cover
StoryHighlightSchema.methods.setCover = function(imageUrl) {
  this.coverImage = imageUrl;
  return this.save();
};

// Static to get user's highlights
StoryHighlightSchema.statics.getUserHighlights = async function(userId) {
  return await this.find({
    user: userId,
    isActive: true
  })
  .populate({
    path: 'stories.story',
    select: 'mediaUrls mediaType text backgroundColor createdAt viewCount'
  })
  .sort({ order: 1 })
  .lean();
};

// Static to create highlight from story
StoryHighlightSchema.statics.createFromStory = async function(userId, storyId, title) {
  const highlight = await this.create({
    user: userId,
    title,
    stories: [{ story: storyId }],
    storyCount: 1
  });
  
  // Update story's highlight reference
  const Story = mongoose.model('Story');
  const story = await Story.findById(storyId);
  if (story) {
    highlight.coverImage = story.mediaUrls?.[0] || null;
    await highlight.save();
    
    story.highlight = highlight._id;
    await story.save();
  }
  
  return highlight;
};

module.exports = mongoose.model('StoryHighlight', StoryHighlightSchema);

