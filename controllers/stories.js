const path = require('path');
const asyncHandler = require('../middleware/async');
const Story = require('../models/Story');
const StoryHighlight = require('../models/StoryHighlight');
const User = require('../models/User');
const Message = require('../models/Message');
const ErrorResponse = require('../utils/errorResponse');
const deleteFromSpaces = require('../utils/deleteFromSpaces');
const { getBlockedUserIds, checkBlockStatus } = require('../utils/blockingUtils');

// @desc Get stories feed (from people you follow)
// @route GET /api/v1/stories/feed
// @access Private
exports.getStoriesFeed = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get blocked users
    const blockedUserIds = Array.from(await getBlockedUserIds(userId));
    console.log(`📚 [Stories Feed] User ${userId} - Blocked users: ${blockedUserIds.length}`, blockedUserIds);
    
    // Get users that current user is following
    const user = await User.findById(userId).populate('following', '_id');
    let followingIds = user.following?.map(following => following._id.toString()) || [];
    console.log(`📚 [Stories Feed] User ${userId} - Following count (before filter): ${followingIds.length}`);
    
    // Filter out blocked users from following list
    const beforeFilter = followingIds.length;
    followingIds = followingIds.filter(id => !blockedUserIds.includes(id));
    const afterFilter = followingIds.length;
    if (beforeFilter !== afterFilter) {
      console.log(`📚 [Stories Feed] User ${userId} - Filtered out ${beforeFilter - afterFilter} blocked users from following list`);
    }
    
    // Add current user to see their own stories
    followingIds.push(userId);
    
    const now = new Date();
    
    // Get active stories from people user is following + own stories (excluding blocked)
    const stories = await Story.find({
      user: { $in: followingIds, $nin: blockedUserIds },
      isActive: true,
      expiresAt: { $gt: now }
    })
    .populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v')
    .sort({ user: 1, createdAt: 1 });
    
    console.log(`📚 [Stories Feed] User ${userId} - Found ${stories.length} stories (after blocking filter)`);

    // Group stories by user
    const userStoriesMap = {};
    
    stories.forEach(story => {
      const storyUserId = story.user._id.toString();
      
      // Double-check not blocked (in case of race condition)
      if (blockedUserIds.includes(storyUserId)) return;
      
      if (!userStoriesMap[storyUserId]) {
        userStoriesMap[storyUserId] = {
          _id: storyUserId,
          user: {
            ...story.user._doc,
            imageUrls: story.user.images.map(image => 
              image
            )
          },
          stories: [],
          hasUnviewed: 0,
          latestStory: null
        };
      }
      
      const storyWithUrls = {
        ...story._doc,
        mediaUrl: story.mediaUrls ? story.mediaUrls[0] : null,
        thumbnail: story.videoMetadata?.thumbnail || story.thumbnail || null,
        videoMetadata: story.videoMetadata || null,
        user: userStoriesMap[storyUserId].user
      };
      
      userStoriesMap[storyUserId].stories.push(storyWithUrls);
      userStoriesMap[storyUserId].latestStory = storyWithUrls;
      const hasViewed = story.views.some(view => view.user.toString() === req.user.id);
      if (!hasViewed && story.user._id.toString() !== req.user.id) {
        userStoriesMap[storyUserId].hasUnviewed += 1;
      }
    });
 
   const storiesFeed = Object.values(userStoriesMap).sort((a, b) => {
      if (a.hasUnviewed > 0 && b.hasUnviewed === 0) return -1;
      if (a.hasUnviewed === 0 && b.hasUnviewed > 0) return 1;
      return new Date(b.latestStory.createdAt) - new Date(a.latestStory.createdAt);
    });

    console.log(`📚 [Stories Feed] User ${userId} - Returning ${storiesFeed.length} user story groups`);
    console.log(`📚 [Stories Feed] User ${userId} - Story groups:`, storiesFeed.map(s => ({
      userId: s._id,
      userName: s.user.name,
      storyCount: s.stories.length,
      hasUnviewed: s.hasUnviewed
    })));

    res.status(200).json({
      success: true,
      count: storiesFeed.length,
      data: storiesFeed,
      debug: {
        blockedUsersCount: blockedUserIds.length,
        followingCount: afterFilter,
        totalStoriesFound: stories.length,
        userStoryGroups: storiesFeed.length
      }
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
    
    console.log(`📚 [Get User Stories] Viewer: ${viewerId}, Target User: ${userId}`);
    
    // Check if blocked
    if (viewerId !== userId) {
      const blockStatus = await checkBlockStatus(viewerId, userId);
      console.log(`📚 [Get User Stories] Block status:`, {
        isBlocked: blockStatus.isBlocked,
        iBlockedThem: blockStatus.iBlockedThem,
        theyBlockedMe: blockStatus.theyBlockedMe
      });
      
      if (blockStatus.isBlocked) {
        console.log(`📚 [Get User Stories] BLOCKED - Returning empty result`);
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
          blocked: true,
          message: 'Content not available'
        });
      }
    }
    
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
    
    console.log(`📚 [Get User Stories] Found ${stories.length} active stories for user ${userId}`);
    
    const storiesWithUrls = stories.map(story => {
      const userWithImageUrls = {
        ...story.user._doc,
        imageUrls: story.user.images.map(image => image)
      };

      return {
        ...story._doc,
        user: userWithImageUrls,
        mediaUrl: story.mediaUrls ? story.mediaUrls[0] : null,
        thumbnail: story.videoMetadata?.thumbnail || story.thumbnail || null,
        videoMetadata: story.videoMetadata || null
      };
    });

    console.log(`📚 [Get User Stories] Returning ${storiesWithUrls.length} stories for user ${userId}`);
    
    res.status(200).json({
      success: true,
      count: storiesWithUrls.length,
      data: storiesWithUrls
    });
  } catch (error) {
    console.error(`📚 [Get User Stories] Error:`, error);
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
    const { resetDailyCounters, formatLimitError } = require('../utils/limitations');
    const LIMITS = require('../config/limitations');
    const user = req.limitationUser || await User.findById(userId);
    if (!user) return next(new ErrorResponse('User not found', 404));
    if (user.userMode === 'visitor') return next(new ErrorResponse('Visitors cannot create stories. Please upgrade to regular user.', 403));
    await resetDailyCounters(user); await user.save();
    const canCreate = await user.canCreateStory();
    if (!canCreate) {
      const current = user.regularUserLimitations.storiesCreatedToday || 0;
      const max = LIMITS.regular.storiesPerDay;
      const now = new Date();
      const nextReset = new Date(now); nextReset.setHours(24, 0, 0, 0);
      return next(formatLimitError('stories', current, max, nextReset));
    }
    // --- NEW for Spaces ---
    let mediaUrls = [];
    let mediaType = '';
    if (req.files && req.files.length > 0) {
      mediaUrls = req.files.map(f => f.location);
      // Check mimetype of first file (all should be same type ideally)
      mediaType = req.files[0].mimetype.startsWith('video/') ? 'video' : 'image';
    }
    if (mediaUrls.length === 0 && !text) {
      return next(new ErrorResponse('Either media or text required', 400));
    }
    const storyData = {
      user: userId,
      mediaUrls,
      mediaType: mediaUrls.length ? mediaType : 'text',
      text,
      backgroundColor: backgroundColor || '#000000',
      textColor: textColor || '#ffffff',
      privacy: privacy || 'friends'
    };
    const story = await Story.create(storyData);
    await user.incrementStoryCount();
    await story.populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v');
    const userWithImageUrls = { ...story.user._doc, imageUrls: story.user.images };
    const storyWithUrls = { ...story._doc, user: userWithImageUrls };
    res.status(201).json({
      success: true,
      data: storyWithUrls
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Create video story (Instagram-style, max 3 minutes)
// @route POST /api/v1/stories/video
// @access Private
exports.createVideoStory = asyncHandler(async (req, res, next) => {
  try {
    const { text, backgroundColor, textColor, privacy } = req.body;
    const userId = req.user.id;
    const { resetDailyCounters, formatLimitError } = require('../utils/limitations');
    const LIMITS = require('../config/limitations');

    const user = req.limitationUser || await User.findById(userId);
    if (!user) return next(new ErrorResponse('User not found', 404));
    if (user.userMode === 'visitor') {
      return next(new ErrorResponse('Visitors cannot create stories. Please upgrade to regular user.', 403));
    }

    await resetDailyCounters(user);
    await user.save();

    const canCreate = await user.canCreateStory();
    if (!canCreate) {
      const current = user.regularUserLimitations.storiesCreatedToday || 0;
      const max = LIMITS.regular.storiesPerDay;
      const now = new Date();
      const nextReset = new Date(now);
      nextReset.setHours(24, 0, 0, 0);
      return next(formatLimitError('stories', current, max, nextReset));
    }

    // Video should be validated by middleware (uploadSingleVideo)
    if (!req.videoMetadata) {
      return next(new ErrorResponse('Please upload a video file', 400));
    }

    // Create story with video
    const storyData = {
      user: userId,
      mediaUrls: [req.videoMetadata.url],
      mediaType: 'video',
      videoMetadata: {
        duration: req.videoMetadata.duration,
        thumbnail: req.videoMetadata.thumbnail,
        width: req.videoMetadata.width,
        height: req.videoMetadata.height,
        mimeType: req.videoMetadata.mimeType,
        fileSize: req.videoMetadata.fileSize
      },
      text: text || null,
      backgroundColor: backgroundColor || '#000000',
      textColor: textColor || '#ffffff',
      privacy: privacy || 'friends'
    };

    const story = await Story.create(storyData);
    await user.incrementStoryCount();

    await story.populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v');

    const userWithImageUrls = { ...story.user._doc, imageUrls: story.user.images };
    const storyWithUrls = {
      ...story._doc,
      user: userWithImageUrls,
      mediaUrl: story.mediaUrls[0],
      thumbnail: story.videoMetadata?.thumbnail || null
    };

    console.log(`📹 Video story created: ${story._id}, duration: ${req.videoMetadata.duration}s`);

    res.status(201).json({
      success: true,
      data: storyWithUrls
    });
  } catch (error) {
    console.error('Create video story error:', error);
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// Delete story and clean up Spaces media
exports.deleteStory = asyncHandler(async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return next(new ErrorResponse(`Story not found with id of ${req.params.id}`, 404));
    if (story.user.toString() !== req.user.id) return next(new ErrorResponse('Not authorized to delete this story', 403));

    // Delete all media from Spaces
    if (Array.isArray(story.mediaUrls)) {
      await Promise.all(story.mediaUrls.map(url => deleteFromSpaces(url)));
    }

    // Delete video thumbnail if exists
    if (story.videoMetadata && story.videoMetadata.thumbnail) {
      try {
        await deleteFromSpaces(story.videoMetadata.thumbnail);
        console.log(`🗑️ Video thumbnail deleted from Spaces`);
      } catch (err) {
        console.error('Failed to delete video thumbnail:', err.message);
      }
    }

    story.isActive = false;
    await story.save();
    res.status(200).json({ success: true, data: {}, message: 'Story deleted successfully' });
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
          image
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
    
    console.log(`📚 [Get My Stories] User: ${userId}`);
    
    const stories = await Story.find({
      user: userId,
      isActive: true,
      expiresAt: { $gt: now }
    })
    .populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v')
    .sort({ createdAt: -1 });
    
    console.log(`📚 [Get My Stories] Found ${stories.length} active stories`);
    
    const storiesWithUrls = stories.map(story => {
      // Handle both populated and non-populated user
      let userWithImageUrls;
      if (story.user && story.user._doc) {
        userWithImageUrls = {
          ...story.user._doc,
          imageUrls: story.user.images ? story.user.images.map(image => image) : []
        };
      } else if (story.user) {
        userWithImageUrls = {
          ...story.user.toObject ? story.user.toObject() : story.user,
          imageUrls: story.user.images ? story.user.images.map(image => image) : []
        };
      } else {
        // Fallback if user is not populated
        userWithImageUrls = {
          _id: story.user,
          imageUrls: []
        };
      }
      
      return {
        ...story.toObject ? story.toObject() : story._doc,
        _id: story._id,
        user: userWithImageUrls,
        mediaUrl: story.mediaUrls && story.mediaUrls.length > 0 ? story.mediaUrls[0] : (story.mediaUrl || null),
        mediaUrls: story.mediaUrls || [],
        thumbnail: story.videoMetadata?.thumbnail || story.thumbnail || null,
        videoMetadata: story.videoMetadata || null,
        text: story.text || null,
        backgroundColor: story.backgroundColor || '#000000',
        textColor: story.textColor || '#ffffff',
        privacy: story.privacy || 'friends',
        viewCount: story.viewCount || 0,
        createdAt: story.createdAt,
        updatedAt: story.updatedAt
      };
    });
    
    console.log(`📚 [Get My Stories] Returning ${storiesWithUrls.length} stories`);
    console.log(`📚 [Get My Stories] Sample story:`, storiesWithUrls.length > 0 ? {
      _id: storiesWithUrls[0]._id,
      mediaUrl: storiesWithUrls[0].mediaUrl,
      hasUser: !!storiesWithUrls[0].user,
      userId: storiesWithUrls[0].user?._id
    } : 'No stories');
    
    res.status(200).json({
      success: true,
      count: storiesWithUrls.length,
      data: storiesWithUrls,
      message: storiesWithUrls.length === 0 ? 'No active stories found' : 'Stories retrieved successfully'
    });
  } catch (error) {
    console.error(`📚 [Get My Stories] Error:`, error);
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
    
    // Check if blocked
    const storyOwnerId = story.user._id.toString();
    console.log(`📚 [Get Story] Story ID: ${req.params.id}, Owner: ${storyOwnerId}, Viewer: ${req.user.id}`);
    
    if (req.user.id !== storyOwnerId) {
      const blockStatus = await checkBlockStatus(req.user.id, storyOwnerId);
      console.log(`📚 [Get Story] Block status:`, {
        isBlocked: blockStatus.isBlocked,
        iBlockedThem: blockStatus.iBlockedThem,
        theyBlockedMe: blockStatus.theyBlockedMe
      });
      
      if (blockStatus.isBlocked) {
        console.log(`📚 [Get Story] BLOCKED - Returning 403`);
        return next(new ErrorResponse('This content is not available', 403));
      }
    }
    
    const userWithImageUrls = {
      ...story.user._doc,
      imageUrls: story.user.images.map(image => image)
    };

    const storyWithUrls = {
      ...story._doc,
      user: userWithImageUrls,
      mediaUrl: story.mediaUrls ? story.mediaUrls[0] : null,
      thumbnail: story.videoMetadata?.thumbnail || story.thumbnail || null,
      videoMetadata: story.videoMetadata || null
    };

    res.status(200).json({
      success: true,
      data: storyWithUrls
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// ========== NEW STORY FEATURES ==========

// @desc React to a story
// @route POST /api/v1/stories/:id/react
// @access Private
exports.reactToStory = asyncHandler(async (req, res, next) => {
  try {
    const { emoji } = req.body;
    const userId = req.user.id;
    
    if (!emoji) {
      return next(new ErrorResponse('Emoji is required', 400));
    }
    
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return next(new ErrorResponse('Story not found', 404));
    }
    
    // Check if blocked
    if (story.user.toString() !== userId) {
      const blockStatus = await checkBlockStatus(userId, story.user.toString());
      if (blockStatus.isBlocked) {
        return next(new ErrorResponse('Cannot react to this story', 403));
      }
    }
    
    await story.addReaction(userId, emoji);
    
    // Notify story owner via socket
    const io = req.app.get('io');
    if (io && story.user.toString() !== userId) {
      io.to(`user_${story.user}`).emit('storyReaction', {
        storyId: story._id,
        reaction: { user: userId, emoji },
        reactionCount: story.reactionCount
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        reactionCount: story.reactionCount,
        userReaction: emoji
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Remove reaction from story
// @route DELETE /api/v1/stories/:id/react
// @access Private
exports.removeReaction = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user.id;
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return next(new ErrorResponse('Story not found', 404));
    }
    
    await story.removeReaction(userId);
    
    res.status(200).json({
      success: true,
      data: {
        reactionCount: story.reactionCount,
        userReaction: null
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Get story reactions
// @route GET /api/v1/stories/:id/reactions
// @access Private
exports.getStoryReactions = asyncHandler(async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate('reactions.user', 'name images')
      .populate('user', '_id');
    
    if (!story) {
      return next(new ErrorResponse('Story not found', 404));
    }
    
    // Only owner can see detailed reactions
    if (story.user._id.toString() !== req.user.id) {
      return next(new ErrorResponse('Not authorized', 403));
    }
    
    res.status(200).json({
      success: true,
      data: {
        reactionCount: story.reactionCount,
        reactions: story.reactions
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Reply to a story (sends DM)
// @route POST /api/v1/stories/:id/reply
// @access Private
exports.replyToStory = asyncHandler(async (req, res, next) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;
    
    if (!message) {
      return next(new ErrorResponse('Message is required', 400));
    }
    
    const story = await Story.findById(req.params.id)
      .populate('user', 'name images');
    
    if (!story) {
      return next(new ErrorResponse('Story not found', 404));
    }
    
    // Check if replies allowed
    if (!story.allowReplies) {
      return next(new ErrorResponse('Replies are disabled for this story', 403));
    }
    
    // Check if blocked
    if (story.user._id.toString() !== userId) {
      const blockStatus = await checkBlockStatus(userId, story.user._id.toString());
      if (blockStatus.isBlocked) {
        return next(new ErrorResponse('Cannot reply to this story', 403));
      }
    }
    
    // Create DM message
    const dmMessage = await Message.create({
      sender: userId,
      receiver: story.user._id,
      message: message,
      // Reference to story
      replyTo: null, // Could add story reference here
      messageType: 'text'
    });
    
    // Add to story replies
    story.replies.push({
      user: userId,
      message: dmMessage._id,
      repliedAt: new Date()
    });
    story.replyCount = story.replies.length;
    await story.save();
    
    // Populate for response
    await dmMessage.populate('sender', 'name images');
    
    // Notify story owner via socket
    const io = req.app.get('io');
    if (io && story.user._id.toString() !== userId) {
      io.to(`user_${story.user._id}`).emit('storyReply', {
        storyId: story._id,
        message: dmMessage,
        replyCount: story.replyCount
      });
      
      // Also send as new message
      io.to(`user_${story.user._id}`).emit('newMessage', {
        message: dmMessage,
        senderId: userId,
        isStoryReply: true,
        storyId: story._id
      });
    }
    
    res.status(201).json({
      success: true,
      data: {
        message: dmMessage,
        replyCount: story.replyCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Vote on story poll
// @route POST /api/v1/stories/:id/poll/vote
// @access Private
exports.voteStoryPoll = asyncHandler(async (req, res, next) => {
  try {
    const { optionIndex } = req.body;
    const userId = req.user.id;
    
    if (optionIndex === undefined) {
      return next(new ErrorResponse('Option index is required', 400));
    }
    
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return next(new ErrorResponse('Story not found', 404));
    }
    
    if (!story.poll) {
      return next(new ErrorResponse('Story has no poll', 400));
    }
    
    await story.votePoll(userId, optionIndex);
    
    // Get updated poll results
    const pollResults = story.poll.options.map((opt, idx) => ({
      index: idx,
      text: opt.text,
      voteCount: opt.voteCount,
      percentage: story.poll.options.reduce((sum, o) => sum + o.voteCount, 0) > 0
        ? Math.round((opt.voteCount / story.poll.options.reduce((sum, o) => sum + o.voteCount, 0)) * 100)
        : 0,
      voted: opt.votes.some(v => v.toString() === userId)
    }));
    
    // Notify story owner
    const io = req.app.get('io');
    if (io && story.user.toString() !== userId) {
      io.to(`user_${story.user}`).emit('storyPollVote', {
        storyId: story._id,
        pollResults
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        poll: {
          question: story.poll.question,
          options: pollResults
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Answer story question box
// @route POST /api/v1/stories/:id/question/answer
// @access Private
exports.answerStoryQuestion = asyncHandler(async (req, res, next) => {
  try {
    const { text, isAnonymous } = req.body;
    const userId = req.user.id;
    
    if (!text) {
      return next(new ErrorResponse('Answer text is required', 400));
    }
    
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return next(new ErrorResponse('Story not found', 404));
    }
    
    if (!story.questionBox) {
      return next(new ErrorResponse('Story has no question box', 400));
    }
    
    await story.answerQuestion(userId, text, isAnonymous);
    
    // Notify story owner
    const io = req.app.get('io');
    if (io && story.user.toString() !== userId) {
      io.to(`user_${story.user}`).emit('storyQuestionAnswer', {
        storyId: story._id,
        answer: {
          user: isAnonymous ? null : userId,
          text,
          isAnonymous
        }
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Answer submitted'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Get question box responses (owner only)
// @route GET /api/v1/stories/:id/question/responses
// @access Private
exports.getQuestionResponses = asyncHandler(async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate('questionBox.responses.user', 'name images')
      .populate('user', '_id');
    
    if (!story) {
      return next(new ErrorResponse('Story not found', 404));
    }
    
    if (story.user._id.toString() !== req.user.id) {
      return next(new ErrorResponse('Not authorized', 403));
    }
    
    if (!story.questionBox) {
      return next(new ErrorResponse('Story has no question box', 400));
    }
    
    res.status(200).json({
      success: true,
      data: {
        prompt: story.questionBox.prompt,
        responses: story.questionBox.responses
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Share story
// @route POST /api/v1/stories/:id/share
// @access Private
exports.shareStory = asyncHandler(async (req, res, next) => {
  try {
    const { sharedTo, receiverId } = req.body;
    const userId = req.user.id;
    
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return next(new ErrorResponse('Story not found', 404));
    }
    
    if (!story.allowSharing) {
      return next(new ErrorResponse('Sharing is disabled for this story', 403));
    }
    
    // Check if blocked
    if (story.user.toString() !== userId) {
      const blockStatus = await checkBlockStatus(userId, story.user.toString());
      if (blockStatus.isBlocked) {
        return next(new ErrorResponse('Cannot share this story', 403));
      }
    }
    
    story.shares.push({
      user: userId,
      sharedTo: sharedTo || 'external',
      sharedAt: new Date()
    });
    story.shareCount = story.shares.length;
    await story.save();
    
    // If sharing to DM, create message
    if (sharedTo === 'dm' && receiverId) {
      const dmMessage = await Message.create({
        sender: userId,
        receiver: receiverId,
        message: `Shared a story`,
        messageType: 'text',
        // Could add story reference
      });
      
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${receiverId}`).emit('newMessage', {
          message: dmMessage,
          senderId: userId,
          sharedStory: {
            _id: story._id,
            mediaUrl: story.mediaUrls?.[0],
            user: story.user
          }
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        shareCount: story.shareCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// ========== STORY HIGHLIGHTS ==========

// @desc Create story highlight
// @route POST /api/v1/stories/highlights
// @access Private
exports.createHighlight = asyncHandler(async (req, res, next) => {
  try {
    const { title, storyId, coverImage } = req.body;
    const userId = req.user.id;
    
    if (!title) {
      return next(new ErrorResponse('Highlight title is required', 400));
    }
    
    let highlight;
    
    if (storyId) {
      // Create from existing story
      const story = await Story.findById(storyId);
      if (!story || story.user.toString() !== userId) {
        return next(new ErrorResponse('Story not found or not authorized', 404));
      }
      
      highlight = await StoryHighlight.createFromStory(userId, storyId, title);
    } else {
      // Create empty highlight
      highlight = await StoryHighlight.create({
        user: userId,
        title,
        coverImage
      });
    }
    
    res.status(201).json({
      success: true,
      data: highlight
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Get user's highlights
// @route GET /api/v1/stories/highlights/user/:userId
// @access Private
exports.getUserHighlights = asyncHandler(async (req, res, next) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user.id;
    
    // Check if blocked
    if (viewerId !== userId) {
      const blockStatus = await checkBlockStatus(viewerId, userId);
      if (blockStatus.isBlocked) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
          blocked: true
        });
      }
    }
    
    const highlights = await StoryHighlight.getUserHighlights(userId);
    
    res.status(200).json({
      success: true,
      count: highlights.length,
      data: highlights
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Get my highlights
// @route GET /api/v1/stories/highlights
// @access Private
exports.getMyHighlights = asyncHandler(async (req, res, next) => {
  try {
    const highlights = await StoryHighlight.getUserHighlights(req.user.id);
    
    res.status(200).json({
      success: true,
      count: highlights.length,
      data: highlights
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Add story to highlight
// @route POST /api/v1/stories/highlights/:id/stories
// @access Private
exports.addStoryToHighlight = asyncHandler(async (req, res, next) => {
  try {
    const { storyId } = req.body;
    const userId = req.user.id;
    
    const highlight = await StoryHighlight.findById(req.params.id);
    
    if (!highlight) {
      return next(new ErrorResponse('Highlight not found', 404));
    }
    
    if (highlight.user.toString() !== userId) {
      return next(new ErrorResponse('Not authorized', 403));
    }
    
    // Verify story ownership
    const story = await Story.findById(storyId);
    if (!story || story.user.toString() !== userId) {
      return next(new ErrorResponse('Story not found or not authorized', 404));
    }
    
    await highlight.addStory(storyId);
    
    res.status(200).json({
      success: true,
      data: highlight
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Remove story from highlight
// @route DELETE /api/v1/stories/highlights/:id/stories/:storyId
// @access Private
exports.removeStoryFromHighlight = asyncHandler(async (req, res, next) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;
    
    const highlight = await StoryHighlight.findById(req.params.id);
    
    if (!highlight) {
      return next(new ErrorResponse('Highlight not found', 404));
    }
    
    if (highlight.user.toString() !== userId) {
      return next(new ErrorResponse('Not authorized', 403));
    }
    
    await highlight.removeStory(storyId);
    
    res.status(200).json({
      success: true,
      data: highlight
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Update highlight
// @route PUT /api/v1/stories/highlights/:id
// @access Private
exports.updateHighlight = asyncHandler(async (req, res, next) => {
  try {
    const { title, coverImage } = req.body;
    const userId = req.user.id;
    
    const highlight = await StoryHighlight.findById(req.params.id);
    
    if (!highlight) {
      return next(new ErrorResponse('Highlight not found', 404));
    }
    
    if (highlight.user.toString() !== userId) {
      return next(new ErrorResponse('Not authorized', 403));
    }
    
    if (title) highlight.title = title;
    if (coverImage) highlight.coverImage = coverImage;
    
    await highlight.save();
    
    res.status(200).json({
      success: true,
      data: highlight
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Delete highlight
// @route DELETE /api/v1/stories/highlights/:id
// @access Private
exports.deleteHighlight = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const highlight = await StoryHighlight.findById(req.params.id);
    
    if (!highlight) {
      return next(new ErrorResponse('Highlight not found', 404));
    }
    
    if (highlight.user.toString() !== userId) {
      return next(new ErrorResponse('Not authorized', 403));
    }
    
    // Clear highlight references from stories
    await Story.updateMany(
      { highlight: highlight._id },
      { $unset: { highlight: 1 } }
    );
    
    await highlight.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Highlight deleted'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// ========== STORY ARCHIVE ==========

// @desc Get archived stories
// @route GET /api/v1/stories/archive
// @access Private
exports.getArchivedStories = asyncHandler(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const userId = req.user.id;
    
    const stories = await Story.getArchivedStories(userId, page, limit);
    
    const total = await Story.countDocuments({
      user: userId,
      isArchived: true
    });
    
    res.status(200).json({
      success: true,
      count: stories.length,
      total,
      pages: Math.ceil(total / limit),
      data: stories
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Archive a story manually
// @route POST /api/v1/stories/:id/archive
// @access Private
exports.archiveStory = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return next(new ErrorResponse('Story not found', 404));
    }
    
    if (story.user.toString() !== userId) {
      return next(new ErrorResponse('Not authorized', 403));
    }
    
    await story.archive();
    
    res.status(200).json({
      success: true,
      message: 'Story archived'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// ========== CLOSE FRIENDS ==========

// @desc Get close friends list
// @route GET /api/v1/stories/close-friends
// @access Private
exports.getCloseFriends = asyncHandler(async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('closeFriends', 'name images bio');
    
    res.status(200).json({
      success: true,
      count: user.closeFriends?.length || 0,
      data: user.closeFriends || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Add to close friends
// @route POST /api/v1/stories/close-friends/:userId
// @access Private
exports.addCloseFriend = asyncHandler(async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    
    if (userId === currentUserId) {
      return next(new ErrorResponse('Cannot add yourself', 400));
    }
    
    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return next(new ErrorResponse('User not found', 404));
    }
    
    // Add to close friends
    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: { closeFriends: userId }
    });
    
    // Add to closeFriendsOf for target user
    await User.findByIdAndUpdate(userId, {
      $addToSet: { closeFriendsOf: currentUserId }
    });
    
    res.status(200).json({
      success: true,
      message: 'Added to close friends'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

// @desc Remove from close friends
// @route DELETE /api/v1/stories/close-friends/:userId
// @access Private
exports.removeCloseFriend = asyncHandler(async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    
    // Remove from close friends
    await User.findByIdAndUpdate(currentUserId, {
      $pull: { closeFriends: userId }
    });
    
    // Remove from closeFriendsOf for target user
    await User.findByIdAndUpdate(userId, {
      $pull: { closeFriendsOf: currentUserId }
    });
    
    res.status(200).json({
      success: true,
      message: 'Removed from close friends'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});