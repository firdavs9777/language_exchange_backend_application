const path = require('path');
const asyncHandler = require('../middleware/async');
const Story = require('../models/Story');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

// @desc Get stories feed (from people you follow)
// @route GET /api/v1/stories/feed
// @access Private
exports.getStoriesFeed = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get users that current user is following
    const user = await User.findById(userId).populate('following', '_id');
    const followingIds = user.following?.map(following => following._id) || [];
    
    // Add current user to see their own stories
    followingIds.push(userId);
    
    const now = new Date();
    
    // Get active stories from people user is following + own stories
    const stories = await Story.find({
      user: { $in: followingIds },
      isActive: true,
      expiresAt: { $gt: now }
    })
    .populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v')
    .sort({ user: 1, createdAt: 1 });

    // Group stories by user
    const userStoriesMap = {};
    
    stories.forEach(story => {
      const userId = story.user._id.toString();
      
      if (!userStoriesMap[userId]) {
        userStoriesMap[userId] = {
          _id: userId,
          user: {
            ...story.user._doc,
            imageUrls: story.user.images.map(image => 
              `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
            )
          },
          stories: [],
          hasUnviewed: 0,
          latestStory: null
        };
      }
      
      const storyWithUrls = {
        ...story._doc,
        mediaUrl: story.mediaUrl ? `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(story.mediaUrl)}` : null,
        thumbnail: story.thumbnail ? `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(story.thumbnail)}` : null,
        user: userStoriesMap[userId].user
      };
      
      userStoriesMap[userId].stories.push(storyWithUrls);
      userStoriesMap[userId].latestStory = storyWithUrls;
      const hasViewed = story.views.some(view => view.user.toString() === req.user.id);
      if (!hasViewed && story.user._id.toString() !== req.user.id) {
        userStoriesMap[userId].hasUnviewed += 1;
      }
    });
 
   const storiesFeed = Object.values(userStoriesMap).sort((a, b) => {
      if (a.hasUnviewed > 0 && b.hasUnviewed === 0) return -1;
      if (a.hasUnviewed === 0 && b.hasUnviewed > 0) return 1;
      return new Date(b.latestStory.createdAt) - new Date(a.latestStory.createdAt);
    });

    res.status(200).json({
      success: true,
      count: storiesFeed.length,
      data: storiesFeed
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Get specific user's stories
// @route GET /api/v1/stories/user/:userId
// @access Private
exports.getUserStories = asyncHandler(async (req, res, next) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user.id;
    const now = new Date();
    
    const stories = await Story.find({
      user: userId,
      isActive: true,
      expiresAt: { $gt: now }
    })
    .populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v')
    .sort({ createdAt: 1 });
    
    // Mark stories as viewed by current user (if not owner)
    if (userId !== viewerId) {
      const storyIds = stories
        .filter(story => !story.views.some(view => view.user.toString() === viewerId))
        .map(story => story._id);
      
      if (storyIds.length > 0) {
        await Story.updateMany(
          { _id: { $in: storyIds } },
          {
            $push: {
              views: {
                user: viewerId,
                viewedAt: new Date()
              }
            },
            $inc: { viewCount: 1 }
          }
        );
      }
    }
    
    const storiesWithUrls = stories.map(story => {
      const userWithImageUrls = {
        ...story.user._doc,
        imageUrls: story.user.images.map(image => 
          `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
        )
      };
      
      return {
        ...story._doc,
        user: userWithImageUrls,
        mediaUrl: story.mediaUrl ? `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(story.mediaUrl)}` : null,
        thumbnail: story.thumbnail ? `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(story.thumbnail)}` : null
      };
    });
    
    res.status(200).json({
      success: true,
      count: storiesWithUrls.length,
      data: storiesWithUrls
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Create new story
// @route POST /api/v1/stories
// @access Private
exports.createStory = asyncHandler(async (req, res, next) => {
  try {
    const { text, backgroundColor, textColor, privacy } = req.body;
    const userId = req.user.id;
    
    if (!req.files?.file && !text) {
      return next(new ErrorResponse('Either media file or text is required', 400));
    }
    
    let mediaUrl = '';
    let thumbnail = '';
    let mediaType = '';
    
    if (req.files?.file) {
      const file = req.files.file;
      
      // Validate file type
      if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
        return next(new ErrorResponse('Please upload an image or video file', 400));
      }
      
      // Create unique filename
      const filename = `story-${userId}-${Date.now()}${path.extname(file.name)}`;
      mediaUrl = filename;
      mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      
      // Move file to uploads directory
      file.mv(`./uploads/${filename}`, err => {
        if (err) {
          return next(new ErrorResponse('Problem with file upload', 500));
        }
      });
      
      // Generate thumbnail for videos (placeholder for now)
      if (mediaType === 'video') {
        thumbnail = `thumb-${filename}`;
        // TODO: Implement video thumbnail generation
      }
    }
    
    const story = await Story.create({
      user: userId,
      mediaUrl,
      mediaType,
      thumbnail,
      text,
      backgroundColor: backgroundColor || '#000000',
      textColor: textColor || '#ffffff',
      privacy: privacy || 'friends'
    });
    
    await story.populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v');
    
    const userWithImageUrls = {
      ...story.user._doc,
      imageUrls: story.user.images.map(image => 
        `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
      )
    };
    
    const storyWithUrls = {
      ...story._doc,
      user: userWithImageUrls,
      mediaUrl: story.mediaUrl ? `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(story.mediaUrl)}` : null,
      thumbnail: story.thumbnail ? `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(story.thumbnail)}` : null
    };
    
    res.status(201).json({
      success: true,
      data: storyWithUrls
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Delete story
// @route DELETE /api/v1/stories/:id
// @access Private
exports.deleteStory = asyncHandler(async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return next(new ErrorResponse(`Story not found with id of ${req.params.id}`, 404));
    }
    
    // Check if user owns the story
    if (story.user.toString() !== req.user.id) {
      return next(new ErrorResponse('Not authorized to delete this story', 403));
    }
    
    story.isActive = false;
    await story.save();
    
    res.status(200).json({ 
      success: true, 
      data: {}, 
      message: 'Story deleted successfully' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Get story viewers
// @route GET /api/v1/stories/:id/views
// @access Private
exports.getStoryViewers = asyncHandler(async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate('views.user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v')
      .populate('user', '_id');
    
    if (!story) {
      return next(new ErrorResponse(`Story not found with id of ${req.params.id}`, 404));
    }
    
    // Check if user owns the story
    if (story.user._id.toString() !== req.user.id) {
      return next(new ErrorResponse('Not authorized to view story analytics', 403));
    }
    
    // Format viewers with image URLs
    const viewsWithUrls = story.views.map(view => ({
      ...view._doc,
      user: {
        ...view.user._doc,
        imageUrls: view.user.images.map(image => 
          `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
        )
      }
    })).sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));
    
    res.status(200).json({
      success: true,
      data: {
        viewCount: story.viewCount,
        views: viewsWithUrls
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Mark story as viewed
// @route POST /api/v1/stories/:id/view
// @access Private
exports.markStoryViewed = asyncHandler(async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return next(new ErrorResponse(`Story not found with id of ${req.params.id}`, 404));
    }
    
    const userId = req.user.id;
    const { viewDuration } = req.body;
    
    // Don't track views for own stories
    if (story.user.toString() === userId) {
      return res.status(200).json({
        success: true,
        message: 'Own story view not tracked'
      });
    }
    
    // Check if already viewed
    const hasViewed = story.views.some(view => view.user.toString() === userId);
    
    if (!hasViewed) {
      story.views.push({
        user: userId,
        viewedAt: new Date(),
        viewDuration
      });
      story.viewCount += 1;
      await story.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Story view recorded'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Get my active stories
// @route GET /api/v1/stories/my-stories
// @access Private
exports.getMyStories = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    
    const stories = await Story.find({
      user: userId,
      isActive: true,
      expiresAt: { $gt: now }
    })
    .populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v')
    .sort({ createdAt: -1 });
    
    const storiesWithUrls = stories.map(story => {
      const userWithImageUrls = {
        ...story.user._doc,
        imageUrls: story.user.images.map(image => 
          `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
        )
      };
      
      return {
        ...story._doc,
        user: userWithImageUrls,
        mediaUrl: story.mediaUrl ? `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(story.mediaUrl)}` : null,
        thumbnail: story.thumbnail ? `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(story.thumbnail)}` : null
      };
    });
    
    res.status(200).json({
      success: true,
      count: storiesWithUrls.length,
      data: storiesWithUrls
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Get single story
// @route GET /api/v1/stories/:id
// @access Private
exports.getStory = asyncHandler(async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v');
    
    if (!story) {
      return next(new ErrorResponse(`Story not found with id of ${req.params.id}`, 404));
    }
    
    // Check if story is expired or inactive
    if (!story.isActive || story.expiresAt < new Date()) {
      return next(new ErrorResponse(`Story is no longer available`, 404));
    }
    
    const userWithImageUrls = {
      ...story.user._doc,
      imageUrls: story.user.images.map(image => 
        `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
      )
    };
    
    const storyWithUrls = {
      ...story._doc,
      user: userWithImageUrls,
      mediaUrl: story.mediaUrl ? `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(story.mediaUrl)}` : null,
      thumbnail: story.thumbnail ? `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(story.thumbnail)}` : null
    };
    
    res.status(200).json({
      success: true,
      data: storyWithUrls
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});