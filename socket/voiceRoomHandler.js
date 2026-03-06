/**
 * Voice Room Socket Handler
 * Handles real-time events for voice rooms
 */

const VoiceRoom = require('../models/VoiceRoom');
const User = require('../models/User');

// Cache of active room participants for fast signaling validation
// Key: roomId, Value: { participantIds: Set<string>, status: string, lastUpdated: Date }
const roomParticipantsCache = new Map();

/**
 * Get room participant data (from cache or DB)
 * @param {string} roomId - Room ID
 * @param {boolean} forceRefresh - Force DB lookup
 * @returns {Promise<{participantIds: string[], status: string}|null>}
 */
const getRoomParticipants = async (roomId, forceRefresh = false) => {
  const cached = roomParticipantsCache.get(roomId);
  const now = Date.now();

  // Use cache if fresh (within 30 seconds) and not forcing refresh
  if (cached && !forceRefresh && (now - cached.lastUpdated) < 30000) {
    return { participantIds: [...cached.participantIds], status: cached.status };
  }

  // Fetch from DB
  const room = await VoiceRoom.findById(roomId).select('participants status');
  if (!room) return null;

  const participantIds = new Set(room.participants.map(p => p.user.toString()));
  roomParticipantsCache.set(roomId, {
    participantIds,
    status: room.status,
    lastUpdated: now
  });

  return { participantIds: [...participantIds], status: room.status };
};

/**
 * Update cache when participant joins
 */
const addParticipantToCache = (roomId, participantId) => {
  const cached = roomParticipantsCache.get(roomId);
  if (cached) {
    cached.participantIds.add(participantId);
    cached.lastUpdated = Date.now();
  }
};

/**
 * Update cache when participant leaves
 */
const removeParticipantFromCache = (roomId, participantId) => {
  const cached = roomParticipantsCache.get(roomId);
  if (cached) {
    cached.participantIds.delete(participantId);
    cached.lastUpdated = Date.now();
  }
};

/**
 * Clear room from cache (when room ends)
 */
const clearRoomCache = (roomId) => {
  roomParticipantsCache.delete(roomId);
};

/**
 * Register voice room socket handlers
 */
