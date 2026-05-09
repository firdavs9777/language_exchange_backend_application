/**
 * Voice Room Socket Handler
 * Handles real-time events for voice rooms
 */

const VoiceRoom = require('../models/VoiceRoom');
const User = require('../models/User');
const { getCachedIceServers } = require('../services/callService');

// Cache of active room participants for fast signaling validation
// Key: roomId, Value: { participantIds: Set<string>, status: string, lastUpdated: Date }
const roomParticipantsCache = new Map();

// ---------------------------------------------------------------------------
// Host transfer grace-timer state machine (C26)
// ---------------------------------------------------------------------------
// Key: `${roomId}:${userId}` → setTimeout handle
const hostGraceTimers = new Map();
const HOST_GRACE_MS = 30 * 1000;

/**
 * Schedule a host-transfer after HOST_GRACE_MS.
 * If a timer for this {roomId, hostUserId} pair is already pending, this is a
 * no-op (idempotent).  Pass graceMs=0 for an immediate (explicit-leave) transfer.
 *
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 * @param {string} hostUserId
 * @param {number} [graceMs]
 */
function scheduleHostTransfer(io, roomId, hostUserId, graceMs = HOST_GRACE_MS) {
  const key = `${roomId}:${hostUserId}`;
  if (hostGraceTimers.has(key)) return; // already pending — don't reset

  const timer = setTimeout(async () => {
    hostGraceTimers.delete(key);
    try {
      const room = await VoiceRoom.findById(roomId);
      if (!room || room.status !== 'active') return;
      // Guard: another path may have already changed the host
      if (String(room.host) !== String(hostUserId)) return;

      if (!room.participants || room.participants.length === 0) {
        // Empty room — end immediately
        room.status = 'ended';
        room.endedAt = new Date();
        await room.save();
        clearRoomCache(String(roomId));
        io.emit('voiceroom:ended', { roomId: String(roomId) });
        return;
      }

      // Promote the participant with the oldest joinedAt
      const sorted = [...room.participants].sort(
        (a, b) => new Date(a.joinedAt) - new Date(b.joinedAt)
      );
      const newHostEntry = sorted[0];
      const previousHostId = String(hostUserId);
      const newHostId = String(newHostEntry.user);

      room.host = newHostEntry.user;
      // Update the role field on the promoted participant subdoc
      const subdoc = room.participants.find(
        (p) => String(p.user) === newHostId
      );
      if (subdoc) subdoc.role = 'host';

      await room.save();

      io.to(`voiceroom_${roomId}`).emit('voiceroom:host-changed', {
        newHostId,
        previousHostId,
      });
    } catch (err) {
      console.error('[host-transfer] timer error:', err);
    }
  }, graceMs);

  hostGraceTimers.set(key, timer);
}

/**
 * Cancel a pending host-transfer grace timer for {roomId, hostUserId}.
 * Safe to call even if no timer exists.
 *
 * @param {string} roomId
 * @param {string} hostUserId
 */
