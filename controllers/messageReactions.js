const asyncHandler = require('../middleware/async');
const Message = require('../models/Message');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Add reaction to a message
 * @route   POST /api/v1/messages/:id/reactions
 * @access  Private
 */
exports.addReaction = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { emoji } = req.body;
  const userId = req.user._id;

  if (!emoji) {
    return next(new ErrorResponse('Emoji is required', 400));
  }

  const message = await Message.findById(id);

  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  // Check if user already reacted with this emoji
  const existingReaction = message.reactions.find(
    r => r.user.toString() === userId.toString() && r.emoji === emoji
  );

  if (existingReaction) {
    return res.status(200).json({
      success: true,
      message: 'Reaction already exists',
      data: message.reactions
    });
  }

  // Remove existing reaction from this user (one reaction per user)
  message.reactions = message.reactions.filter(
    r => r.user.toString() !== userId.toString()
  );

  // Add new reaction
  message.reactions.push({
    user: userId,
    emoji: emoji
  });

  await message.save();

  // Populate user info
  await message.populate('reactions.user', 'name images');

  res.status(200).json({
    success: true,
    message: 'Reaction added successfully',
    data: message.reactions
  });
});

/**
 * @desc    Remove reaction from a message
 * @route   DELETE /api/v1/messages/:id/reactions/:emoji
 * @access  Private
 */
exports.removeReaction = asyncHandler(async (req, res, next) => {
  const { id, emoji } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(id);

  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  // Remove reaction
  message.reactions = message.reactions.filter(
    r => !(r.user.toString() === userId.toString() && r.emoji === emoji)
  );

  await message.save();

  res.status(200).json({
    success: true,
    message: 'Reaction removed successfully',
    data: message.reactions
  });
});

/**
 * @desc    Get all reactions for a message
 * @route   GET /api/v1/messages/:id/reactions
 * @access  Private
 */
exports.getMessageReactions = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const message = await Message.findById(id)
    .populate('reactions.user', 'name images');

  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  res.status(200).json({
    success: true,
    count: message.reactions.length,
    data: message.reactions
  });
});

