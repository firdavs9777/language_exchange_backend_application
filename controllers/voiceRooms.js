const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const VoiceRoom = require('../models/VoiceRoom');
const User = require('../models/User');

/**
 * @desc    Get all active voice rooms
 * @route   GET /api/v1/voicerooms
 * @access  Private
 */
exports.getVoiceRooms = asyncHandler(async (req, res, next) => {
  const { language, topic, page = 1, limit = 20 } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(Math.max(1, parseInt(limit)), 50);
  const skip = (pageNum - 1) * limitNum;

  const filter = {
    status: { $in: ['waiting', 'active'] },
    isPublic: true
  };

  if (language) filter.language = language;
  if (topic) filter.topic = topic;

  const [rooms, total] = await Promise.all([
    VoiceRoom.find(filter)
      .populate('host', 'name images')
      .populate('participants.user', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    VoiceRoom.countDocuments(filter)
  ]);

  // Format response
  const formattedRooms = rooms.map(room => ({
    _id: room._id,
    title: room.title,
    description: room.description,
    topic: room.topic,
    language: room.language,
    secondaryLanguage: room.secondaryLanguage,
    host: room.host,
    participantCount: room.participants?.length || 0,
    maxParticipants: room.maxParticipants,
    participants: room.participants?.slice(0, 5).map(p => ({
      _id: p.user?._id,
      name: p.user?.name,
      images: p.user?.images,
      role: p.role,
      isSpeaking: p.isSpeaking
    })),
    status: room.status,
    tags: room.tags,
    createdAt: room.createdAt
  }));

  res.status(200).json({
    success: true,
    data: formattedRooms,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: skip + rooms.length < total
    }
  });
});

/**
 * @desc    Get single voice room
 * @route   GET /api/v1/voicerooms/:id
 * @access  Private
 */
exports.getVoiceRoom = asyncHandler(async (req, res, next) => {
  const room = await VoiceRoom.findById(req.params.id)
    .populate('host', 'name images native_language language_to_learn')
    .populate('coHosts', 'name images')
    .populate('participants.user', 'name images native_language language_to_learn');

  if (!room) {
    return next(new ErrorResponse('Voice room not found', 404));
  }

  res.status(200).json({
    success: true,
    data: room
  });
});

/**
 * @desc    Create a voice room
 * @route   POST /api/v1/voicerooms
 * @access  Private
 */
exports.createVoiceRoom = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const {
    title,
    description,
    topic = 'language_exchange',
    language,
    secondaryLanguage,
    maxParticipants = 8,
    isPublic = true,
    scheduledAt,
    settings,
    tags
  } = req.body;

  if (!title) {
    return next(new ErrorResponse('Room title is required', 400));
  }

  if (!language) {
    return next(new ErrorResponse('Room language is required', 400));
  }

  // Check if user already has an active room
  const existingRoom = await VoiceRoom.findOne({
    host: userId,
    status: { $in: ['waiting', 'active'] }
  });

  if (existingRoom) {
    return next(new ErrorResponse('You already have an active room', 400));
  }

  // Create room
  const room = await VoiceRoom.create({
    title,
    description,
    topic,
    language,
    secondaryLanguage,
    host: userId,
    maxParticipants: Math.min(Math.max(2, maxParticipants), 50),
    isPublic,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    settings: settings || {},
    tags: tags?.slice(0, 5) || [],
    participants: [{
      user: userId,
      joinedAt: new Date(),
      isMuted: false,
      isSpeaking: false,
      role: 'host'
    }],
    stats: {
      totalParticipants: 1,
      peakParticipants: 1
    }
  });

  // Populate host info
  await room.populate('host', 'name images');

  // Emit socket event for new room
  const io = req.app.get('io');
  if (io) {
    io.emit('voiceroom:created', {
      roomId: room._id,
      title: room.title,
      host: room.host,
      language: room.language
    });
  }

  res.status(201).json({
    success: true,
    data: room
  });
});

/**
 * @desc    Join a voice room
 * @route   POST /api/v1/voicerooms/:id/join
 * @access  Private
 */
exports.joinVoiceRoom = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const roomId = req.params.id;

  const room = await VoiceRoom.findById(roomId);

  if (!room) {
    return next(new ErrorResponse('Voice room not found', 404));
  }

  if (room.status === 'ended') {
    return next(new ErrorResponse('This room has ended', 400));
  }

  if (room.hasParticipant(userId)) {
    return next(new ErrorResponse('You are already in this room', 400));
  }

  if (room.participants.length >= room.maxParticipants) {
    return next(new ErrorResponse('Room is full', 400));
  }

  // Check if user is blocked by host
  const host = await User.findById(room.host).select('blockedUsers');
  if (host?.blockedUsers?.includes(userId)) {
    return next(new ErrorResponse('You cannot join this room', 403));
  }

  // Add participant
  await room.addParticipant(userId, 'listener');

  // Populate for response
  await room.populate('participants.user', 'name images');

  // Emit socket event
  const io = req.app.get('io');
  if (io) {
    const user = await User.findById(userId).select('name images');
    io.to(`voiceroom_${roomId}`).emit('voiceroom:user_joined', {
      roomId,
      user: {
        _id: userId,
        name: user.name,
        images: user.images
      }
    });
  }

  res.status(200).json({
    success: true,
    data: {
      roomId: room._id,
      message: 'Joined room successfully',
      participantCount: room.participants.length
    }
  });
});

