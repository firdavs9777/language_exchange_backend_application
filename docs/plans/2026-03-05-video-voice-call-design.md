# Video & Voice Call System Design

**Date:** 2026-03-05
**Status:** Draft
**Approach:** Pure WebRTC + Mesh Topology

---

## Overview

Add video/voice calling capabilities to the language exchange backend:
- **1-on-1 Calls:** Audio and video calls between two users
- **Voice Rooms:** Group audio rooms supporting up to 8-10 participants

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FLUTTER APP                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Call Screen │  │ Voice Room  │  │   flutter_webrtc        │  │
│  │   (1-on-1)  │  │   Screen    │  │   (WebRTC handling)     │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          │                                       │
│                   Socket.IO Client                               │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                    Signaling Only
                    (no media)
                           │
┌──────────────────────────┼───────────────────────────────────────┐
│                    YOUR BACKEND                                   │
│  ┌───────────────────────┴────────────────────────────────────┐  │
│  │                    Socket.IO Server                         │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                  │  │
│  │  │  callHandler.js │  │ voiceRoomHandler│                  │  │
│  │  │  (enhanced)     │  │   (enhanced)    │                  │  │
│  │  └─────────────────┘  └─────────────────┘                  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Call Model    │  │ VoiceRoom Model │  │  callService.js │  │
│  │   (enhanced)    │  │   (enhanced)    │  │     (new)       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                         XIRSYS                                     │
│              TURN/STUN Servers (ICE candidates)                   │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                    WEBRTC PEER CONNECTION                          │
│         Direct P2P media stream between users                     │
│         (Audio/Video - bypasses your server)                      │
└───────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Server handles **signaling only** (call events, ICE candidates exchange)
- Actual audio/video goes **directly between users** via WebRTC
- Xirsys provides TURN/STUN servers when direct P2P fails
- Flutter uses `flutter_webrtc` package

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Signaling | Socket.IO (existing) |
| Media Transport | WebRTC (peer-to-peer) |
| TURN/STUN Provider | Xirsys |
| Frontend | Flutter + flutter_webrtc |
| Database | MongoDB (existing) |

---

## 1-on-1 Call Flow

### Initiating a Call

```
┌────────┐          ┌────────┐          ┌────────┐
│Caller  │          │ Server │          │Receiver│
└───┬────┘          └───┬────┘          └───┬────┘
    │                   │                   │
    │ call:initiate     │                   │
    │ {receiverId,type} │                   │
    │──────────────────>│                   │
    │                   │                   │
    │                   │ call:incoming     │
    │                   │ {callerId,type}   │
    │                   │──────────────────>│
    │                   │                   │
    │ call:ringing      │                   │
    │<──────────────────│                   │
    │                   │                   │
```

### Answering a Call

```
    │                   │                   │
    │                   │ call:answer       │
    │                   │<──────────────────│
    │                   │                   │
    │ call:answered     │                   │
    │<──────────────────│                   │
    │                   │                   │
    │         WebRTC Offer/Answer Exchange  │
    │<─────────────────────────────────────>│
    │                   │                   │
    │         ICE Candidates Exchange       │
    │<─────────────────────────────────────>│
    │                   │                   │
    │      P2P Media Connection Established │
    │<═════════════════════════════════════>│
```

### Ending a Call

```
    │                   │                   │
    │ call:end          │                   │
    │──────────────────>│                   │
    │                   │                   │
    │                   │ call:ended        │
    │                   │──────────────────>│
    │                   │                   │
    │      Call record saved to database    │
    │                   │                   │
```

---

## Voice Room Flow (Mesh Topology)

### Mesh Architecture for Voice Rooms

```
        User A
       /      \
      /        \
   User B ──── User C
      \        /
       \      /
        User D

Each user maintains a peer connection to every other user.
For N users: N*(N-1)/2 total connections
```

### Joining a Voice Room

```
┌────────┐          ┌────────┐          ┌────────────┐
│New User│          │ Server │          │Existing    │
│        │          │        │          │Participants│
└───┬────┘          └───┬────┘          └─────┬──────┘
    │                   │                     │
    │ voiceroom:join    │                     │
    │ {roomId}          │                     │
    │──────────────────>│                     │
    │                   │                     │
    │                   │ voiceroom:user-joined
    │                   │ {userId, existing}  │
    │                   │────────────────────>│
    │                   │                     │
    │ voiceroom:participants                  │
    │ [list of users]   │                     │
    │<──────────────────│                     │
    │                   │                     │
    │       Create peer connections to each   │
    │       existing participant              │
    │<═══════════════════════════════════════>│
```