const registerVoiceRoomHandlers = (socket, io) => {
  const userId = socket.user?.id;

  if (!userId) return;

  /**
   * Join a voice room's socket channel
   */
  socket.on('voiceroom:join', async (data) => {
    try {
      const { roomId } = data;

      if (!roomId) {
        return socket.emit('voiceroom:error', { message: 'Room ID required' });
      }

      const room = await VoiceRoom.findById(roomId);
      if (!room) {
        return socket.emit('voiceroom:error', { message: 'Room not found' });
      }

      // Join socket room
      socket.join(`voiceroom_${roomId}`);

      // Get user info
      const user = await User.findById(userId).select('name images');

      // Add to cache
      addParticipantToCache(roomId, userId);

      // Notify others
      socket.to(`voiceroom_${roomId}`).emit('voiceroom:user_joined', {
        roomId,
        user: {
          _id: userId,
          name: user?.name,
          images: user?.images
        }
      });

      // Send current room state to joining user
      socket.emit('voiceroom:joined', {
        roomId,
        participants: room.participants
      });

    } catch (error) {
      socket.emit('voiceroom:error', { message: error.message });
    }
  });

  /**
   * Leave a voice room's socket channel
   */
  socket.on('voiceroom:leave', async (data) => {
    try {
      const { roomId } = data;

      if (!roomId) return;

      // Leave socket room
      socket.leave(`voiceroom_${roomId}`);

      // Update cache
      removeParticipantFromCache(roomId, userId);

      // Notify others
      socket.to(`voiceroom_${roomId}`).emit('voiceroom:user_left', {
        roomId,
        userId
      });

    } catch (error) {
      socket.emit('voiceroom:error', { message: error.message });
    }
  });

  /**
   * User started/stopped speaking
   */
  socket.on('voiceroom:speaking', async (data) => {
    try {
      const { roomId, isSpeaking } = data;

      if (!roomId) return;

      // Broadcast to room
      socket.to(`voiceroom_${roomId}`).emit('voiceroom:speaking', {
        roomId,
        userId,
        isSpeaking: !!isSpeaking
      });

    } catch (error) {
      socket.emit('voiceroom:error', { message: error.message });
    }
  });

  /**
   * User muted/unmuted
   */
  socket.on('voiceroom:mute', async (data) => {
    try {
      const { roomId, isMuted } = data;

      if (!roomId) return;

      // Update in database
      await VoiceRoom.findOneAndUpdate(
        { _id: roomId, 'participants.user': userId },
        { $set: { 'participants.$.isMuted': !!isMuted } }
      );

      // Broadcast to room
      io.to(`voiceroom_${roomId}`).emit('voiceroom:mute', {
        roomId,
        userId,
        isMuted: !!isMuted
      });

    } catch (error) {
      socket.emit('voiceroom:error', { message: error.message });
    }
  });

  /**
   * WebRTC signaling - offer (targeted to specific user)
   */
  socket.on('voiceroom:rtc_offer', async (data) => {
    try {
      const { roomId, targetUserId, offer } = data;
      if (!roomId || !targetUserId || !offer) {
        console.log('WebRTC offer rejected: Missing required fields');
        return;
      }

      // Verify room and participants (using cache for performance)
      const roomData = await getRoomParticipants(roomId);
      if (!roomData || !['waiting', 'active'].includes(roomData.status)) {
        console.log(`WebRTC offer rejected: Room ${roomId} not active`);
        return socket.emit('voiceroom:error', { message: 'Room not active' });
      }

      // Check both users are participants
      const participantIds = roomData.participantIds;
      if (!participantIds.includes(userId)) {
        console.log(`WebRTC offer rejected: User ${userId} not in room ${roomId}`);
        return socket.emit('voiceroom:error', { message: 'Not authorized' });
      }
      if (!participantIds.includes(targetUserId)) {
        console.log(`WebRTC offer rejected: Target ${targetUserId} not in room ${roomId}`);
        return socket.emit('voiceroom:error', { message: 'Target not in room' });
      }

      // Send to target user
      const targetRoom = `user_${targetUserId}`;
      io.to(targetRoom).emit('voiceroom:rtc_offer', {
        roomId,
        fromUserId: userId,
        offer
      });
    } catch (error) {
      console.error('voiceroom:rtc_offer error:', error);
      socket.emit('voiceroom:error', { message: error.message });
    }
  });

  /**
   * WebRTC signaling - answer (targeted to specific user)
   */
  socket.on('voiceroom:rtc_answer', async (data) => {
    try {
      const { roomId, targetUserId, answer } = data;
      if (!roomId || !targetUserId || !answer) {
        console.log('WebRTC answer rejected: Missing required fields');
        return;
      }

      // Verify room and participants (using cache for performance)
      const roomData = await getRoomParticipants(roomId);
      if (!roomData || !['waiting', 'active'].includes(roomData.status)) {
        console.log(`WebRTC answer rejected: Room ${roomId} not active`);
        return socket.emit('voiceroom:error', { message: 'Room not active' });
      }

      // Check both users are participants
      const participantIds = roomData.participantIds;
      if (!participantIds.includes(userId)) {
        console.log(`WebRTC answer rejected: User ${userId} not in room ${roomId}`);
        return socket.emit('voiceroom:error', { message: 'Not authorized' });
      }
      if (!participantIds.includes(targetUserId)) {
        console.log(`WebRTC answer rejected: Target ${targetUserId} not in room ${roomId}`);
        return socket.emit('voiceroom:error', { message: 'Target not in room' });
      }

      // Send to target user
      const targetRoom = `user_${targetUserId}`;
      io.to(targetRoom).emit('voiceroom:rtc_answer', {
        roomId,
        fromUserId: userId,
        answer
      });
    } catch (error) {
      console.error('voiceroom:rtc_answer error:', error);
      socket.emit('voiceroom:error', { message: error.message });
    }
  });

  /**
   * WebRTC signaling - ICE candidate (targeted to specific user)
   */
  socket.on('voiceroom:ice_candidate', async (data) => {
    try {
      const { roomId, targetUserId, candidate } = data;
      if (!roomId || !targetUserId || !candidate) {
        console.log('ICE candidate rejected: Missing required fields');
        return;
      }

      // Verify room and participants (using cache for performance)
      const roomData = await getRoomParticipants(roomId);
      if (!roomData || !['waiting', 'active'].includes(roomData.status)) {
        console.log(`ICE candidate rejected: Room ${roomId} not active`);
        return socket.emit('voiceroom:error', { message: 'Room not active' });
      }

      // Check both users are participants
      const participantIds = roomData.participantIds;
      if (!participantIds.includes(userId)) {
        console.log(`ICE candidate rejected: User ${userId} not in room ${roomId}`);
        return socket.emit('voiceroom:error', { message: 'Not authorized' });
      }
      if (!participantIds.includes(targetUserId)) {
        console.log(`ICE candidate rejected: Target ${targetUserId} not in room ${roomId}`);
        return socket.emit('voiceroom:error', { message: 'Target not in room' });
      }

      // Send to target user
      const targetRoom = `user_${targetUserId}`;
      io.to(targetRoom).emit('voiceroom:ice_candidate', {
        roomId,
        fromUserId: userId,
        candidate
      });
    } catch (error) {
      console.error('voiceroom:ice_candidate error:', error);
      socket.emit('voiceroom:error', { message: error.message });
    }
  });

  /**
   * Raise hand (request to speak)
   */
  socket.on('voiceroom:raise_hand', async (data) => {
    try {
      const { roomId } = data;

      if (!roomId) return;

      const user = await User.findById(userId).select('name images');

      io.to(`voiceroom_${roomId}`).emit('voiceroom:hand_raised', {
        roomId,
        user: {
          _id: userId,
          name: user?.name,
          images: user?.images
        }
      });

    } catch (error) {
      socket.emit('voiceroom:error', { message: error.message });
    }
  });

  /**
   * Send chat message in room
   */
  socket.on('voiceroom:chat', async (data) => {
    try {
      const { roomId, message } = data;

      if (!roomId || !message) return;

      const user = await User.findById(userId).select('name images');

      io.to(`voiceroom_${roomId}`).emit('voiceroom:chat', {
        roomId,
        message: message.substring(0, 500),
        user: {
          _id: userId,
          name: user?.name,
          images: user?.images
        },
        timestamp: new Date()
      });

    } catch (error) {
      socket.emit('voiceroom:error', { message: error.message });
    }
  });

  /**
   * Handle disconnect - leave all voice rooms
   */
  socket.on('disconnect', async () => {
    try {
      // Find rooms user is in
      const rooms = await VoiceRoom.find({
        'participants.user': userId,
        status: { $in: ['waiting', 'active'] }
      });

      for (const room of rooms) {
        try {
          await room.removeParticipant(userId);

          // Update cache
          removeParticipantFromCache(room._id.toString(), userId);

          io.to(`voiceroom_${room._id}`).emit('voiceroom:user_left', {
            roomId: room._id,
            userId,
            roomEnded: room.status === 'ended'
          });

          if (room.status === 'ended') {
            clearRoomCache(room._id.toString());
            io.emit('voiceroom:ended', { roomId: room._id });
          }
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  });
};

module.exports = { registerVoiceRoomHandlers };
