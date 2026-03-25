# Voice & Video Calls - Complete Backend Reference

Your backend has **comprehensive voice/video call infrastructure already implemented**. This document provides a complete reference for the Flutter frontend integration.

---

## Status: 95% Complete

| Feature | Status |
|---------|--------|
| 1-on-1 Audio Calls | ✅ Complete |
| 1-on-1 Video Calls | ✅ Complete |
| Voice Rooms (Group Audio) | ✅ Complete |
| Call History | ✅ Complete |
| Missed Calls | ✅ Complete |
| Push Notifications | ✅ Complete |
| WebRTC Signaling | ✅ Complete |
| TURN/STUN Servers | ✅ Complete (Xirsys) |

---

## Architecture Overview

```
Flutter App (WebRTC Client)
         │
         ▼
┌─────────────────────────────────────┐
│   Socket.IO (Signaling Server)      │
│   ├── callHandler.js                │
│   └── voiceRoomHandler.js           │
├─────────────────────────────────────┤
│   REST API                          │
│   ├── GET /api/v1/calls             │
│   ├── GET /api/v1/calls/ice-servers │
│   └── /api/v1/voicerooms/*          │
├─────────────────────────────────────┤
│   MongoDB                           │
│   ├── Call (history)                │
│   └── VoiceRoom (group rooms)       │
└─────────────────────────────────────┘
         │
         ▼
    Xirsys (TURN/STUN)  ←──→  WebRTC P2P (Media)
```

**Key Design**: Media flows peer-to-peer (P2P), your server only handles signaling. This provides low latency, high privacy, and scalability.

---

## 1-on-1 Calls

### Socket Events (Client → Server)

#### `call:initiate`
Start a call with another user.

```dart
socket.emitWithAck('call:initiate', {
  'targetUserId': 'user123',
  'callType': 'audio'  // or 'video'
}, (response) {
  if (response['status'] == 'success') {
    final callId = response['callId'];
    final iceServers = response['iceServers'];
    // Initialize WebRTC with iceServers
  }
});
```

#### `call:answer`
Accept or reject an incoming call.

```dart
socket.emitWithAck('call:answer', {
  'callId': 'call123',
  'accept': true  // or false to reject
}, (response) {
  // Call accepted/rejected
});
```

#### `call:offer`
Send WebRTC offer (after call is accepted).

```dart
socket.emit('call:offer', {
  'callId': 'call123',
  'targetUserId': 'user456',
  'offer': rtcOffer.toMap()  // RTCSessionDescription
});
```

#### `call:answer-sdp`
Send WebRTC answer.

```dart
socket.emit('call:answer-sdp', {
  'callId': 'call123',
  'targetUserId': 'user456',
  'answer': rtcAnswer.toMap()
});
```

#### `call:ice-candidate`
Send ICE candidate.

```dart
socket.emit('call:ice-candidate', {
  'callId': 'call123',
  'targetUserId': 'user456',
  'candidate': candidate.toMap()
});
```

#### `call:end`
End the call.

```dart
socket.emitWithAck('call:end', {
  'callId': 'call123'
}, (response) {
  final duration = response['duration'];
});
```

#### `call:mute`
Toggle audio mute.

```dart
socket.emit('call:mute', {
  'callId': 'call123',
  'isMuted': true
});
```

#### `call:video-toggle`
Toggle video on/off.

```dart
socket.emit('call:video-toggle', {
  'callId': 'call123',
  'isVideoEnabled': false
});
```

#### `call:reconnecting` / `call:reconnected`
Notify about connection issues.

```dart
socket.emit('call:reconnecting', {'callId': 'call123'});
// After reconnected:
socket.emit('call:reconnected', {'callId': 'call123'});
```

#### `call:failed`
Report connection failure.

```dart
socket.emit('call:failed', {
  'callId': 'call123',
  'reason': 'ICE connection failed'
});
```

---

### Socket Events (Server → Client)

