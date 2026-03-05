/**
 * Call Controller
 * Handles REST API endpoints for call history
 */

const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const callService = require('../services/callService');

/**
 * @desc    Get call history
 * @route   GET /api/v1/calls
 * @access  Private
 */
exports.getCallHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, type } = req.query;

  const result = await callService.getCallHistory(userId, {
    page: parseInt(page),
    limit: Math.min(parseInt(limit), 50),
    type
  });

  // Format calls to show who was the other party
  const formattedCalls = result.calls.map(call => {
    const isInitiator = call.initiator._id.toString() === userId;
    const otherParty = call.participants.find(
      p => p._id.toString() !== userId
    );

    return {
      _id: call._id,
      type: call.type,
      status: call.status,
      direction: isInitiator ? 'outgoing' : 'incoming',
      otherParty: otherParty || null,
      duration: call.duration,
      endReason: call.endReason,
      createdAt: call.createdAt
    };
  });

  res.status(200).json({
    success: true,
    data: formattedCalls,
    pagination: result.pagination
  });
});

/**
 * @desc    Get single call details
 * @route   GET /api/v1/calls/:id
 * @access  Private
 */
exports.getCall = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const call = await callService.getCall(req.params.id);

  if (!call) {
    return next(new ErrorResponse('Call not found', 404));
  }

  // Verify user was part of the call
  const isParticipant = call.participants.some(
    p => p._id.toString() === userId
  );

  if (!isParticipant) {
    return next(new ErrorResponse('Not authorized to view this call', 403));
  }

  res.status(200).json({
    success: true,
    data: call
  });
});

/**
 * @desc    Get missed calls count
 * @route   GET /api/v1/calls/missed/count
 * @access  Private
 */
exports.getMissedCallsCount = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { since } = req.query;

  let sinceDate = null;
  if (since) {
    sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return next(new ErrorResponse('Invalid date format for "since" parameter', 400));
    }
  }

  const count = await callService.getMissedCallsCount(userId, sinceDate);

  res.status(200).json({
    success: true,
    data: { count }
  });
});

/**
 * @desc    Get ICE servers for WebRTC
 * @route   GET /api/v1/calls/ice-servers
 * @access  Private
 */
exports.getIceServers = asyncHandler(async (req, res, next) => {
  const iceServers = await callService.getCachedIceServers();

  res.status(200).json({
    success: true,
    data: iceServers
  });
});
