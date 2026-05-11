/**
 * Call Controller
 * Handles REST API endpoints for call history and 1:1 call lifecycle.
 *
 * LiveKit migration (Step 8 B1):
 *  - POST /calls/initiate, /accept, /decline, /end mint LiveKit tokens
 *    and emit socket events to keep both peers in sync. Media flows
 *    directly between clients and LiveKit Cloud; the backend only
 *    authorizes joins.
 */

const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const callService = require('../services/callService');
const Call = require('../models/Call');
const User = require('../models/User');
const { mintRoomToken } = require('../services/livekitService');
const fcmService = require('../services/fcmService');
const { shouldNotify } = require('../services/notificationService');

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

/**
 * Build the LiveKit room name for a given call.
 * One room per call gives strong isolation — no cross-call bleed.
 */
const _roomNameForCall = (callId) => `call:${callId.toString()}`;

/**
 * @desc    Initiate a 1:1 call. Creates Call (status=ringing), mints
 *          LiveKit tokens for both peers, and pushes an FCM data
 *          payload to the receiver with the receiver's token so the
 *          client can connect to LiveKit immediately on accept.
 * @route   POST /api/v1/calls/initiate
 * @access  Private
 * @body    { receiverId, type } where type ∈ {'audio', 'video'}
 */
exports.initiateCall = asyncHandler(async (req, res, next) => {
  const { receiverId, type } = req.body || {};
  const callerId = req.user.id;

  if (!receiverId || typeof receiverId !== 'string') {
    return next(new ErrorResponse('receiverId is required', 400));
  }
  if (!['audio', 'video'].includes(type)) {
    return next(new ErrorResponse('type must be "audio" or "video"', 400));
  }
  if (receiverId === callerId) {
    return next(new ErrorResponse('Cannot call yourself', 400));
  }

  const [caller, receiver] = await Promise.all([
    User.findById(callerId),
    User.findById(receiverId),
  ]);

  if (!receiver) {
    return next(new ErrorResponse('Receiver not found', 404));
  }
  if (!caller) {
    return next(new ErrorResponse('Caller not found', 404));
  }

  // Block check (both directions). blockedUsers is [{ userId, ... }]
  const callerBlockedByReceiver = receiver.blockedUsers?.some(
    b => b.userId?.toString() === callerId
  );
  const receiverBlockedByCaller = caller.blockedUsers?.some(
    b => b.userId?.toString() === receiverId
  );
  if (callerBlockedByReceiver || receiverBlockedByCaller) {
    return next(new ErrorResponse('Cannot call this user', 403));
  }

  // Create the Call record (status=ringing). Reuses callService.createCall
  // for consistency with the socket handler.
  const call = await callService.createCall(callerId, receiverId, type);

  const roomName = _roomNameForCall(call._id);

  // Mint tokens for both peers in parallel.
  const [callerToken, receiverToken] = await Promise.all([
    mintRoomToken({
      identity: callerId,
      name: caller.name || 'Caller',
      roomName,
      metadata: { role: 'caller', callId: call._id.toString() },
    }),
    mintRoomToken({
      identity: receiverId,
      name: receiver.name || 'Receiver',
      roomName,
      metadata: { role: 'receiver', callId: call._id.toString() },
    }),
  ]);

  // Send FCM data push to receiver (if they accept calls).
  // sendToUser is the canonical helper — handles quiet hours,
  // frequency caps, multi-device fan-out and dead-token cleanup.
  if (shouldNotify(receiver, 'calls')) {
    const callerAvatar = (caller.images && caller.images.length > 0)
      ? caller.images[0]
      : '';

    fcmService.sendToUser(
      receiverId,
      {
        title: `Incoming ${type === 'video' ? 'Video' : 'Audio'} Call`,
        body: `${caller.name || 'Someone'} is calling you...`,
      },
      {
        type: 'incoming_call',
        callId: call._id.toString(),
        callerId,
        callerName: caller.name || '',
        callerAvatar,
        callType: type,
        livekitToken: receiverToken.token,
        livekitUrl: receiverToken.url,
        roomName,
      }
    ).catch(err => console.error('[calls.initiate] FCM error:', err.message));
  } else {
    console.log(`[calls.initiate] Skipping FCM push to ${receiverId} (calls pref off)`);
  }

  // Notify online sockets of the receiver too — they may have the app
  // foregrounded and miss the FCM. Mirrors the socket handler's pattern.
  const io = req.app.get('io');
  if (io) {
    io.to(`user_${receiverId}`).emit('call:incoming', {
      callId: call._id.toString(),
      caller: {
        _id: caller._id,
        name: caller.name,
        profilePicture: (caller.images && caller.images[0]) || null,
      },
      callType: type,
      roomName,
    });
  }

  res.status(200).json({
    success: true,
    data: {
      call,
      token: callerToken.token,
      url: callerToken.url,
      roomName,
    },
  });
});

