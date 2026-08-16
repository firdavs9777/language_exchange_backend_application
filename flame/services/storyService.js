const crypto = require('crypto');
const mongoose = require('mongoose');
const Story = require('../models/Story');
const User = require('../models/User');
const { NotFoundError, ValidationError, FlameError } = require('../utils/errors');
const s3 = require('../utils/s3');

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const STORY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_CAPTION = 200;

// ---- Response shaping (snake_case — matches the Flutter Story/UserStories) ----

function toStory(story, viewerId) {
  return {
    id: story._id.toString(),
    user_id: story.userId,
    media_url: story.mediaUrl,
    caption: story.caption,
    created_at: story.createdAt.toISOString(),
    expires_at: story.expiresAt.toISOString(),
    view_count: story.viewerIds.length,
    has_viewed: story.viewerIds.includes(viewerId),
  };
}

function toUserStories(user, stories, viewerId) {
  const primary = user.photos.find((p) => p.isPrimary) || user.photos[0];
  return {
    user_id: user._id.toString(),
    name: user.name,
    avatar_url: primary ? primary.url : '',
    stories: stories.map((s) => toStory(s, viewerId)),
  };
}

// ---- Visibility ----
//
// SINGLE SWAP POINT for story visibility. Today every Flame user can see every
// other user's active stories (matches don't exist server-side yet). When the
// matches feature lands, change this to return { userId: { $in: matchIds } }.
//
// Blocks are an ADDITIONAL constraint layered on top of whatever author set
// this builds, not a replacement for it — a story is one of the surfaces that
// returns another user, so a blocked author has to drop out of the feed.
async function visibleAuthorFilter(viewerId) {
  const visibility = require('./visibilityService');
  const hidden = await visibility.blockedIdsFor(viewerId);
  return { userId: { $ne: viewerId, $nin: hidden } };
}

async function canView(viewerId, authorId) {
  // Mirror of visibleAuthorFilter for the single-story (view) path. Without the
  // block check here a blocked viewer could still register a view (and land in
  // the author's viewer count) by hitting the story id directly.
  if (authorId === viewerId) return false; // author handled separately
  const visibility = require('./visibilityService');
  return !(await visibility.areBlocked(viewerId, authorId));
}

// ---- Internals ----

async function getActive(storyId) {
  if (!mongoose.Types.ObjectId.isValid(storyId)) {
    throw new NotFoundError('Story not found');
  }
  const story = await Story.findOne({ _id: storyId, expiresAt: { $gt: new Date() } });
  if (!story) throw new NotFoundError('Story not found');
  return story;
}

// ---- Public API ----

async function createStory(userId, file, caption) {
  if (!file) throw new ValidationError('media file is required');
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    throw new ValidationError('Only JPEG, PNG, and WebP images are allowed');
  }
  if (file.size > MAX_BYTES) {
    throw new ValidationError('Image must be under 10MB');
  }

  const id = crypto.randomUUID();
  const key = `stories/${userId}/${id}.${EXT[file.mimetype]}`;
  const url = await s3.uploadBuffer(file.buffer, key, file.mimetype);

  const now = new Date();
  const clean =
    typeof caption === 'string' && caption.trim() ? caption.trim().slice(0, MAX_CAPTION) : null;

  const story = await Story.create({
    userId,
    mediaUrl: url,
    mediaKey: key,
    caption: clean,
    expiresAt: new Date(now.getTime() + STORY_TTL_MS),
  });
  return toStory(story, userId);
}

async function getFeed(viewerId) {
  const filter = await visibleAuthorFilter(viewerId);
  const stories = await Story.find({ ...filter, expiresAt: { $gt: new Date() } }).sort({
    createdAt: 1,
  });
  if (stories.length === 0) return [];

  // Group by author, then hydrate author docs in one query.
  const grouped = new Map();
  for (const s of stories) {
    if (!grouped.has(s.userId)) grouped.set(s.userId, []);
    grouped.get(s.userId).push(s);
  }
  const authorIds = [...grouped.keys()];
  const authors = await User.find({ _id: { $in: authorIds }, isDeleted: { $ne: true } });

  const result = [];
  for (const author of authors) {
    const userStories = grouped.get(author._id.toString()) || [];
    if (userStories.length) result.push(toUserStories(author, userStories, viewerId));
  }
  return result;
}

async function getMyStories(userId) {
  const stories = await Story.find({ userId, expiresAt: { $gt: new Date() } }).sort({
    createdAt: 1,
  });
  if (stories.length === 0) return null;
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  return toUserStories(user, stories, userId);
}

async function markViewed(viewerId, storyId) {
  const story = await getActive(storyId);

  // Author viewing own story: allowed, not counted.
  if (story.userId === viewerId) {
    return { view_count: story.viewerIds.length };
  }
  if (!(await canView(viewerId, story.userId))) {
    throw new FlameError('FORBIDDEN', 'Not allowed to view this story', 403);
  }
  if (!story.viewerIds.includes(viewerId)) {
    story.viewerIds.push(viewerId);
    await story.save();
  }
  return { view_count: story.viewerIds.length };
}

async function deleteStory(userId, storyId) {
  const story = await getActive(storyId);
  if (story.userId !== userId) {
    throw new FlameError('FORBIDDEN', 'Not your story', 403);
  }
  if (story.mediaKey) {
    try {
      await s3.deleteObject(story.mediaKey);
    } catch {
      /* best-effort: orphaned object is harmless */
    }
  }
  await story.deleteOne();
}

module.exports = {
  createStory,
  getFeed,
  getMyStories,
  markViewed,
  deleteStory,
  // exported for tests
  toStory,
  toUserStories,
};
