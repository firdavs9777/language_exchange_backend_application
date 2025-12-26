const Call = require('../models/Call');
const User = require('../models/User');

// Track active calls (callId -> { participants, status })
const activeCalls = new Map();

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
      const caller = await User.findById(userId).select('name profilePicture');
      const recipient = await User.findById(targetUserId).select('name profilePicture');
      
      if (!caller || !recipient) {
        throw new Error('User not found');
      }
      
      // Check if recipient is online
      const recipientRoom = `user_${targetUserId}`;
      const recipientSockets = await io.in(recipientRoom).fetchSockets();
      
      if (recipientSockets.length === 0) {
        return callback({
          status: 'error',
          error: 'User is offline'
        });
      }
      
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
      
      // Track active call
      activeCalls.set(call._id.toString(), {
        participants: [userId, targetUserId],
        status: 'ringing',
        type: callType
      });
      
      // Notify recipient
      io.to(recipientRoom).emit('call:incoming', {
        callId: call._id,
        caller: {
          _id: caller._id,
          name: caller.name,
          profilePicture: caller.profilePicture
        },
        callType: callType
      });
      
      // Confirm to caller
      if (callback) {
        callback({
          status: 'success',
          callId: call._id,
          recipient: {
            _id: recipient._id,
            name: recipient.name,
            profilePicture: recipient.profilePicture
          }
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
        // Reject call
        call.status = 'rejected';
        call.endTime = new Date();
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
      
      call.status = 'ended';
      call.endTime = new Date();
      call.duration = Math.floor((call.endTime - call.startTime) / 1000);
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
  
  // ============ CALL MISSED ============
  
  socket.on('call:missed', async (data) => {
    try {
      const { callId } = data;
      
      if (!callId) return;
      
      const call = await Call.findById(callId);
      
      if (!call || call.status !== 'ringing') return;
      
      call.status = 'missed';
      call.endTime = new Date();
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
        // End the call
        Call.findByIdAndUpdate(callId, {
          status: 'ended',
          endTime: new Date()
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