function cancelHostTransfer(roomId, hostUserId) {
  const key = `${roomId}:${hostUserId}`;
  const timer = hostGraceTimers.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    hostGraceTimers.delete(key);
  }
}

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

      // Initialize cache with current room data
      roomParticipantsCache.set(roomId, {
        participantIds: new Set(room.participants.map(p => p.user.toString())),
        status: room.status,
        lastUpdated: Date.now()
      });

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
        },
        participantCount: roomParticipantsCache.get(roomId)?.participantIds.size || room.participants.length + 1
      });

      // Get ICE servers for WebRTC (with fallback)
      let iceServers;
      try {
        iceServers = await getCachedIceServers();
      } catch (err) {
        console.error('Failed to get ICE servers, using fallback:', err.message);
        iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
      }

      // Send current room state to joining user with ICE servers
      socket.emit('voiceroom:joined', {
        roomId,
        participants: room.participants,
        iceServers
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

      // Cancel any pending grace timer — the user is explicitly leaving, so the
      // grace window (started by an earlier disconnect) is no longer relevant.
      cancelHostTransfer(roomId, userId);

      // Update database — remove participant
      const room = await VoiceRoom.findById(roomId);
      if (!room || !room.hasParticipant(userId)) {
        return;
      }

      const wasHost = String(room.host) === String(userId);

      if (wasHost && room.participants.length > 1) {
        // Host is explicitly leaving but there are other participants:
        // Remove host from participants first, then schedule an immediate
        // transfer (graceMs=0) so the promotion logic runs atomically.
        room.participants = room.participants.filter(
          (p) => String(p.user) !== String(userId)
        );
        await room.save();

        // Update cache
        removeParticipantFromCache(roomId, userId);

        // Notify others that the user has left
        socket.to(`voiceroom_${roomId}`).emit('voiceroom:user_left', {
          roomId,
          userId,
          roomEnded: false,
        });

        // Immediate host transfer (graceMs=0)
        scheduleHostTransfer(io, roomId, userId, 0);
        return;
      }

      // Non-host leave, OR host leaving an empty room — use existing model method
      // which handles the ended-room case when participants.length === 0.
      await room.removeParticipant(userId);

      // Update cache
      removeParticipantFromCache(roomId, userId);

      // Check if room ended (host left with no one to transfer to)
      const roomEnded = room.status === 'ended';

      // Notify others
      socket.to(`voiceroom_${roomId}`).emit('voiceroom:user_left', {
        roomId,
        userId,
        roomEnded,
      });

      if (roomEnded) {
        clearRoomCache(roomId);
        io.emit('voiceroom:ended', { roomId });
      }

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
   * Host mutes all participants (C11)
   */
  socket.on('voiceroom:mute-all', async (data = {}) => {
    try {
      const { roomId } = data;
      if (!roomId) return;

      const room = await VoiceRoom.findById(roomId);
      if (!room) return;

      // Only the host may trigger mute-all
      if (String(room.host) !== String(userId)) return;

      // Update every participant's isMuted flag in the DB
      await VoiceRoom.updateMany(
        { _id: roomId },
        { $set: { 'participants.$[].isMuted': true } }
      );

      // Broadcast a forced mute event for each participant
      for (const p of room.participants) {
        const pid = String(p.user?._id || p.user);
        io.to(`voiceroom_${roomId}`).emit('voiceroom:mute', {
          roomId,
          userId: pid,
          isMuted: true,
          forced: true,
        });
      }
    } catch (err) {
      console.error('[voiceroom:mute-all]', err);
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
      if (!participantIds.includes(userId.toString())) {
        console.log(`WebRTC offer rejected: User ${userId} not in room ${roomId}`);
        return socket.emit('voiceroom:error', { message: 'Not authorized' });
      }
      if (!participantIds.includes(targetUserId.toString())) {
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
      if (!participantIds.includes(userId.toString())) {
        console.log(`WebRTC answer rejected: User ${userId} not in room ${roomId}`);
        return socket.emit('voiceroom:error', { message: 'Not authorized' });
      }
      if (!participantIds.includes(targetUserId.toString())) {
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
      if (!participantIds.includes(userId.toString())) {
        console.log(`ICE candidate rejected: User ${userId} not in room ${roomId}`);
        return socket.emit('voiceroom:error', { message: 'Not authorized' });
      }
      if (!participantIds.includes(targetUserId.toString())) {
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
   * Rejoin — called when a client reconnects to a room it was already in
   * (e.g. after a network drop or app background/foreground cycle).
   * Acks { ok, ended, currentHostId?, youArePromoted?, participants? }
   */
  socket.on('voiceroom:rejoin', async ({ roomId, lastSeenAt } = {}, ack) => {
    try {
      if (!roomId) {
        if (typeof ack === 'function') ack({ ok: false, ended: true });
        return;
      }

      // Cancel any pending grace timer — host has reconnected within the window.
      cancelHostTransfer(roomId, userId);

      const room = await VoiceRoom.findById(roomId);

      // Room missing or no longer active
      if (!room || room.status !== 'active') {
        if (typeof ack === 'function') ack({ ok: false, ended: true });
        socket.emit('voiceroom:ended', { roomId });
        return;
      }

      // Re-add to participants if missing
      const isParticipant = room.hasParticipant(userId);
      if (!isParticipant) {
        room.participants.push({
          user: userId,
          joinedAt: new Date(),
          isMuted: true,
        });
        await room.save();

        // Update cache
        addParticipantToCache(roomId, userId);

        socket.to(`voiceroom_${roomId}`).emit('voiceroom:user_joined', {
          roomId,
          userId,
          joinedAt: new Date().toISOString(),
        });
      }

      // Subscribe socket to the room channel
      socket.join(`voiceroom_${roomId}`);

      // Determine if rejoining user is still the host
      const currentHostId = String(room.host);
      const youArePromoted = currentHostId === String(userId);

      if (typeof ack === 'function') {
        ack({
          ok: true,
          ended: false,
          currentHostId,
          youArePromoted,
          participants: room.participants,
        });
      }
    } catch (err) {
      console.error('[voiceroom:rejoin]', err);
      if (typeof ack === 'function') ack({ ok: false, ended: true });
    }
  });

  /**
   * Heartbeat — clients send this every ~30s while in a room so we can detect
   * stale/abandoned rooms (host crashed, network dropped, etc.).
   */
  socket.on('voiceroom:heartbeat', async ({ roomId }) => {
    if (!roomId) return;
    try {
      await VoiceRoom.updateOne(
        { _id: roomId },
        { lastHeartbeatAt: new Date() }
      );
      // If the host reconnects and sends a heartbeat before the grace timer
      // fires, cancel the pending transfer.
      cancelHostTransfer(roomId, userId);
    } catch (err) {
      console.error('[voiceroom:heartbeat]', err);
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
          const roomId = room._id.toString();
          const isHost = String(room.host) === String(userId);

          if (isHost) {
            // Host disconnected — start a 30s grace timer instead of removing
            // immediately.  If they reconnect (rejoin or heartbeat), the timer
            // is cancelled.  If the timer fires, the next-oldest participant is
            // promoted (or the room is ended if empty).
            scheduleHostTransfer(io, roomId, userId);

            // Notify others that the host has temporarily left so the UI can
            // show the grace-period state, but do NOT mark them removed yet.
            io.to(`voiceroom_${roomId}`).emit('voiceroom:user_left', {
              roomId,
              userId,
              roomEnded: false,
              graceTransfer: true,
            });
          } else {
            // Non-host disconnect — remove immediately as before.
            await room.removeParticipant(userId);

            removeParticipantFromCache(roomId, userId);

            io.to(`voiceroom_${roomId}`).emit('voiceroom:user_left', {
              roomId,
              userId,
              roomEnded: room.status === 'ended',
            });

            if (room.status === 'ended') {
              clearRoomCache(roomId);
              io.emit('voiceroom:ended', { roomId });
            }
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
