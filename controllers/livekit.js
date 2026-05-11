const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const { mintRoomToken } = require('../services/livekitService');

/**
 * @route   POST /api/v1/livekit/test-token
 * @desc    Mint a LiveKit token for the smoke-test screen.
 *          Any authenticated user can join a hardcoded test room.
 * @body    { roomName?: string }   // defaults to 'smoke-test'
 */
exports.getTestToken = asyncHandler(async (req, res, next) => {
  const roomName = (req.body?.roomName || 'smoke-test').toString();

  const { token, url } = await mintRoomToken({
    identity: req.user._id.toString(),
    name: req.user.name || 'Guest',
    roomName,
  });

  res.status(200).json({
    success: true,
    data: { token, url, roomName },
  });
});