/**
 * @desc    Leave a voice room
 * @route   POST /api/v1/voicerooms/:id/leave
 * @access  Private
 */
exports.leaveVoiceRoom = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const roomId = req.params.id;

  const room = await VoiceRoom.findById(roomId);

  if (!room) {
    return next(new ErrorResponse('Voice room not found', 404));
  }

  if (!room.hasParticipant(userId)) {
    return next(new ErrorResponse('You are not in this room', 400));
  }

  // Remove participant
  await room.removeParticipant(userId);

  // Emit socket event
  const io = req.app.get('io');
  if (io) {
    io.to(`voiceroom_${roomId}`).emit('voiceroom:user_left', {
      roomId,
      userId,
      newHost: room.status !== 'ended' ? room.host : null,
      roomEnded: room.status === 'ended'
    });

    if (room.status === 'ended') {
      io.emit('voiceroom:ended', { roomId });
    }
  }

  res.status(200).json({
    success: true,
    data: {
      roomId: room._id,
      message: 'Left room successfully',
      roomEnded: room.status === 'ended'
    }
  });
});

/**
 * @desc    End a voice room (host only)
 * @route   POST /api/v1/voicerooms/:id/end
 * @access  Private
 */
exports.endVoiceRoom = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const roomId = req.params.id;

  const room = await VoiceRoom.findById(roomId);

  if (!room) {
    return next(new ErrorResponse('Voice room not found', 404));
  }

  if (!room.isHostOrCoHost(userId) && req.user.role !== 'admin') {
    return next(new ErrorResponse('Only the host can end the room', 403));
  }

  await room.end();

  // Emit socket event
  const io = req.app.get('io');
  if (io) {
    io.to(`voiceroom_${roomId}`).emit('voiceroom:ended', {
      roomId,
      endedBy: userId
    });
    io.emit('voiceroom:ended', { roomId });
  }

  res.status(200).json({
    success: true,
    data: {
      roomId: room._id,
      message: 'Room ended successfully',
      stats: room.stats
    }
  });
});

/**
 * @desc    Update participant status (mute/unmute/speaking)
 * @route   PUT /api/v1/voicerooms/:id/status
 * @access  Private
 */
exports.updateParticipantStatus = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const roomId = req.params.id;
  const { isMuted, isSpeaking } = req.body;

  const room = await VoiceRoom.findById(roomId);

  if (!room) {
    return next(new ErrorResponse('Voice room not found', 404));
  }

  const participant = room.participants.find(p => p.user?.toString() === userId);
  if (!participant) {
    return next(new ErrorResponse('You are not in this room', 400));
  }

  // Update status
  if (typeof isMuted === 'boolean') {
    participant.isMuted = isMuted;
  }
  if (typeof isSpeaking === 'boolean') {
    participant.isSpeaking = isSpeaking;
  }

  await room.save();

  // Emit socket event
  const io = req.app.get('io');
  if (io) {
    io.to(`voiceroom_${roomId}`).emit('voiceroom:participant_status', {
      roomId,
      userId,
      isMuted: participant.isMuted,
      isSpeaking: participant.isSpeaking
    });
  }

  res.status(200).json({
    success: true,
    data: {
      isMuted: participant.isMuted,
      isSpeaking: participant.isSpeaking
    }
  });
});

/**
 * @desc    Promote participant to co-host
 * @route   PUT /api/v1/voicerooms/:id/promote/:userId
 * @access  Private (host only)
 */
exports.promoteParticipant = asyncHandler(async (req, res, next) => {
  const hostId = req.user.id;
  const roomId = req.params.id;
  const targetUserId = req.params.userId;

  const room = await VoiceRoom.findById(roomId);

  if (!room) {
    return next(new ErrorResponse('Voice room not found', 404));
  }

  if (room.host.toString() !== hostId) {
    return next(new ErrorResponse('Only the host can promote participants', 403));
  }

  const participant = room.participants.find(p => p.user?.toString() === targetUserId);
  if (!participant) {
    return next(new ErrorResponse('User is not in this room', 400));
  }

  // Add to co-hosts
  if (!room.coHosts.includes(targetUserId)) {
    room.coHosts.push(targetUserId);
    participant.role = 'cohost';
    await room.save();
  }

  // Emit socket event
  const io = req.app.get('io');
  if (io) {
    io.to(`voiceroom_${roomId}`).emit('voiceroom:user_promoted', {
      roomId,
      userId: targetUserId,
      role: 'cohost'
    });
  }

  res.status(200).json({
    success: true,
    message: 'User promoted to co-host'
  });
});

/**
 * @desc    Get my active room
 * @route   GET /api/v1/voicerooms/my
 * @access  Private
 */
exports.getMyRoom = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const room = await VoiceRoom.findOne({
    $or: [
      { host: userId },
      { 'participants.user': userId }
    ],
    status: { $in: ['waiting', 'active'] }
  })
    .populate('host', 'name images')
    .populate('participants.user', 'name images');

  res.status(200).json({
    success: true,
    data: room || null
  });
});