| Event | Description | Payload |
|-------|-------------|---------|
| `call:incoming` | Someone is calling you | `{ callId, caller: {_id, name, profilePicture}, callType, iceServers }` |
| `call:accepted` | Your call was accepted | `{ callId, acceptedBy }` |
| `call:rejected` | Your call was rejected | `{ callId, rejectedBy }` |
| `call:start` | WebRTC negotiation can begin | `{ callId }` |
| `call:offer` | Received WebRTC offer | `{ callId, fromUserId, offer }` |
| `call:answer-sdp` | Received WebRTC answer | `{ callId, fromUserId, answer }` |
| `call:ice-candidate` | Received ICE candidate | `{ callId, fromUserId, candidate }` |
| `call:ended` | Call ended | `{ callId, endedBy, duration }` |
| `call:mute` | Other user muted/unmuted | `{ callId, userId, isMuted }` |
| `call:video-toggle` | Other user toggled video | `{ callId, userId, isVideoEnabled }` |
| `call:timeout` | Call wasn't answered (60s) | `{ callId, reason }` |
| `call:missed` | You missed a call | `{ callId, caller }` |
| `call:peer-reconnecting` | Other user reconnecting | `{ callId, userId }` |
| `call:peer-reconnected` | Other user reconnected | `{ callId, userId }` |
| `call:failed` | Call connection failed | `{ callId, reason }` |

---

### REST API Endpoints

#### Get Call History
```
GET /api/v1/calls?page=1&limit=20
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "_id": "call123",
      "participants": [
        { "_id": "user1", "name": "John", "profilePicture": "..." },
        { "_id": "user2", "name": "Jane", "profilePicture": "..." }
      ],
      "type": "video",
      "status": "ended",
      "duration": 120,
      "initiator": "user1",
      "startTime": "2024-03-24T10:00:00Z",
      "endTime": "2024-03-24T10:02:00Z"
    }
  ],
  "pagination": { "page": 1, "totalPages": 5 }
}
```

#### Get Missed Calls Count
```
GET /api/v1/calls/missed/count
Authorization: Bearer <token>

Response:
{
  "success": true,
  "count": 3
}
```

#### Get ICE Servers
```
GET /api/v1/calls/ice-servers
Authorization: Bearer <token>

Response:
{
  "success": true,
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "turn:...", "username": "...", "credential": "..." }
  ]
}
```

#### Get Call Details
```
GET /api/v1/calls/:id
Authorization: Bearer <token>
```

---

## Voice Rooms (Group Audio)

### REST API Endpoints

#### List Active Rooms
```
GET /api/v1/voicerooms?language=en&topic=casual
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "_id": "room123",
      "title": "English Practice",
      "topic": "casual",
      "language": "en",
      "host": { "_id": "user1", "name": "John" },
      "participantCount": 5,
      "maxParticipants": 10,
      "status": "active"
    }
  ]
}
```

#### Create Room
```
POST /api/v1/voicerooms
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "English Conversation",
  "topic": "casual",
  "language": "en",
  "maxParticipants": 10,
  "settings": {
    "allowRaiseHand": true,
    "allowChat": true
  }
}

Response:
{
  "success": true,
  "data": { "_id": "room123", ... }
}
```

#### Join Room (REST)
```
POST /api/v1/voicerooms/:id/join
Authorization: Bearer <token>
```

#### Leave Room (REST)
```
POST /api/v1/voicerooms/:id/leave
Authorization: Bearer <token>
```

#### End Room (Host Only)
```
POST /api/v1/voicerooms/:id/end
Authorization: Bearer <token>
```

#### Promote to Co-Host
```
PUT /api/v1/voicerooms/:id/promote/:userId
Authorization: Bearer <token>
```

---

### Socket Events (Client → Server)

#### `voiceroom:join`
Join a room's real-time channel.

```dart
socket.emit('voiceroom:join', {'roomId': 'room123'});

socket.on('voiceroom:joined', (data) {
  final participants = data['participants'];
  final iceServers = data['iceServers'];
  // Initialize WebRTC mesh with all participants
});
```

#### `voiceroom:leave`
Leave the room.

```dart
socket.emit('voiceroom:leave', {'roomId': 'room123'});
```

#### `voiceroom:speaking`
Indicate voice activity.

```dart
socket.emit('voiceroom:speaking', {
  'roomId': 'room123',
  'isSpeaking': true
});
```

#### `voiceroom:mute`
Toggle mute status.

```dart
socket.emit('voiceroom:mute', {
  'roomId': 'room123',
  'isMuted': true
});
```

#### `voiceroom:raise_hand`
Request to speak.

```dart
socket.emit('voiceroom:raise_hand', {'roomId': 'room123'});
```

#### `voiceroom:chat`
Send in-room chat message.

```dart
socket.emit('voiceroom:chat', {
  'roomId': 'room123',
  'message': 'Hello everyone!'
});
```

#### WebRTC Signaling (Mesh Topology)
For voice rooms, you need to establish P2P connections with ALL other participants:

