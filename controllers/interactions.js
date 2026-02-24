const asyncHandler = require('../middleware/async');
const UserInteraction = require('../models/UserInteraction');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Record a skip interaction
 * @route   POST /api/v1/interactions/skip
 * @access  Private
 */
exports.skipUser = asyncHandler(async (req, res, next) => {
  const { targetUserId } = req.body;
  const userId = req.user._id;

  if (!targetUserId) {
    return next(new ErrorResponse('Target user ID is required', 400));
  }

  if (targetUserId === userId.toString()) {
    return next(new ErrorResponse('Cannot skip yourself', 400));
  }

  // Skip expires after 24 hours - user will see them again after that
  const interaction = await UserInteraction.recordInteraction(
    userId,
    targetUserId,
    'skip',
    { expiresIn: 24 } // 24 hours
  );

  res.status(200).json({
    success: true,
    message: 'User skipped',
    data: { expiresAt: interaction.expiresAt }
  });
});

/**
 * @desc    Record a wave interaction
 * @route   POST /api/v1/interactions/wave
 * @access  Private
 */
exports.waveUser = asyncHandler(async (req, res, next) => {
  const { targetUserId, message } = req.body;
  const userId = req.user._id;

  if (!targetUserId) {
    return next(new ErrorResponse('Target user ID is required', 400));
  }

  if (targetUserId === userId.toString()) {
    return next(new ErrorResponse('Cannot wave to yourself', 400));
  }

  // Check if already waved (waves don't expire)
  const existingWave = await UserInteraction.hasInteraction(userId, targetUserId, 'wave');
  if (existingWave) {
    return res.status(200).json({
      success: true,
      message: 'Already waved to this user',
      data: { alreadyWaved: true }
    });
  }

  // Record wave (no expiry)
  const interaction = await UserInteraction.recordInteraction(
    userId,
    targetUserId,
    'wave',
    { message }
  );

  res.status(201).json({
    success: true,
    message: 'Wave sent',
    data: interaction
  });
});

/**
 * @desc    Get skipped user IDs (for exclusion from feed)
 * @route   GET /api/v1/interactions/skipped
 * @access  Private
 */
exports.getSkippedUsers = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const interactions = await UserInteraction.getUserInteractions(userId, 'skip');
  const skippedIds = interactions.map(i => i.targetUser.toString());

  res.status(200).json({
    success: true,
    count: skippedIds.length,
    data: skippedIds
  });
});

/**
 * @desc    Get waved user IDs
 * @route   GET /api/v1/interactions/waved
 * @access  Private
 */
exports.getWavedUsers = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const interactions = await UserInteraction.getUserInteractions(userId, 'wave');
  const wavedIds = interactions.map(i => i.targetUser.toString());

  res.status(200).json({
    success: true,
    count: wavedIds.length,
    data: wavedIds
  });
});

/**
 * @desc    Get all excluded user IDs (skipped + waved)
 * @route   GET /api/v1/interactions/excluded
 * @access  Private
 */
exports.getExcludedUsers = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { types } = req.query;

  // Default: exclude skipped and waved users
  const excludeTypes = types ? types.split(',') : ['skip', 'wave'];

  const excludedIds = await UserInteraction.getExcludedUserIds(userId, excludeTypes);

  res.status(200).json({
    success: true,
    count: excludedIds.length,
    data: excludedIds.map(id => id.toString())
  });
});

/**
 * @desc    Remove a skip (undo skip)
 * @route   DELETE /api/v1/interactions/skip/:targetUserId
 * @access  Private
 */
exports.undoSkip = asyncHandler(async (req, res, next) => {
  const { targetUserId } = req.params;
  const userId = req.user._id;

  await UserInteraction.removeInteraction(userId, targetUserId, 'skip');

  res.status(200).json({
    success: true,
    message: 'Skip removed'
  });
});

/**
 * @desc    Get received waves
 * @route   GET /api/v1/interactions/waves/received
 * @access  Private
 */
exports.getReceivedWaves = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { unreadOnly, limit = 50 } = req.query;

  const waves = await UserInteraction.getReceivedInteractions(
    userId,
    'wave',
    {
      unreadOnly: unreadOnly === 'true',
      limit: parseInt(limit)
    }
  );

  res.status(200).json({
    success: true,
    count: waves.length,
    data: waves
  });
});

/**
 * @desc    Mark waves as seen
 * @route   PUT /api/v1/interactions/waves/seen
 * @access  Private
 */
exports.markWavesAsSeen = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { waveIds } = req.body;

  const result = await UserInteraction.markAsSeen(userId, 'wave', waveIds);

  res.status(200).json({
    success: true,
    message: `Marked ${result.modifiedCount} waves as seen`
  });
});

/**
 * @desc    Batch record multiple interactions
 * @route   POST /api/v1/interactions/batch
 * @access  Private
 */
exports.batchInteractions = asyncHandler(async (req, res, next) => {
  const { interactions } = req.body;
  const userId = req.user._id;

  if (!interactions || !Array.isArray(interactions)) {
    return next(new ErrorResponse('Interactions array is required', 400));
  }

  const results = await Promise.all(
    interactions.map(async ({ targetUserId, type, message }) => {
      try {
        const expiresIn = type === 'skip' ? 24 : null; // Skips expire in 24h
        await UserInteraction.recordInteraction(userId, targetUserId, type, { message, expiresIn });
        return { targetUserId, type, success: true };
      } catch (error) {
        return { targetUserId, type, success: false, error: error.message };
      }
    })
  );

  res.status(200).json({
    success: true,
    data: results
  });
});

/**
 * @desc    Clear all skips (reset)
 * @route   DELETE /api/v1/interactions/skips/clear
 * @access  Private
 */
exports.clearAllSkips = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const result = await UserInteraction.deleteMany({ user: userId, type: 'skip' });

  res.status(200).json({
    success: true,
    message: `Cleared ${result.deletedCount} skips`
  });
});
