# Video & Voice Call Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement complete video/voice calling with 1-on-1 calls and voice rooms using WebRTC + Xirsys TURN.

**Architecture:** Socket.IO for signaling, WebRTC for peer-to-peer media, Xirsys for TURN/STUN servers, mesh topology for voice rooms.

**Tech Stack:** Node.js, Express, Socket.IO, MongoDB/Mongoose, Xirsys API, FCM for notifications.

---

## Current State Analysis

**Already implemented:**
- `socket/callHandler.js` - Basic call signaling (initiate, answer, offer/answer/ICE)
- `socket/voiceRoomHandler.js` - Basic room events (join, leave, mute, speaking)
- `models/Call.js` - Basic schema (participants, type, status, duration)
- `models/VoiceRoom.js` - Comprehensive schema with methods
- `routes/voiceRooms.js` + `controllers/voiceRooms.js` - Full REST API

**Need to create:**
- `config/xirsys.js` - Xirsys configuration
- `services/callService.js` - Call logic + ICE server fetching
- `routes/calls.js` - Call history endpoints
- `controllers/callController.js` - Call history controller

**Need to enhance:**
- `callHandler.js` - ICE servers, mute/video toggle, timeout, reconnection
- `voiceRoomHandler.js` - Targeted signaling (fix broadcast bug)
- `models/Call.js` - Add endReason field

---

## Task 1: Xirsys Configuration

**Files:**
- Create: `config/xirsys.js`
- Modify: `config/config.env` (add environment variables)

**Step 1: Add environment variables to config.env**

Add these lines to `config/config.env`:

```env
# Xirsys TURN/STUN Configuration
XIRSYS_IDENT=your_xirsys_username
XIRSYS_SECRET=your_xirsys_secret
XIRSYS_CHANNEL=banatalk
```

**Step 2: Create Xirsys configuration file**

Create `config/xirsys.js`:

```javascript
/**
 * Xirsys TURN/STUN Configuration
 * https://xirsys.com
 */

const axios = require('axios');

const XIRSYS_API_URL = 'https://global.xirsys.net';

/**
 * Fetch ICE servers from Xirsys
 * Returns STUN and TURN server credentials
 */
const getIceServers = async () => {
  try {
    const channel = process.env.XIRSYS_CHANNEL || 'default';

    const response = await axios.put(
      `${XIRSYS_API_URL}/_turn/${channel}`,
      {},
      {
        auth: {
          username: process.env.XIRSYS_IDENT,
          password: process.env.XIRSYS_SECRET
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.v && response.data.v.iceServers) {
      console.log('✅ Fetched ICE servers from Xirsys');
      return response.data.v.iceServers;
    }

    throw new Error('Invalid Xirsys response');
  } catch (error) {
    console.error('❌ Failed to fetch ICE servers:', error.message);

    // Fallback to free STUN servers
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }
};

/**
 * Validate Xirsys configuration
 */
const validateConfig = () => {
  const required = ['XIRSYS_IDENT', 'XIRSYS_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`⚠️ Missing Xirsys config: ${missing.join(', ')}. Using fallback STUN servers.`);
    return false;
  }
  return true;
};

module.exports = {
  getIceServers,
  validateConfig
};
```

**Step 3: Verify the file was created**

Run: `node -e "require('./config/xirsys'); console.log('✅ Xirsys config loaded')"`

Expected: `✅ Xirsys config loaded`

**Step 4: Commit**

```bash
git add config/xirsys.js
git commit -m "feat(calls): add Xirsys TURN/STUN configuration

- Add getIceServers() to fetch credentials from Xirsys API
- Add fallback to free Google STUN servers
- Add validateConfig() for startup checks

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Call Service

**Files:**
- Create: `services/callService.js`

**Step 1: Create the call service**

Create `services/callService.js`:

```javascript
/**
 * Call Service
 * Handles call business logic and Xirsys integration
 */

const Call = require('../models/Call');
const { getIceServers } = require('../config/xirsys');

// Cache ICE servers for 5 minutes to reduce API calls
let cachedIceServers = null;
let cacheExpiry = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get ICE servers (cached)
 */
const getCachedIceServers = async () => {
  const now = Date.now();

  if (cachedIceServers && now < cacheExpiry) {
    return cachedIceServers;
  }

  cachedIceServers = await getIceServers();
  cacheExpiry = now + CACHE_DURATION;

  return cachedIceServers;
};

/**
 * Create a new call record
 */