### Voice Room Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `voiceroom:join` | Client → Server | Join a voice room |
| `voiceroom:leave` | Client → Server | Leave the room |
| `voiceroom:participants` | Server → Client | List of current participants |
| `voiceroom:user-joined` | Server → Clients | New user joined |
| `voiceroom:user-left` | Server → Clients | User left the room |
| `voiceroom:mute` | Client → Server | Toggle mute status |
| `voiceroom:user-muted` | Server → Clients | Broadcast mute status |
| `voiceroom:speaking` | Client → Server | Voice activity detection |
| `voiceroom:user-speaking` | Server → Clients | Who is currently speaking |
| `voiceroom:offer` | Client → Server → Client | WebRTC offer relay |
| `voiceroom:answer` | Client → Server → Client | WebRTC answer relay |
| `voiceroom:ice-candidate` | Client → Server → Client | ICE candidate relay |

---

## Socket Events (Complete)

### 1-on-1 Call Events

| Event | Payload | Description |
|-------|---------|-------------|
| `call:initiate` | `{receiverId, type: 'audio'|'video'}` | Start a call |
| `call:incoming` | `{callId, caller, type}` | Incoming call notification |
| `call:answer` | `{callId}` | Accept the call |
| `call:reject` | `{callId, reason?}` | Decline the call |
| `call:busy` | `{callId}` | User is on another call |
| `call:end` | `{callId}` | End the call |
| `call:ended` | `{callId, duration, reason}` | Call ended notification |
| `call:offer` | `{callId, sdp}` | WebRTC offer |
| `call:answer-sdp` | `{callId, sdp}` | WebRTC answer |
| `call:ice-candidate` | `{callId, candidate}` | ICE candidate |
| `call:mute` | `{callId, muted: bool}` | Mute/unmute audio |
| `call:video-toggle` | `{callId, enabled: bool}` | Toggle video |
| `call:failed` | `{callId, reason}` | Call connection failed |
| `call:reconnecting` | `{callId}` | Attempting to reconnect |
| `call:reconnected` | `{callId}` | Successfully reconnected |

### Voice Room Events

| Event | Payload | Description |
|-------|---------|-------------|
| `voiceroom:create` | `{name, maxParticipants?}` | Create a room |
| `voiceroom:created` | `{roomId, name}` | Room created confirmation |
| `voiceroom:join` | `{roomId}` | Join existing room |
| `voiceroom:joined` | `{roomId, participants}` | Join confirmation |
| `voiceroom:leave` | `{roomId}` | Leave the room |
| `voiceroom:left` | `{roomId}` | Leave confirmation |
| `voiceroom:user-joined` | `{roomId, user}` | Someone joined |
| `voiceroom:user-left` | `{roomId, userId}` | Someone left |
| `voiceroom:mute` | `{roomId, muted}` | Toggle mute |
| `voiceroom:user-muted` | `{roomId, userId, muted}` | Mute status broadcast |
| `voiceroom:speaking` | `{roomId, speaking}` | Voice activity |
| `voiceroom:user-speaking` | `{roomId, userId, speaking}` | Speaking broadcast |
| `voiceroom:offer` | `{roomId, targetUserId, sdp}` | WebRTC offer to specific user |
| `voiceroom:answer` | `{roomId, targetUserId, sdp}` | WebRTC answer |
| `voiceroom:ice-candidate` | `{roomId, targetUserId, candidate}` | ICE candidate |
| `voiceroom:closed` | `{roomId}` | Room was closed |
| `voiceroom:kicked` | `{roomId, userId}` | User was kicked |

---

## Database Schema

### Call Model (Enhanced)

