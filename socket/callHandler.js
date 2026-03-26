const Call = require('../models/Call');
const User = require('../models/User');
const callService = require('../services/callService');
const { sendToUser } = require('../services/fcmService');

// Track active calls (callId -> { participants, status })
const activeCalls = new Map();

// Track call timeouts (callId -> timeoutId)
const callTimeouts = new Map();

// Call timeout duration (60 seconds)
const CALL_TIMEOUT_MS = 60 * 1000;

/**
 * Register WebRTC call event handlers
 */
const registerCallHandlers = (socket, io) => {
  const userId = socket.user.id;
  
  // ============ CALL INITIATION ============
  
  socket.on('call:initiate', async (data, callback) => {
    try {
      const { targetUserId, callType } = data;
      
      if (!targetUserId || !callType) {
        throw new Error('Target user ID and call type are required');
      }
      
      if (!['audio', 'video'].includes(callType)) {
        throw new Error('Invalid call type');
      }
      
      console.log(`📞 Call initiate: ${userId} → ${targetUserId} (${callType})`);
      
      // Get caller and recipient info
      const caller = await User.findById(userId).select('name profilePicture blockedUsers blockedBy');
      const recipient = await User.findById(targetUserId).select('name profilePicture');
      
      if (!caller || !recipient) {
        throw new Error('User not found');
      }

      // Check block status
      if (caller.blockedUsers?.includes(targetUserId) ||
          caller.blockedBy?.includes(targetUserId)) {
        console.log(`Call rejected: Block relationship exists between ${userId} and ${targetUserId}`);
        return callback({
          status: 'error',
          error: 'Cannot call this user'
        });
      }

      const recipientRoom = `user_${targetUserId}`;
      const recipientSockets = await io.in(recipientRoom).fetchSockets();
      const isRecipientOnline = recipientSockets.length > 0;

      // Check if user is already in a call
      for (const [callId, callData] of activeCalls.entries()) {
        if (callData.participants.includes(userId) || callData.participants.includes(targetUserId)) {
          return callback({
            status: 'error',
            error: 'User is already in a call'
          });
        }
      }

      // Create call record
      const call = await Call.create({
        participants: [userId, targetUserId],
        type: callType,
        status: 'ringing',
        initiator: userId,
        startTime: new Date()
      });

      // Get ICE servers for WebRTC
      const iceServers = await callService.getCachedIceServers();

      // Track active call
      activeCalls.set(call._id.toString(), {
        participants: [userId, targetUserId],
        status: 'ringing',
        type: callType
      });

      // Set timeout for unanswered call
      const timeoutId = setTimeout(async () => {
        try {
          const callData = activeCalls.get(call._id.toString());
          if (callData && callData.status === 'ringing') {
            // Mark as missed
            call.status = 'missed';
            call.endTime = new Date();
            call.endReason = 'timeout';
            await call.save();

            activeCalls.delete(call._id.toString());
            callTimeouts.delete(call._id.toString());

            // Notify caller
            io.to(`user_${userId}`).emit('call:timeout', {
              callId: call._id,
              reason: 'No answer'
            });

            // Notify recipient (if they came online)
            io.to(recipientRoom).emit('call:missed', {
              callId: call._id,
              caller: {
                _id: caller._id,
                name: caller.name,
                profilePicture: caller.profilePicture
              }
            });

            // Send push notification for missed call
            sendToUser(
              targetUserId,
              {
                title: 'Missed Call',
                body: `You missed a call from ${caller.name}`
              },
              {
                type: 'missed_call',
                callId: call._id.toString(),
                callerId: userId,
                callerName: caller.name
              }
            ).catch(err => console.error('FCM error:', err.message));

            console.log(`⏰ Call timeout: ${call._id}`);
          }
        } catch (error) {
          console.error('❌ Call timeout error:', error.message);
          // Still cleanup maps even if db save fails
          activeCalls.delete(call._id.toString());
          callTimeouts.delete(call._id.toString());
        }
      }, CALL_TIMEOUT_MS);

      callTimeouts.set(call._id.toString(), timeoutId);

      // Notify recipient via socket if online
      if (isRecipientOnline) {
        io.to(recipientRoom).emit('call:incoming', {
          callId: call._id,
          caller: {
            _id: caller._id,
            name: caller.name,
            profilePicture: caller.profilePicture
          },
          callType: callType,
          iceServers
        });
      }

      // Always send push notification — wakes up the app even if offline
      sendToUser(
        targetUserId,
        {
          title: `Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`,
          body: `${caller.name} is calling you...`
        },
        {
          type: 'incoming_call',
          callId: call._id.toString(),
          callerId: userId,
          callerName: caller.name,
          callerAvatar: caller.profilePicture || '',
          callType
        }
      ).catch(err => console.error('FCM error:', err.message));

      // Confirm to caller
      if (callback) {
        callback({
          status: 'success',
          callId: call._id,
          recipient: {
            _id: recipient._id,
            name: recipient.name,
            profilePicture: recipient.profilePicture
          },
          iceServers
        });
      }
      
      console.log(`✅ Call initiated: ${call._id}`);
      
    } catch (error) {
      console.error('❌ Call initiate error:', error.message);
      if (callback) {
        callback({
          status: 'error',
          error: error.message
        });
      }
    }
  });
  
  // ============ CALL ANSWER/REJECT ============
  
  socket.on('call:answer', async (data, callback) => {
    try {
      const { callId, accept } = data;
      
      if (!callId) {
        throw new Error('Call ID is required');
      }
      
      console.log(`📞 Call answer: ${callId} - ${accept ? 'accepted' : 'rejected'}`);
      
      const call = await Call.findById(callId);
      
      if (!call) {
        throw new Error('Call not found');
      }
      
      const callData = activeCalls.get(callId);
      
      if (accept) {
        // Clear timeout
        const timeoutId = callTimeouts.get(callId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          callTimeouts.delete(callId);
        }

        // Accept call
        call.status = 'active';
        await call.save();
        
        if (callData) {
          callData.status = 'active';
        }
        
        // Notify both parties to start WebRTC
        const initiatorRoom = `user_${call.initiator.toString()}`;
        
        io.to(initiatorRoom).emit('call:accepted', {
          callId,
          acceptedBy: userId
        });
        
        socket.emit('call:start', { callId });
        io.to(initiatorRoom).emit('call:start', { callId });
        
        if (callback) {
          callback({
            status: 'success',
            callId
          });
        }
        
        console.log(`✅ Call accepted: ${callId}`);
        
      } else {
        // Clear timeout
        const timeoutId = callTimeouts.get(callId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          callTimeouts.delete(callId);
        }

        // Reject call
        call.status = 'rejected';
        call.endTime = new Date();
        call.endReason = 'rejected';
        await call.save();
        
        activeCalls.delete(callId);
        
        // Notify initiator
        const initiatorRoom = `user_${call.initiator.toString()}`;
        io.to(initiatorRoom).emit('call:rejected', {
          callId,
          rejectedBy: userId
        });
        
        if (callback) {
          callback({
            status: 'success',
            callId
          });
        }
        
        console.log(`❌ Call rejected: ${callId}`);
      }
      
    } catch (error) {
      console.error('❌ Call answer error:', error.message);
      if (callback) {
        callback({
          status: 'error',
          error: error.message
        });
      }
    }
  });
  
  // ============ WEBRTC SIGNALING ============
  
  socket.on('call:offer', (data) => {
    try {
      const { callId, targetUserId, offer } = data;
      
      if (!callId || !targetUserId || !offer) {
        console.error('Missing required fields for call:offer');
        return;
      }
      
      console.log(`📡 WebRTC offer: ${userId} → ${targetUserId}`);
      
      const targetRoom = `user_${targetUserId}`;
      io.to(targetRoom).emit('call:offer', {
        callId,
        fromUserId: userId,
        offer
      });
      
    } catch (error) {
      console.error('❌ Call offer error:', error.message);
    }
  });
  
  socket.on('call:answer-sdp', (data) => {
    try {
      const { callId, targetUserId, answer } = data;
      
      if (!callId || !targetUserId || !answer) {
        console.error('Missing required fields for call:answer-sdp');
        return;
      }
      
      console.log(`📡 WebRTC answer: ${userId} → ${targetUserId}`);
      
      const targetRoom = `user_${targetUserId}`;
      io.to(targetRoom).emit('call:answer-sdp', {
        callId,
        fromUserId: userId,
        answer
      });
      
    } catch (error) {
      console.error('❌ Call answer SDP error:', error.message);
    }
  });
  
  socket.on('call:ice-candidate', (data) => {
    try {
      const { callId, targetUserId, candidate } = data;
      
      if (!callId || !targetUserId || !candidate) {
        return;
      }
      
      const targetRoom = `user_${targetUserId}`;
      io.to(targetRoom).emit('call:ice-candidate', {
        callId,
        fromUserId: userId,
        candidate
      });
      
    } catch (error) {
      console.error('❌ ICE candidate error:', error.message);
    }
  });
  
  // ============ CALL CONTROL ============
  
  socket.on('call:end', async (data, callback) => {
    try {
      const { callId } = data;
      
      if (!callId) {
        throw new Error('Call ID is required');
      }
      
      console.log(`📞 Call end: ${callId} by ${userId}`);
      
      const call = await Call.findById(callId);
      
      if (!call) {
        throw new Error('Call not found');
      }

      // Clear timeout
      const timeoutId = callTimeouts.get(callId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        callTimeouts.delete(callId);
      }

      call.status = 'ended';
      call.endTime = new Date();
      call.endReason = call.initiator.toString() === userId ? 'caller_ended' : 'receiver_ended';
      // Calculate duration from when call was answered, not when it started ringing
      const durationStart = call.answeredAt || call.startTime;
      call.duration = Math.floor((call.endTime - durationStart) / 1000);
      await call.save();

      // Remove from active calls
      activeCalls.delete(callId);
      
      // Notify other participant
      const otherUserId = call.participants.find(
        id => id.toString() !== userId
      );
      
      if (otherUserId) {
        const otherUserRoom = `user_${otherUserId.toString()}`;
        io.to(otherUserRoom).emit('call:ended', {
          callId,
          endedBy: userId,
          duration: call.duration
        });
      }
      
      socket.emit('call:ended', {
        callId,
        duration: call.duration
      });
      
      if (callback) {
        callback({
          status: 'success',
          callId,
          duration: call.duration
        });
      }
      
      console.log(`✅ Call ended: ${callId} (${call.duration}s)`);

    } catch (error) {
      console.error('❌ Call end error:', error.message);
      if (callback) {
        callback({
          status: 'error',
          error: error.message
        });
      }
    }
  });

  // ============ MUTE TOGGLE ============

  socket.on('call:mute', async (data, callback) => {
    try {
      const { callId, isMuted } = data;

      if (!callId || typeof isMuted !== 'boolean') {
        throw new Error('Call ID and muted state are required');
      }

      console.log(`🔇 Call mute: ${callId} - ${isMuted ? 'muted' : 'unmuted'} by ${userId}`);

      const call = await Call.findById(callId);

      if (!call) {
        throw new Error('Call not found');
      }

      // Verify user is a participant
      const isParticipant = call.participants.some(
        id => id.toString() === userId
      );
      if (!isParticipant) {
        throw new Error('Not authorized for this call');
      }

      // Verify call is active
      if (call.status !== 'active') {
        throw new Error('Call is not active');
      }

      // Notify other participant
      const otherUserId = call.participants.find(
        id => id.toString() !== userId
      );

      if (otherUserId) {
        const otherUserRoom = `user_${otherUserId.toString()}`;
        io.to(otherUserRoom).emit('call:mute', {
          callId,
          userId,
          isMuted
        });
      }

      if (callback) {
        callback({ status: 'success' });
      }

    } catch (error) {
      console.error('❌ Call mute error:', error.message);
      if (callback) {
        callback({ status: 'error', error: error.message });
      }
    }
  });

  // ============ VIDEO TOGGLE ============

  socket.on('call:video-toggle', async (data, callback) => {
    try {
      const { callId, isVideoEnabled } = data;

      if (!callId || typeof isVideoEnabled !== 'boolean') {
        throw new Error('Call ID and video state are required');
      }

      console.log(`📹 Video toggle: ${callId} - ${isVideoEnabled ? 'on' : 'off'} by ${userId}`);

      const call = await Call.findById(callId);

      if (!call) {
        throw new Error('Call not found');
      }

      // Verify user is a participant
      const isParticipant = call.participants.some(
        id => id.toString() === userId
      );
      if (!isParticipant) {
        throw new Error('Not authorized for this call');
      }

      // Verify call is active
      if (call.status !== 'active') {
        throw new Error('Call is not active');
      }

      // Notify other participant
      const otherUserId = call.participants.find(
        id => id.toString() !== userId
      );

      if (otherUserId) {
        const otherUserRoom = `user_${otherUserId.toString()}`;
        io.to(otherUserRoom).emit('call:video-toggle', {
          callId,
          userId,
          isVideoEnabled
        });
      }

      if (callback) {
        callback({ status: 'success' });
      }

    } catch (error) {
      console.error('❌ Video toggle error:', error.message);
      if (callback) {
        callback({ status: 'error', error: error.message });
      }
    }
  });

  // ============ RECONNECTION ============

  socket.on('call:reconnecting', async (data) => {
    try {
      const { callId } = data;

      if (!callId) return;

      console.log(`🔄 Call reconnecting: ${callId} by ${userId}`);

      const call = await Call.findById(callId);

      if (!call || call.status !== 'active') return;

      // Verify user is a participant
      const isParticipant = call.participants.some(
        id => id.toString() === userId
      );
      if (!isParticipant) {
        throw new Error('Not authorized for this call');
      }

      // Notify other participant
      const otherUserId = call.participants.find(
        id => id.toString() !== userId
      );

      if (otherUserId) {
        io.to(`user_${otherUserId.toString()}`).emit('call:peer-reconnecting', {
          callId,
          userId
        });
      }

    } catch (error) {
      console.error('❌ Reconnecting event error:', error.message);
    }
  });

  socket.on('call:reconnected', async (data) => {
    try {
      const { callId } = data;

      if (!callId) return;

      console.log(`✅ Call reconnected: ${callId} by ${userId}`);

      const call = await Call.findById(callId);

      if (!call || call.status !== 'active') return;

      // Verify user is a participant
      const isParticipant = call.participants.some(
        id => id.toString() === userId
      );
      if (!isParticipant) {
        throw new Error('Not authorized for this call');
      }

      // Notify other participant
      const otherUserId = call.participants.find(
        id => id.toString() !== userId
      );

      if (otherUserId) {
        io.to(`user_${otherUserId.toString()}`).emit('call:peer-reconnected', {
          callId,
          userId
        });
      }

    } catch (error) {
      console.error('❌ Reconnected event error:', error.message);
    }
  });

  socket.on('call:failed', async (data, callback) => {
    try {
      const { callId, reason } = data;

      if (!callId) {
        throw new Error('Call ID is required');
      }

      console.log(`❌ Call failed: ${callId} - ${reason || 'unknown'}`);

      const call = await Call.findById(callId);

      if (!call) {
        throw new Error('Call not found');
      }

      // Verify user is a participant
      const isParticipant = call.participants.some(
        id => id.toString() === userId
      );
      if (!isParticipant) {
        throw new Error('Not authorized for this call');
      }

      call.status = 'failed';
      call.endTime = new Date();
      call.endReason = 'failed';
      await call.save();

      activeCalls.delete(callId);

      // Clear timeout if exists
      const timeoutId = callTimeouts.get(callId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        callTimeouts.delete(callId);
      }

      // Notify other participant
      const otherUserId = call.participants.find(
        id => id.toString() !== userId
      );

      if (otherUserId) {
        io.to(`user_${otherUserId.toString()}`).emit('call:failed', {
          callId,
          reason: reason || 'Connection failed'
        });
      }

      if (callback) {
        callback({ status: 'success' });
      }

    } catch (error) {
      console.error('❌ Call failed error:', error.message);
      if (callback) {
        callback({ status: 'error', error: error.message });
      }
    }
  });

  // ============ CALL MISSED ============
  
  socket.on('call:missed', async (data) => {
    try {
      const { callId } = data;
      
      if (!callId) return;
      
      const call = await Call.findById(callId);
      
      if (!call || call.status !== 'ringing') return;
      
      call.status = 'missed';
      call.endTime = new Date();
      call.endReason = 'missed';
      await call.save();

      activeCalls.delete(callId);

      console.log(`📵 Call missed: ${callId}`);
      
    } catch (error) {
      console.error('❌ Call missed error:', error);
    }
  });
  
  // ============ CALL CLEANUP ON DISCONNECT ============
  
  const originalDisconnect = socket.disconnect;
  socket.disconnect = function(...args) {
    // End any active calls for this user
    for (const [callId, callData] of activeCalls.entries()) {
      if (callData.participants.includes(userId)) {
        // Clear timeout if exists
        const timeoutId = callTimeouts.get(callId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          callTimeouts.delete(callId);
        }

        // End the call
        Call.findByIdAndUpdate(callId, {
          status: 'ended',
          endTime: new Date(),
          endReason: 'disconnect'
        }).catch(err => console.error('Error ending call on disconnect:', err));
        
        // Notify other participant
        const otherUserId = callData.participants.find(id => id !== userId);
        if (otherUserId) {
          io.to(`user_${otherUserId}`).emit('call:ended', {
            callId,
            endedBy: userId,
            reason: 'disconnect'
          });
        }
        
        activeCalls.delete(callId);
        console.log(`📞 Auto-ended call ${callId} due to disconnect`);
      }
    }
    
    return originalDisconnect.apply(this, args);
  };
};

/**
 * Get active calls info (for debugging)
 */
const getActiveCallsInfo = () => {
  return {
    totalCalls: activeCalls.size,
    calls: Array.from(activeCalls.entries()).map(([id, data]) => ({
      callId: id,
      ...data
    }))
  };
};

module.exports = {
  registerCallHandlers,
  getActiveCallsInfo
};