const createCall = async (callerId, receiverId, type) => {
  return Call.create({
    participants: [callerId, receiverId],
    initiator: callerId,
    type,
    status: 'ringing',
    startTime: new Date()
  });
};

/**
 * Update call status
 */
const updateCallStatus = async (callId, status, extras = {}) => {
  const update = { status, ...extras };

  if (status === 'active') {
    update.answeredAt = new Date();
  }

  if (['ended', 'missed', 'rejected', 'failed'].includes(status)) {
    update.endTime = new Date();

    // Calculate duration if call was answered
    const call = await Call.findById(callId);
    if (call && call.answeredAt) {
      update.duration = Math.floor((new Date() - call.answeredAt) / 1000);
    }
  }

  return Call.findByIdAndUpdate(callId, update, { new: true });
};

/**
 * Get call history for a user
 */
const getCallHistory = async (userId, options = {}) => {
  const { page = 1, limit = 20, type } = options;
  const skip = (page - 1) * limit;

  const filter = {
    participants: userId,
    status: { $in: ['ended', 'missed', 'rejected'] }
  };

  if (type && ['audio', 'video'].includes(type)) {
    filter.type = type;
  }

  const [calls, total] = await Promise.all([
    Call.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('participants', 'name profilePicture')
      .populate('initiator', 'name profilePicture')
      .lean(),
    Call.countDocuments(filter)
  ]);

  return {
    calls,
    pagination: {
      total,
      page,
      limit,
      hasMore: skip + calls.length < total
    }
  };
};

/**
 * Get missed calls count for a user
 */
const getMissedCallsCount = async (userId, since = null) => {
  const filter = {
    participants: userId,
    initiator: { $ne: userId }, // They didn't initiate
    status: 'missed'
  };

  if (since) {
    filter.createdAt = { $gte: since };
  }

  return Call.countDocuments(filter);
};

/**
 * Check if user is currently in a call
 */
const isUserInCall = async (userId) => {
  const activeCall = await Call.findOne({
    participants: userId,
    status: { $in: ['ringing', 'active'] }
  });
  return activeCall;
};

/**
 * Get a specific call
 */
const getCall = async (callId) => {
  return Call.findById(callId)
    .populate('participants', 'name profilePicture')
    .populate('initiator', 'name profilePicture');
};

module.exports = {
  getCachedIceServers,
  createCall,
  updateCallStatus,
  getCallHistory,
  getMissedCallsCount,
  isUserInCall,
  getCall
};
```

**Step 2: Verify the service loads**

Run: `node -e "require('./services/callService'); console.log('✅ Call service loaded')"`

Expected: `✅ Call service loaded`

**Step 3: Commit**

```bash
git add services/callService.js
git commit -m "feat(calls): add call service with ICE server caching

- Add getCachedIceServers() with 5-minute cache
- Add createCall(), updateCallStatus() for call lifecycle
- Add getCallHistory(), getMissedCallsCount() for history
- Add isUserInCall() to check active calls

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Update Call Model

**Files:**
- Modify: `models/Call.js`

**Step 1: Add endReason and answeredAt fields**

In `models/Call.js`, replace the schema with:

```javascript
const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  ],
  type: {
    type: String,
    enum: ['audio', 'video'],
    required: true
  },
  status: {
    type: String,
    enum: ['ringing', 'active', 'ended', 'missed', 'rejected', 'failed', 'busy'],
    default: 'ringing'
  },
  initiator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  answeredAt: {
    type: Date
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number,
    default: 0
  },
  endReason: {
    type: String,
    enum: ['completed', 'caller_ended', 'receiver_ended', 'missed', 'rejected', 'failed', 'busy', 'timeout', 'disconnect'],
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
callSchema.index({ participants: 1, createdAt: -1 });
callSchema.index({ initiator: 1, createdAt: -1 });
callSchema.index({ status: 1 });
callSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Call', callSchema);
```

**Step 2: Verify the model loads**

Run: `node -e "require('./models/Call'); console.log('✅ Call model loaded')"`

Expected: `✅ Call model loaded`

**Step 3: Commit**

```bash
git add models/Call.js
git commit -m "feat(calls): enhance Call model with endReason and answeredAt

- Add answeredAt field for duration calculation
- Add endReason enum for call end tracking
- Add 'busy', 'failed' status options
- Add additional indexes for queries

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Call Controller

**Files:**
- Create: `controllers/callController.js`

**Step 1: Create the call controller**

Create `controllers/callController.js`:

```javascript
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

  const sinceDate = since ? new Date(since) : null;
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
```

**Step 2: Verify the controller loads**

Run: `node -e "require('./controllers/callController'); console.log('✅ Call controller loaded')"`

Expected: `✅ Call controller loaded`

**Step 3: Commit**

```bash
git add controllers/callController.js
git commit -m "feat(calls): add call controller for REST endpoints

