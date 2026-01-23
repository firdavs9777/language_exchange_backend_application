/**
 * Story Utilities
 * Helper functions for processing story data
 */

/**
 * Process user object to include imageUrls array
 * @param {Object} user - User document (Mongoose or plain object)
 * @returns {Object} User object with imageUrls
 */
const processStoryUser = (user) => {
  if (!user) return null;

  const userObj = user._doc || user.toObject?.() || user;

  return {
    ...userObj,
    imageUrls: userObj.images?.map(img => img) || []
  };
};

/**
 * Process a single story to include proper URLs and metadata
 * @param {Object} story - Story document (Mongoose or plain object)
 * @param {Object} options - Options for processing
 * @param {Object} options.viewerId - Current user ID for view checking
 * @returns {Object} Processed story object
 */
const processStory = (story, options = {}) => {
  if (!story) return null;

  const storyObj = story._doc || story.toObject?.() || story;
  const userWithImages = processStoryUser(storyObj.user);

  return {
    ...storyObj,
    _id: story._id || storyObj._id,
    user: userWithImages,
    mediaUrl: storyObj.mediaUrls?.[0] || storyObj.mediaUrl || null,
    mediaUrls: storyObj.mediaUrls || [],
    thumbnail: storyObj.videoMetadata?.thumbnail || storyObj.thumbnail || null,
    videoMetadata: storyObj.videoMetadata || null,
    text: storyObj.text || null,
    backgroundColor: storyObj.backgroundColor || '#000000',
    textColor: storyObj.textColor || '#ffffff',
    privacy: storyObj.privacy || 'friends',
    viewCount: storyObj.viewCount || 0,
    createdAt: storyObj.createdAt,
    updatedAt: storyObj.updatedAt
  };
};

/**
 * Process multiple stories
 * @param {Array} stories - Array of story documents
 * @param {Object} options - Options for processing
 * @returns {Array} Array of processed story objects
 */
const processStories = (stories, options = {}) => {
  if (!Array.isArray(stories)) return [];
  return stories.map(story => processStory(story, options));
};

/**
 * Group stories by user for feed display
 * @param {Array} stories - Array of story documents
 * @param {string} viewerId - Current user ID
 * @param {Array} blockedUserIds - Array of blocked user IDs
 * @returns {Array} Array of user story groups
 */
const groupStoriesByUser = (stories, viewerId, blockedUserIds = []) => {
  const userStoriesMap = {};

  stories.forEach(story => {
    const storyUserId = story.user._id.toString();

    // Skip blocked users
    if (blockedUserIds.includes(storyUserId)) return;

    if (!userStoriesMap[storyUserId]) {
      userStoriesMap[storyUserId] = {
        _id: storyUserId,
        user: processStoryUser(story.user),
        stories: [],
        hasUnviewed: 0,
        latestStory: null
      };
    }

    const processedStory = processStory(story);
    processedStory.user = userStoriesMap[storyUserId].user;

    userStoriesMap[storyUserId].stories.push(processedStory);
    userStoriesMap[storyUserId].latestStory = processedStory;

    // Check if user has viewed this story
    const hasViewed = story.views?.some(view =>
      view.user?.toString() === viewerId
    );
    if (!hasViewed && storyUserId !== viewerId) {
      userStoriesMap[storyUserId].hasUnviewed += 1;
    }
  });

  // Sort: unviewed first, then by latest story time
  return Object.values(userStoriesMap).sort((a, b) => {
    if (a.hasUnviewed > 0 && b.hasUnviewed === 0) return -1;
    if (a.hasUnviewed === 0 && b.hasUnviewed > 0) return 1;
    return new Date(b.latestStory?.createdAt) - new Date(a.latestStory?.createdAt);
  });
};

/**
 * Process view data to include user imageUrls
 * @param {Array} views - Array of view objects with populated user
 * @returns {Array} Processed views array
 */
const processStoryViews = (views) => {
  if (!Array.isArray(views)) return [];

  return views.map(view => {
    const viewObj = view._doc || view;
    return {
      ...viewObj,
      user: processStoryUser(viewObj.user)
    };
  }).sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));
};

module.exports = {
  processStoryUser,
  processStory,
  processStories,
  groupStoriesByUser,
  processStoryViews
};