```javascript
const CallSchema = new mongoose.Schema({
  // Participants
  caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Call details
  type: { type: String, enum: ['audio', 'video'], required: true },
  status: {
    type: String,
    enum: ['initiating', 'ringing', 'ongoing', 'ended', 'missed', 'rejected', 'failed'],
    default: 'initiating'
  },

  // Timestamps
  initiatedAt: { type: Date, default: Date.now },
  answeredAt: { type: Date },
  endedAt: { type: Date },

  // Calculated
  duration: { type: Number, default: 0 }, // seconds

  // End reason
  endReason: {
    type: String,
    enum: ['completed', 'caller_ended', 'receiver_ended', 'missed', 'rejected', 'failed', 'busy']
  },

  // Quality metrics (optional)
  quality: {
    callerRating: { type: Number, min: 1, max: 5 },
    receiverRating: { type: Number, min: 1, max: 5 }
  }
}, { timestamps: true });

// Indexes
CallSchema.index({ caller: 1, createdAt: -1 });
CallSchema.index({ receiver: 1, createdAt: -1 });
CallSchema.index({ status: 1 });
```

### VoiceRoom Model (Enhanced)

```javascript
const VoiceRoomSchema = new mongoose.Schema({
  // Room info
  name: { type: String, required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Participants
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date, default: Date.now },
    isMuted: { type: Boolean, default: false },
    isSpeaking: { type: Boolean, default: false }
  }],

  // Settings
  maxParticipants: { type: Number, default: 10, max: 10 },
  isActive: { type: Boolean, default: true },

  // Access control
  isPrivate: { type: Boolean, default: false },
  allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Timestamps
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
}, { timestamps: true });

// Indexes
VoiceRoomSchema.index({ isActive: 1 });
VoiceRoomSchema.index({ creator: 1 });
VoiceRoomSchema.index({ 'participants.user': 1 });
```

---

## Backend Components

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `services/callService.js` | Create | Call business logic, Xirsys integration |
| `services/voiceRoomService.js` | Create | Voice room business logic |
| `socket/callHandler.js` | Enhance | Complete 1-on-1 call signaling |
| `socket/voiceRoomHandler.js` | Enhance | Complete voice room signaling |
| `models/Call.js` | Enhance | Add missing fields |
| `models/VoiceRoom.js` | Enhance | Add missing fields |
| `routes/calls.js` | Create | REST endpoints for call history |
| `controllers/callController.js` | Create | Call history controller |
| `config/xirsys.js` | Create | Xirsys configuration |

### callService.js

```javascript
// services/callService.js

const axios = require('axios');
const Call = require('../models/Call');

class CallService {

  // Get ICE servers from Xirsys
  async getIceServers() {
    const response = await axios.put(
      `https://global.xirsys.net/_turn/${process.env.XIRSYS_CHANNEL}`,
      {},
      {
        auth: {
          username: process.env.XIRSYS_IDENT,
          password: process.env.XIRSYS_SECRET
        }
      }
    );
    return response.data.v.iceServers;
  }

  // Create call record
  async createCall(callerId, receiverId, type) {
    return Call.create({
      caller: callerId,
      receiver: receiverId,
      type,
      status: 'initiating'
    });
  }

  // Update call status
  async updateCallStatus(callId, status, extras = {}) {
    const update = { status, ...extras };
    if (status === 'ongoing') update.answeredAt = new Date();
    if (status === 'ended') {
      update.endedAt = new Date();
      // Calculate duration
      const call = await Call.findById(callId);
      if (call.answeredAt) {
        update.duration = Math.floor((new Date() - call.answeredAt) / 1000);
      }
    }
    return Call.findByIdAndUpdate(callId, update, { new: true });
  }

  // Get call history for user
  async getCallHistory(userId, page = 1, limit = 20) {
    return Call.find({
      $or: [{ caller: userId }, { receiver: userId }],
      status: { $in: ['ended', 'missed', 'rejected'] }
    })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('caller receiver', 'name avatar');
  }

  // Check if user is in a call
  async isUserInCall(userId) {
    const activeCall = await Call.findOne({
      $or: [{ caller: userId }, { receiver: userId }],
      status: { $in: ['initiating', 'ringing', 'ongoing'] }
    });
    return !!activeCall;
  }
}