```dart
// Send offer to specific user
socket.emit('voiceroom:rtc_offer', {
  'roomId': 'room123',
  'targetUserId': 'user456',
  'offer': rtcOffer.toMap()
});

// Send answer to specific user
socket.emit('voiceroom:rtc_answer', {
  'roomId': 'room123',
  'targetUserId': 'user456',
  'answer': rtcAnswer.toMap()
});

// Send ICE candidate to specific user
socket.emit('voiceroom:ice_candidate', {
  'roomId': 'room123',
  'targetUserId': 'user456',
  'candidate': candidate.toMap()
});
```

---

### Socket Events (Server → Client)

| Event | Description | Payload |
|-------|-------------|---------|
| `voiceroom:joined` | Successfully joined room | `{ roomId, participants, iceServers }` |
| `voiceroom:user_joined` | New user joined | `{ roomId, user, participantCount }` |
| `voiceroom:user_left` | User left | `{ roomId, userId, roomEnded }` |
| `voiceroom:speaking` | User speaking status | `{ roomId, userId, isSpeaking }` |
| `voiceroom:mute` | User mute status | `{ roomId, userId, isMuted }` |
| `voiceroom:hand_raised` | User raised hand | `{ roomId, user }` |
| `voiceroom:chat` | Chat message | `{ roomId, message, user, timestamp }` |
| `voiceroom:rtc_offer` | WebRTC offer received | `{ roomId, fromUserId, offer }` |
| `voiceroom:rtc_answer` | WebRTC answer received | `{ roomId, fromUserId, answer }` |
| `voiceroom:ice_candidate` | ICE candidate received | `{ roomId, fromUserId, candidate }` |
| `voiceroom:ended` | Room ended by host | `{ roomId }` |
| `voiceroom:error` | Error occurred | `{ message }` |

---

## Flutter Implementation Guide

### Dependencies

```yaml
dependencies:
  flutter_webrtc: ^0.9.47
  socket_io_client: ^2.0.3+1
  permission_handler: ^11.0.1
```

### Call Service Example

```dart
class CallService {
  final socket = io('https://your-api.com',
    OptionBuilder()
      .setTransports(['websocket'])
      .setAuth({'token': authToken})
      .build()
  );

  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;

  /// Initialize WebRTC
  Future<void> initWebRTC(List<dynamic> iceServers) async {
    final config = {
      'iceServers': iceServers,
      'sdpSemantics': 'unified-plan',
    };

    _peerConnection = await createPeerConnection(config);

    // Handle ICE candidates
    _peerConnection!.onIceCandidate = (candidate) {
      if (candidate != null) {
        socket.emit('call:ice-candidate', {
          'callId': currentCallId,
          'targetUserId': targetUserId,
          'candidate': candidate.toMap(),
        });
      }
    };

    // Handle remote stream
    _peerConnection!.onTrack = (event) {
      if (event.streams.isNotEmpty) {
        onRemoteStream?.call(event.streams[0]);
      }
    };
  }

  /// Start outgoing call
  Future<void> startCall(String targetUserId, String callType) async {
    socket.emitWithAck('call:initiate', {
      'targetUserId': targetUserId,
      'callType': callType,
    }, (response) async {
      if (response['status'] == 'success') {
        await initWebRTC(response['iceServers']);
        currentCallId = response['callId'];
        this.targetUserId = targetUserId;
      }
    });
  }

  /// Handle incoming call
  void setupIncomingCallListener() {
    socket.on('call:incoming', (data) async {
      final callId = data['callId'];
      final caller = data['caller'];
      final callType = data['callType'];
      final iceServers = data['iceServers'];

      // Show incoming call UI
      showIncomingCallUI(caller, callType, () async {
        // Accept call
        await initWebRTC(iceServers);
        currentCallId = callId;
        targetUserId = caller['_id'];

        socket.emitWithAck('call:answer', {
          'callId': callId,
          'accept': true,
        }, (response) {});
      });
    });

    socket.on('call:start', (data) async {
      // Create and send offer
      await _createOffer();
    });

    socket.on('call:offer', (data) async {
      // Set remote description and create answer
      await _handleOffer(data);
    });

    socket.on('call:answer-sdp', (data) async {
      // Set remote description
      await _handleAnswer(data);
    });

    socket.on('call:ice-candidate', (data) async {
      // Add ICE candidate
      await _handleIceCandidate(data);
    });
  }

  Future<void> _createOffer() async {
    // Add local stream
    _localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': callType == 'video',
    });

    _localStream!.getTracks().forEach((track) {
      _peerConnection!.addTrack(track, _localStream!);
    });

    final offer = await _peerConnection!.createOffer();
    await _peerConnection!.setLocalDescription(offer);

    socket.emit('call:offer', {
      'callId': currentCallId,
      'targetUserId': targetUserId,
      'offer': offer.toMap(),
    });
  }

  Future<void> _handleOffer(Map data) async {
    final offer = RTCSessionDescription(
      data['offer']['sdp'],
      data['offer']['type'],
    );
    await _peerConnection!.setRemoteDescription(offer);

    // Add local stream
    _localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': callType == 'video',
    });

    _localStream!.getTracks().forEach((track) {
      _peerConnection!.addTrack(track, _localStream!);
    });

    final answer = await _peerConnection!.createAnswer();
    await _peerConnection!.setLocalDescription(answer);

    socket.emit('call:answer-sdp', {
      'callId': currentCallId,
      'targetUserId': data['fromUserId'],
      'answer': answer.toMap(),
    });
  }

  /// End call
  void endCall() {
    socket.emit('call:end', {'callId': currentCallId});
    _cleanup();
  }

  void _cleanup() {
    _localStream?.dispose();
    _peerConnection?.close();
    _localStream = null;
    _peerConnection = null;
  }
}
```