- Add getCallHistory() with pagination and direction
- Add getCall() for single call details
- Add getMissedCallsCount() with optional since param
- Add getIceServers() endpoint for WebRTC setup

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Call Routes

**Files:**
- Create: `routes/calls.js`
- Modify: `server.js` (register routes)

**Step 1: Create the call routes**

Create `routes/calls.js`:

```javascript
const express = require('express');
const router = express.Router();

const {
  getCallHistory,
  getCall,
  getMissedCallsCount,
  getIceServers
} = require('../controllers/callController');

const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/v1/calls
 * @desc    Get call history
 * @query   page, limit, type (audio|video)
 */
router.get('/', getCallHistory);

/**
 * @route   GET /api/v1/calls/ice-servers
 * @desc    Get ICE servers for WebRTC
 */
router.get('/ice-servers', getIceServers);

/**
 * @route   GET /api/v1/calls/missed/count
 * @desc    Get missed calls count
 * @query   since (ISO date string)
 */
router.get('/missed/count', getMissedCallsCount);

/**
 * @route   GET /api/v1/calls/:id
 * @desc    Get single call details
 */
router.get('/:id', getCall);

module.exports = router;
```

**Step 2: Register routes in server.js**

Find the route imports section in `server.js` and add:

```javascript
const calls = require('./routes/calls');
```

Find where routes are mounted and add:

```javascript
app.use('/api/v1/calls', calls);
```

**Step 3: Verify routes load**

Run: `node -e "require('./routes/calls'); console.log('✅ Call routes loaded')"`

Expected: `✅ Call routes loaded`

**Step 4: Commit**

```bash
git add routes/calls.js server.js
git commit -m "feat(calls): add call history REST endpoints

- GET /api/v1/calls - call history with pagination
- GET /api/v1/calls/ice-servers - WebRTC ICE servers
- GET /api/v1/calls/missed/count - missed calls count
- GET /api/v1/calls/:id - single call details
- Register routes in server.js

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Enhance Call Handler - ICE Servers

**Files:**
- Modify: `socket/callHandler.js`

**Step 1: Import call service at top of file**

Add after existing imports:

```javascript
const callService = require('../services/callService');
```

**Step 2: Modify call:initiate to include ICE servers**

Replace the `socket.on('call:initiate', ...)` handler to include ICE servers in the response:

After line `const call = await Call.create({...})` and before notifying recipient, add:

```javascript
      // Get ICE servers for WebRTC
      const iceServers = await callService.getCachedIceServers();
```

Update the callback response to include:

```javascript
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
```

Update the `call:incoming` emit to include ICE servers:

```javascript
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
```

**Step 3: Commit**

```bash
git add socket/callHandler.js
git commit -m "feat(calls): add ICE servers to call initiation

- Import callService for ICE server fetching
- Include iceServers in call:initiate callback
- Include iceServers in call:incoming event

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Enhance Call Handler - Mute/Video Toggle

**Files:**
- Modify: `socket/callHandler.js`

**Step 1: Add mute toggle event**

Add after the `call:end` handler:

```javascript
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
```

**Step 2: Add video toggle event**

Add after the mute handler:

```javascript
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
```

**Step 3: Commit**

```bash
git add socket/callHandler.js
git commit -m "feat(calls): add mute and video toggle events

- Add call:mute event for audio mute/unmute
- Add call:video-toggle event for video on/off
- Notify other participant of state changes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Enhance Call Handler - Call Timeout

**Files:**
- Modify: `socket/callHandler.js`

**Step 1: Add timeout tracking**

At the top of the file, after `const activeCalls = new Map();`, add:

```javascript
// Track call timeouts (callId -> timeoutId)
const callTimeouts = new Map();

