const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

const MAX_PHRASES = 100;
const MAX_LENGTH = 300;

/**
 * @route   GET /api/v1/users/chat-phrases
 * @desc    List the authenticated user's saved chat phrases (newest first)
 * @access  Private
 */
exports.listPhrases = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('chatPhrases').lean();
  res.status(200).json({ success: true, data: user?.chatPhrases || [] });
});

/**
 * @route   POST /api/v1/users/chat-phrases
 * @desc    Prepend a phrase. Dedupes; rejects empty / too long; caps total.
 * @access  Private
 */
exports.addPhrase = asyncHandler(async (req, res, next) => {
  const raw = (req.body?.phrase || '').toString().trim();
  if (!raw) {
    return next(new ErrorResponse('Phrase cannot be empty', 400));
  }
  if (raw.length > MAX_LENGTH) {
    return next(new ErrorResponse(`Phrase exceeds ${MAX_LENGTH} characters`, 400));
  }
  const user = await User.findById(req.user.id).select('chatPhrases');
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }
  const existing = user.chatPhrases || [];
  const deduped = existing.filter((p) => p !== raw);
  const next$ = [raw, ...deduped].slice(0, MAX_PHRASES);
  user.chatPhrases = next$;
  await user.save();
  res.status(200).json({ success: true, data: next$ });
});

/**
 * @route   DELETE /api/v1/users/chat-phrases
 * @desc    Remove a phrase by exact-string match (body.phrase).
 * @access  Private
 */
exports.removePhrase = asyncHandler(async (req, res, next) => {
  const raw = (req.body?.phrase || '').toString();
  if (!raw) {
    return next(new ErrorResponse('Phrase is required', 400));
  }
  const user = await User.findById(req.user.id).select('chatPhrases');
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }
  user.chatPhrases = (user.chatPhrases || []).filter((p) => p !== raw);
  await user.save();
  res.status(200).json({ success: true, data: user.chatPhrases });
});