---

## Environment Variables Required

```env
# Option 1: Self-hosted Coturn (FREE - recommended)
TURN_SERVER=turn:api.yourdomain.com:3478
TURN_USERNAME=bananatalk
TURN_PASSWORD=your_secure_password

# Option 2: Xirsys (paid service - alternative)
# XIRSYS_IDENT=your_xirsys_username
# XIRSYS_SECRET=your_xirsys_api_key
# XIRSYS_CHANNEL=bananatalk

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=your_project
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

**Priority**: Self-hosted Coturn > Xirsys > STUN-only fallback

**Note**: Without TURN, ~20% of calls will fail (users behind strict NAT). Self-hosted Coturn is free and provides ~99% success rate.

---

## Call Flow Diagrams

### Outgoing Call Flow
```
Caller                    Server                    Recipient
  │                         │                          │
  │──call:initiate─────────►│                          │
  │                         │──call:incoming──────────►│
  │                         │   (+ FCM push)           │
  │◄─callback(callId,ice)───│                          │
  │                         │                          │
  │        [60 second timeout starts]                  │
  │                         │                          │
  │                         │◄─call:answer(accept)─────│
  │◄─call:accepted──────────│                          │
  │◄─call:start─────────────│──call:start─────────────►│
  │                         │                          │
  │──call:offer────────────►│──voiceroom:rtc_offer────►│
  │                         │◄─voiceroom:rtc_answer────│
  │◄─call:answer-sdp────────│                          │
  │                         │                          │
  │◄─────────────[P2P Media via WebRTC]────────────────│
```

### Voice Room Flow
```
User                       Server                   Other Users
  │                          │                          │
  │──POST /voicerooms/join──►│                          │
  │◄─200 OK─────────────────│                          │
  │                          │                          │
  │──voiceroom:join─────────►│                          │
  │                          │──voiceroom:user_joined──►│
  │◄─voiceroom:joined────────│                          │
  │   (participants, ice)    │                          │
  │                          │                          │
  │  [For each existing participant:]                   │
  │──voiceroom:rtc_offer────►│──voiceroom:rtc_offer────►│
  │                          │◄─voiceroom:rtc_answer────│
  │◄─voiceroom:rtc_answer────│                          │
  │                          │                          │
  │◄─────────[P2P Mesh Audio via WebRTC]───────────────│
```

---

## Testing Checklist

- [ ] Set XIRSYS_IDENT and XIRSYS_SECRET in environment
- [ ] Verify ICE servers are returned from `/api/v1/calls/ice-servers`
- [ ] Test audio call between two devices
- [ ] Test video call between two devices
- [ ] Test call rejection
- [ ] Test call timeout (wait 60 seconds)
- [ ] Test mute/unmute during call
- [ ] Test video toggle during call
- [ ] Test call history retrieval
- [ ] Test missed calls count
- [ ] Test voice room creation
- [ ] Test joining voice room with multiple users
- [ ] Test voice room chat
- [ ] Test raise hand feature
- [ ] Verify push notifications for incoming calls

---

## Limitations & Notes

1. **Voice Rooms use Mesh Topology**: Each participant connects to every other participant. This works well for up to ~8 participants. For larger rooms, consider implementing an SFU (Selective Forwarding Unit).

2. **Call Timeout**: Unanswered calls automatically time out after 60 seconds.

3. **Block List**: Users on each other's block list cannot call each other.

4. **Offline Users**: Cannot initiate calls to offline users - check online status first.

5. **Single Active Call**: A user can only be in one call at a time.