/**
 * @desc    Accept an incoming call. Marks the call active, mints a
 *          fresh receiver token (in case the FCM-delivered one
 *          expired), and emits call:accepted to the caller's socket.
 * @route   POST /api/v1/calls/:id/accept
 * @access  Private (receiver only)
 */
exports.acceptCall = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const call = await Call.findById(req.params.id);

  if (!call) {
    return next(new ErrorResponse('Call not found', 404));
  }

  // Receiver is the participant who is NOT the initiator.
  const receiverId = call.participants.find(
    p => p.toString() !== call.initiator.toString()
  );
  if (!receiverId || receiverId.toString() !== userId) {
    return next(new ErrorResponse('Not authorized to accept this call', 403));
  }

  if (call.status !== 'ringing') {
    return next(new ErrorResponse(`Call already ${call.status}`, 409));
  }

  call.status = 'active';
  call.answeredAt = new Date();
  await call.save();

  const roomName = _roomNameForCall(call._id);
  const receiver = await User.findById(userId);

  const { token, url } = await mintRoomToken({
    identity: userId,
    name: receiver?.name || 'Receiver',
    roomName,
    metadata: { role: 'receiver', callId: call._id.toString() },
  });

  // Notify the caller their call was accepted. Mirrors the socket
  // handler's pattern: user_<userId> rooms (see socket/callHandler.js
  // lines ~249-257 for the original emit).
  const io = req.app.get('io');
  if (io) {
    io.to(`user_${call.initiator.toString()}`).emit('call:accepted', {
      callId: call._id.toString(),
    });
  }

  res.status(200).json({
    success: true,
    data: { call, token, url, roomName },
  });
});

/**
 * @desc    Decline an incoming call. Marks the call rejected and
 *          emits call:declined to the caller's socket.
 * @route   POST /api/v1/calls/:id/decline
 * @access  Private (receiver only)
 */
exports.declineCall = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const call = await Call.findById(req.params.id);

  if (!call) {
    return next(new ErrorResponse('Call not found', 404));
  }

  const receiverId = call.participants.find(
    p => p.toString() !== call.initiator.toString()
  );
  if (!receiverId || receiverId.toString() !== userId) {
    return next(new ErrorResponse('Not authorized to decline this call', 403));
  }

  if (call.status !== 'ringing') {
    return next(new ErrorResponse(`Call already ${call.status}`, 409));
  }

  // Note: the Call schema enum doesn't include 'declined' — it uses
  // 'rejected' for the same semantic. We emit call:declined on the
  // wire (per B1 spec) while storing 'rejected' in the DB to stay
  // consistent with the existing socket handler and call history queries.
  call.status = 'rejected';
  call.endTime = new Date();
  call.endReason = 'rejected';
  await call.save();

  const io = req.app.get('io');
  if (io) {
    io.to(`user_${call.initiator.toString()}`).emit('call:declined', {
      callId: call._id.toString(),
    });
  }

  res.status(200).json({
    success: true,
    data: { call },
  });
});

/**
 * @desc    End an active or ringing call. Idempotent: re-ending a
 *          terminated call just returns its current state. Emits
 *          call:ended to both peers' sockets.
 * @route   POST /api/v1/calls/:id/end
 * @access  Private (initiator or receiver)
 */
exports.endCall = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const call = await Call.findById(req.params.id);

  if (!call) {
    return next(new ErrorResponse('Call not found', 404));
  }

  const isParticipant = call.participants.some(
    p => p.toString() === userId
  );
  if (!isParticipant) {
    return next(new ErrorResponse('Not authorized to end this call', 403));
  }

  // Idempotent return for already-terminated calls
  const terminalStatuses = ['ended', 'rejected', 'missed', 'failed', 'busy'];
  if (terminalStatuses.includes(call.status)) {
    return res.status(200).json({
      success: true,
      data: { call },
    });
  }

  call.status = 'ended';
  call.endTime = new Date();
  call.endReason = call.initiator.toString() === userId
    ? 'caller_ended'
    : 'receiver_ended';

  // Duration counts from when the call was answered (or, if it never
  // answered, from startTime — matches the existing socket handler).
  const durationStart = call.answeredAt || call.startTime;
  call.duration = Math.floor((call.endTime - durationStart) / 1000);
  await call.save();

  const io = req.app.get('io');
  if (io) {
    for (const participantId of call.participants) {
      io.to(`user_${participantId.toString()}`).emit('call:ended', {
        callId: call._id.toString(),
        duration: call.duration,
      });
    }
  }

  res.status(200).json({
    success: true,
    data: { call },
  });
});