module.exports = new CallService();
```

---

## Xirsys Configuration

### Environment Variables

```env
# Xirsys TURN/STUN Configuration
XIRSYS_IDENT=your_xirsys_username
XIRSYS_SECRET=your_xirsys_secret
XIRSYS_CHANNEL=your_channel_name
```

### Getting ICE Servers

The backend fetches ICE servers from Xirsys and sends them to clients before establishing WebRTC connections:

```javascript
// Client receives ICE servers when initiating/answering call
{
  "iceServers": [
    { "urls": "stun:stun.xirsys.com" },
    {
      "urls": "turn:turn.xirsys.com:80?transport=udp",
      "username": "temporary_username",
      "credential": "temporary_credential"
    },
    {
      "urls": "turn:turn.xirsys.com:443?transport=tcp",
      "username": "temporary_username",
      "credential": "temporary_credential"
    }
  ]
}
```

---

## REST API Endpoints

### Call History

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calls` | Get call history (paginated) |
| GET | `/api/calls/:id` | Get specific call details |
| GET | `/api/calls/missed` | Get missed calls count |
| POST | `/api/calls/:id/rate` | Rate call quality |

### Voice Rooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/voice-rooms` | List active voice rooms |
| GET | `/api/voice-rooms/:id` | Get room details |
| POST | `/api/voice-rooms` | Create a voice room |
| DELETE | `/api/voice-rooms/:id` | Close a voice room (creator only) |

---

## Push Notifications

### Incoming Call Notification

```javascript
{
  notification: {
    title: "Incoming Video Call",
    body: "John is calling you..."
  },
  data: {
    type: "incoming_call",
    callId: "abc123",
    callerId: "user123",
    callerName: "John",
    callerAvatar: "https://...",
    callType: "video"
  },
  android: {
    priority: "high",
    ttl: 30000 // 30 seconds
  },
  apns: {
    headers: {
      "apns-priority": "10"
    },
    payload: {
      aps: {
        sound: "ringtone.caf",
        category: "INCOMING_CALL"
      }
    }
  }
}
```

### Missed Call Notification

```javascript
{
  notification: {
    title: "Missed Call",
    body: "You missed a call from John"
  },
  data: {
    type: "missed_call",
    callId: "abc123",
    callerId: "user123"
  }
}
```

---

## Error Handling

### Call Errors

| Error Code | Description | Action |
|------------|-------------|--------|
| `USER_OFFLINE` | Receiver is not connected | Show "User offline" message |
| `USER_BUSY` | Receiver is on another call | Show "User is busy" |
| `CALL_TIMEOUT` | No answer within 60 seconds | Mark as missed call |
| `CONNECTION_FAILED` | WebRTC connection failed | Retry or show error |
| `PERMISSION_DENIED` | No camera/mic permission | Prompt for permissions |

### Voice Room Errors

| Error Code | Description | Action |
|------------|-------------|--------|
| `ROOM_FULL` | Max participants reached | Show "Room is full" |
| `ROOM_NOT_FOUND` | Room doesn't exist | Show error |
| `NOT_ALLOWED` | Private room, user not invited | Show "Access denied" |
| `ALREADY_IN_ROOM` | User already in a room | Leave current room first |

---

## Flutter Integration Notes

### Required Packages

```yaml
dependencies:
  flutter_webrtc: ^0.9.x
  socket_io_client: ^2.x.x
  permission_handler: ^11.x.x
```

### Key Implementation Points

1. **Request permissions** before initiating calls (camera, microphone)
2. **Handle incoming calls** even when app is in background (FCM data message)
3. **Implement CallKit** (iOS) / **ConnectionService** (Android) for native call UI
4. **Voice Activity Detection** for speaking indicators in voice rooms
5. **Handle network changes** gracefully (WiFi ↔ cellular)

---

## Security Considerations

1. **Validate call participants** - Only allow calls between users who can message each other
2. **Validate room access** - Check if user is allowed in private rooms
3. **Rate limit** call initiations to prevent spam
4. **Timeout** unanswered calls after 60 seconds
5. **Clean up** orphaned calls/rooms periodically
6. **Validate ICE credentials** - Xirsys credentials are temporary and user-specific

---

## Future Enhancements (Out of Scope)

- Call recording
- Screen sharing
- Video rooms (would need SFU for > 4 participants)
- Background audio mode
- Bluetooth device support
- CallKit/ConnectionService integration
- Call quality metrics dashboard