// Call timeout duration (60 seconds)
const CALL_TIMEOUT_MS = 60 * 1000;
```

**Step 2: Set timeout when call is initiated**

In the `call:initiate` handler, after `activeCalls.set(...)`, add:

```javascript
      // Set timeout for unanswered call
      const timeoutId = setTimeout(async () => {
        const callData = activeCalls.get(call._id.toString());
        if (callData && callData.status === 'ringing') {
          // Mark as missed
          call.status = 'missed';
          call.endTime = new Date();
          call.endReason = 'timeout';
          await call.save();

          activeCalls.delete(call._id.toString());
          callTimeouts.delete(call._id.toString());

          // Notify both parties
          io.to(`user_${userId}`).emit('call:timeout', {
            callId: call._id,
            reason: 'No answer'
          });
          io.to(recipientRoom).emit('call:missed', {
            callId: call._id,
            caller: {
              _id: caller._id,
              name: caller.name,
              profilePicture: caller.profilePicture
            }
          });

          console.log(`⏰ Call timeout: ${call._id}`);
        }
      }, CALL_TIMEOUT_MS);

      callTimeouts.set(call._id.toString(), timeoutId);
```

**Step 3: Clear timeout when call is answered**

In the `call:answer` handler, at the start of `if (accept) {` block, add:

```javascript
        // Clear timeout
        const timeoutId = callTimeouts.get(callId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          callTimeouts.delete(callId);
        }
```

**Step 4: Clear timeout when call is rejected**

In the `call:answer` handler, at the start of `else {` (reject) block, add:

```javascript
        // Clear timeout
        const timeoutId = callTimeouts.get(callId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          callTimeouts.delete(callId);
        }
```

**Step 5: Clear timeout when call ends**

In the `call:end` handler, after finding the call, add:

```javascript
      // Clear timeout if exists
      const timeoutId = callTimeouts.get(callId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        callTimeouts.delete(callId);
      }
```

**Step 6: Commit**

```bash
git add socket/callHandler.js
git commit -m "feat(calls): add 60-second call timeout

- Add callTimeouts Map for timeout tracking
- Set timeout when call is initiated
- Clear timeout on answer/reject/end
- Emit call:timeout and call:missed on timeout
- Set endReason to 'timeout' for missed calls

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Enhance Call Handler - Reconnection

**Files:**
- Modify: `socket/callHandler.js`

**Step 1: Add reconnection events**

Add after the video toggle handler:

```javascript
  // ============ RECONNECTION ============

  socket.on('call:reconnecting', async (data) => {
    try {
      const { callId } = data;

      if (!callId) return;

      console.log(`🔄 Call reconnecting: ${callId} by ${userId}`);

      const call = await Call.findById(callId);

      if (!call || call.status !== 'active') return;

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
```

**Step 2: Commit**

```bash
git add socket/callHandler.js
git commit -m "feat(calls): add reconnection and failure handling

- Add call:reconnecting event to notify peer
- Add call:reconnected event when connection restored
- Add call:failed event for connection failures
- Update call status and endReason on failure

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Enhance Call Handler - FCM Notifications

**Files:**
- Modify: `socket/callHandler.js`

**Step 1: Import FCM service**

Add after existing imports:

```javascript
const { sendToUser } = require('../services/fcmService');
```

**Step 2: Send push notification for incoming call**

In `call:initiate` handler, after emitting `call:incoming`, add:

```javascript
      // Send push notification for incoming call
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
```

**Step 3: Send push notification for missed call**

In the timeout callback (Task 8), after emitting `call:missed`, add:

```javascript
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
```

**Step 4: Commit**

```bash
git add socket/callHandler.js
git commit -m "feat(calls): add FCM push notifications

- Send incoming call notification via FCM
- Send missed call notification on timeout
- Include call metadata in notification data

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Enhance Voice Room Handler - Targeted Signaling

**Files:**
- Modify: `socket/voiceRoomHandler.js`

**Step 1: Fix rtc_offer to target specific user**

Replace the `voiceroom:rtc_offer` handler:

```javascript
  /**
   * WebRTC signaling - offer (targeted to specific user)
   */
  socket.on('voiceroom:rtc_offer', (data) => {
    const { roomId, targetUserId, offer } = data;
    if (!roomId || !targetUserId || !offer) return;

    // Send only to the target user's socket in the room
    const targetRoom = `user_${targetUserId}`;
    io.to(targetRoom).emit('voiceroom:rtc_offer', {
      roomId,
      fromUserId: userId,
      offer
    });
  });
```

**Step 2: Fix rtc_answer to target specific user**

Replace the `voiceroom:rtc_answer` handler:

```javascript
  /**
   * WebRTC signaling - answer (targeted to specific user)
   */
  socket.on('voiceroom:rtc_answer', (data) => {
    const { roomId, targetUserId, answer } = data;
    if (!roomId || !targetUserId || !answer) return;

    const targetRoom = `user_${targetUserId}`;
    io.to(targetRoom).emit('voiceroom:rtc_answer', {
      roomId,
      fromUserId: userId,
      answer
    });
  });
```

**Step 3: Fix ice_candidate to target specific user**

Replace the `voiceroom:ice_candidate` handler:

```javascript
  /**
   * WebRTC signaling - ICE candidate (targeted to specific user)
   */
  socket.on('voiceroom:ice_candidate', (data) => {
    const { roomId, targetUserId, candidate } = data;
    if (!roomId || !targetUserId || !candidate) return;

    const targetRoom = `user_${targetUserId}`;
    io.to(targetRoom).emit('voiceroom:ice_candidate', {
      roomId,
      fromUserId: userId,
      candidate
    });
  });
```

**Step 4: Commit**

```bash
git add socket/voiceRoomHandler.js
git commit -m "fix(voicerooms): target WebRTC signaling to specific users

- Fix rtc_offer to emit only to target user
- Fix rtc_answer to emit only to target user
- Fix ice_candidate to emit only to target user
- Use user room instead of broadcasting to entire voice room

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Enhance Voice Room Handler - Participant List with ICE

**Files:**
- Modify: `socket/voiceRoomHandler.js`

**Step 1: Import callService at top**

Add after existing imports:

```javascript
const { getCachedIceServers } = require('../services/callService');
```

**Step 2: Include ICE servers when joining room**

In the `voiceroom:join` handler, modify the `voiceroom:joined` emit:

```javascript
      // Get ICE servers for WebRTC
      const iceServers = await getCachedIceServers();

      // Send current room state to joining user with ICE servers
      socket.emit('voiceroom:joined', {
        roomId,
        participants: room.participants,
        iceServers
      });
```

**Step 3: Include participant details in user_joined event**

In the `voiceroom:join` handler, after getting user info, update the emit to include full user data:

```javascript
      // Notify others with full participant info
      socket.to(`voiceroom_${roomId}`).emit('voiceroom:user_joined', {
        roomId,
        user: {
          _id: userId,
          name: user?.name,
          images: user?.images
        },
        participantCount: room.participants.length + 1
      });
```

**Step 4: Commit**

```bash
git add socket/voiceRoomHandler.js
git commit -m "feat(voicerooms): add ICE servers to room join

- Import callService for ICE servers
- Include iceServers in voiceroom:joined event
- Include participantCount in user_joined event

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 13: Final Integration Test

**Step 1: Verify all files exist**

Run:
```bash
ls -la config/xirsys.js services/callService.js controllers/callController.js routes/calls.js
```

Expected: All 4 files listed

**Step 2: Test server starts without errors**

Run:
```bash
node -e "
const xirsys = require('./config/xirsys');
const callService = require('./services/callService');
const callController = require('./controllers/callController');
const callRoutes = require('./routes/calls');
const callHandler = require('./socket/callHandler');
const voiceRoomHandler = require('./socket/voiceRoomHandler');
console.log('✅ All modules loaded successfully');
"
```

Expected: `✅ All modules loaded successfully`

**Step 3: Commit final integration**

```bash
git add -A
git commit -m "feat(calls): complete video/voice call implementation

Summary:
- Xirsys TURN/STUN integration with caching
- Call service with history and ICE server management
- REST API for call history (/api/v1/calls)
- Enhanced call handler with timeout, mute, video toggle
- FCM push notifications for incoming/missed calls
- Voice room targeted WebRTC signaling fix
- Voice room ICE server distribution

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Component | Action |
|------|-----------|--------|
| 1 | Xirsys Config | Create `config/xirsys.js` |
| 2 | Call Service | Create `services/callService.js` |
| 3 | Call Model | Enhance with endReason, answeredAt |
| 4 | Call Controller | Create REST endpoints |
| 5 | Call Routes | Create and register routes |
| 6 | Call Handler | Add ICE servers to initiation |
| 7 | Call Handler | Add mute/video toggle events |
| 8 | Call Handler | Add 60-second timeout |
| 9 | Call Handler | Add reconnection events |
| 10 | Call Handler | Add FCM notifications |
| 11 | Voice Room Handler | Fix targeted signaling |
| 12 | Voice Room Handler | Add ICE servers to join |
| 13 | Integration | Verify all modules |

**Total estimated tasks:** 13
**Files created:** 4
**Files modified:** 5
