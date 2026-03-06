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
   * WebRTC signaling - offer (targeted to specific user)
   */
  socket.on('voiceroom:rtc_offer', async (data) => {
    try {
      const { roomId, targetUserId, offer } = data;
      if (!roomId || !targetUserId || !offer) return;

      // Verify room and participants
      const room = await VoiceRoom.findById(roomId);
      if (!room || !['waiting', 'active'].includes(room.status)) {
        console.log(`WebRTC offer rejected: Room ${roomId} not active`);
        return socket.emit('voiceroom:error', { message: 'Room not active' });
      }

      // Check both users are participants
      const participantIds = room.participants.map(p => p.user.toString());
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
      if (!roomId || !targetUserId || !answer) return;

      // Verify room and participants
      const room = await VoiceRoom.findById(roomId);
      if (!room || !['waiting', 'active'].includes(room.status)) {
        console.log(`WebRTC answer rejected: Room ${roomId} not active`);
        return socket.emit('voiceroom:error', { message: 'Room not active' });
      }

      // Check both users are participants
      const participantIds = room.participants.map(p => p.user.toString());
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
      if (!roomId || !targetUserId || !candidate) return;

      // Verify room and participants
      const room = await VoiceRoom.findById(roomId);
      if (!room || !['waiting', 'active'].includes(room.status)) {
        console.log(`ICE candidate rejected: Room ${roomId} not active`);
        return socket.emit('voiceroom:error', { message: 'Room not active' });
      }

      // Check both users are participants
      const participantIds = room.participants.map(p => p.user.toString());
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
