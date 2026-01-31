/**
 * Voice Room Socket Handler
 * Handles real-time events for voice rooms
 */

const VoiceRoom = require('../models/VoiceRoom');
const User = require('../models/User');

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
   * WebRTC signaling - offer
   */
  socket.on('voiceroom:rtc_offer', (data) => {
    const { roomId, targetUserId, offer } = data;
    if (!roomId || !targetUserId || !offer) return;

    // Send to specific user in room
    io.to(`voiceroom_${roomId}`).emit('voiceroom:rtc_offer', {
      roomId,
      fromUserId: userId,
      offer
    });
  });

  /**
   * WebRTC signaling - answer
   */
  socket.on('voiceroom:rtc_answer', (data) => {
    const { roomId, targetUserId, answer } = data;
    if (!roomId || !targetUserId || !answer) return;

    io.to(`voiceroom_${roomId}`).emit('voiceroom:rtc_answer', {
      roomId,
      fromUserId: userId,
      answer
    });
  });

  /**
   * WebRTC signaling - ICE candidate
   */
  socket.on('voiceroom:ice_candidate', (data) => {
    const { roomId, targetUserId, candidate } = data;
    if (!roomId || !candidate) return;

    io.to(`voiceroom_${roomId}`).emit('voiceroom:ice_candidate', {
      roomId,
      fromUserId: userId,
      candidate
    });
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

          io.to(`voiceroom_${room._id}`).emit('voiceroom:user_left', {
            roomId: room._id,
            userId,
            roomEnded: room.status === 'ended'
          });

          if (room.status === 'ended') {
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
