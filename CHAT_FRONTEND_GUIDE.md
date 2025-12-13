# BananaTalk Chat Frontend Implementation Guide

This guide provides comprehensive documentation for implementing chat features in the frontend application.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication](#authentication)
3. [HTTP API Endpoints](#http-api-endpoints)
4. [Socket.IO Events](#socketio-events)
5. [Advanced Features](#advanced-features)
   - [Voice Messages](#voice-messages)
   - [Message Corrections (HelloTalk Style)](#message-corrections-hellotalk-style)
   - [Disappearing Messages](#disappearing-messages)
   - [Polls](#polls)
   - [Mentions](#mentions)
   - [Bookmarks](#bookmarks)
   - [Secret Chat](#secret-chat)
   - [Chat Themes](#chat-themes)
   - [Nicknames](#nicknames)
   - [Quick Replies](#quick-replies)
6. [Message Schema Reference](#message-schema-reference)
7. [Code Examples](#code-examples)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)

---

## Architecture Overview

BananaTalk uses a hybrid communication approach:

- **HTTP API**: For CRUD operations, file uploads, and data fetching
- **WebSocket (Socket.IO)**: For real-time messaging, typing indicators, and presence

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend App                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐          ┌──────────────────┐            │
│   │   HTTP Client    │          │  Socket.IO Client │            │
│   │  (fetch/axios)   │          │                   │            │
│   └────────┬─────────┘          └─────────┬─────────┘            │
│            │                              │                      │
└────────────┼──────────────────────────────┼──────────────────────┘
             │                              │
             ▼                              ▼
┌────────────────────────┐    ┌────────────────────────┐
│     REST API           │    │     WebSocket          │
│  /api/v1/messages      │    │   Real-time events     │
│  /api/v1/conversations │    │   - sendMessage        │
│  /api/v1/users         │    │   - typing indicators  │
│                        │    │   - online status      │
└────────────────────────┘    └────────────────────────┘
             │                              │
             └──────────────┬───────────────┘
                            ▼
                 ┌────────────────────┐
                 │   Backend Server   │
                 │   (Express + IO)   │
                 └────────────────────┘
```

### When to Use What

| Feature | HTTP API | Socket.IO |
|---------|----------|-----------|
| Send text message | ❌ | ✅ Preferred |
| Send message with attachment | ✅ Required | ❌ |
| Fetch conversation history | ✅ Required | ❌ |
| Real-time message delivery | ❌ | ✅ Required |
| Typing indicators | ❌ | ✅ Required |
| Online/offline status | ❌ | ✅ Required |
| Mark messages as read | ✅ Available | ✅ Preferred |
| Search messages | ✅ Required | ❌ |
| Mute/archive conversations | ✅ Required | ❌ |
| Block/unblock users | ✅ Required | ❌ |

---

## Authentication

### HTTP API Authentication

All protected endpoints require a JWT token in the Authorization header:

```javascript
// Example with fetch
const response = await fetch('https://api.banatalk.com/api/v1/messages', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Example with axios
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

### Socket.IO Authentication

Socket.IO requires the token during the handshake:

```javascript
import { io } from 'socket.io-client';

const socket = io('https://api.banatalk.com', {
  auth: {
    token: 'your-jwt-token'  // Preferred method
  },
  // Alternative methods (fallbacks):
  // query: { token: 'your-jwt-token' },
  // extraHeaders: { authorization: 'Bearer your-jwt-token' }
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});
```

---

## HTTP API Endpoints

### Messages API (`/api/v1/messages`)

#### Get All Messages
```
GET /api/v1/messages
Authorization: Bearer <token>
```

#### Create Message (with optional attachment)
```
POST /api/v1/messages
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body:
- message: string (optional if attachment provided)
- receiver: string (required - user ID)
- attachment: file (optional - image/video/audio/document)
- replyTo: string (optional - message ID to reply to)
- location: object (optional - { latitude, longitude, address?, placeName? })
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "message_id",
    "sender": { "_id": "user_id", "name": "John", "images": [...] },
    "receiver": { "_id": "user_id", "name": "Jane", "images": [...] },
    "message": "Hello!",
    "media": {
      "url": "https://spaces.digitaloceanspaces.com/...",
      "type": "image",
      "fileName": "photo.jpg",
      "fileSize": 123456,
      "mimeType": "image/jpeg"
    },
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

#### Get Single Message
```
GET /api/v1/messages/:id
```

#### Get User's Messages
```
GET /api/v1/messages/user/:userId
```

#### Get Conversation Between Two Users
```
GET /api/v1/messages/conversation/:senderId/:receiverId
```

#### Search Messages
```
GET /api/v1/messages/search?q=searchterm
Authorization: Bearer <token>
```

#### Reply to Message
```
POST /api/v1/messages/:id/reply
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "message": "This is a reply",
  "receiver": "receiver_user_id"
}
```

#### Forward Message
```
POST /api/v1/messages/:id/forward
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "receiver": "new_receiver_id"
}
```

#### Edit Message
```
PUT /api/v1/messages/:id
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "message": "Updated message text"
}
```

#### Delete Message
```
DELETE /api/v1/messages/:id
Authorization: Bearer <token>
```

#### Pin Message
```
POST /api/v1/messages/:id/pin
Authorization: Bearer <token>
```

#### Add Reaction
```
POST /api/v1/messages/:id/reactions
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "emoji": "👍"
}
```

#### Remove Reaction
```
DELETE /api/v1/messages/:id/reactions/:emoji
Authorization: Bearer <token>
```

#### Get Message Reactions
```
GET /api/v1/messages/:id/reactions
Authorization: Bearer <token>
```

---

### Conversations API (`/api/v1/conversations`)

All endpoints require authentication.

#### Get All Conversations
```
GET /api/v1/conversations
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "conversation_id",
      "participants": [
        { "_id": "user1_id", "name": "John", "images": [...] },
        { "_id": "user2_id", "name": "Jane", "images": [...] }
      ],
      "lastMessage": { ... },
      "lastMessageAt": "2024-01-01T12:00:00.000Z",
      "unreadCount": [
        { "user": "user1_id", "count": 0 },
        { "user": "user2_id", "count": 3 }
      ],
      "isPinned": false,
      "isArchived": false,
      "isMuted": false
    }
  ]
}
```

#### Get Single Conversation
```
GET /api/v1/conversations/:id
Authorization: Bearer <token>
```

#### Mute Conversation
```
POST /api/v1/conversations/:id/mute
Authorization: Bearer <token>
```

#### Unmute Conversation
```
POST /api/v1/conversations/:id/unmute
Authorization: Bearer <token>
```

#### Archive Conversation
```
POST /api/v1/conversations/:id/archive
Authorization: Bearer <token>
```

#### Unarchive Conversation
```
POST /api/v1/conversations/:id/unarchive
Authorization: Bearer <token>
```

#### Pin Conversation
```
POST /api/v1/conversations/:id/pin
Authorization: Bearer <token>
```

#### Unpin Conversation
```
POST /api/v1/conversations/:id/unpin
Authorization: Bearer <token>
```

#### Mark Conversation as Read
```
PUT /api/v1/conversations/:id/read
Authorization: Bearer <token>
```

---

### User Blocking API (`/api/v1/users`)

All endpoints require authentication.

#### Block User
```
POST /api/v1/users/:userId/block
Authorization: Bearer <token>

Body (optional):
{
  "reason": "Spam or harassment"
}
```

#### Unblock User
```
DELETE /api/v1/users/:userId/block
Authorization: Bearer <token>
```

#### Get Blocked Users
```
GET /api/v1/users/:userId/blocked
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "userId": { "_id": "...", "name": "Blocked User", "images": [...] },
      "blockedAt": "2024-01-01T12:00:00.000Z",
      "reason": "Spam"
    }
  ]
}
```

#### Check Block Status
```
GET /api/v1/users/:userId/block-status/:targetUserId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isBlocked": true,
    "isBlockedBy": false,
    "canMessage": false
  }
}
```

---

## Socket.IO Events

### Connection Setup

```javascript
import { io } from 'socket.io-client';

const socket = io('https://api.banatalk.com', {
  auth: { token: 'your-jwt-token' },
  transports: ['websocket', 'polling']
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to chat server');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

### Events to Emit (Client → Server)

#### sendMessage
Send a text message to another user.

```javascript
socket.emit('sendMessage', {
  receiver: 'receiver_user_id',  // Required
  message: 'Hello!'              // Required
}, (response) => {
  // Callback with result
  if (response.status === 'success') {
    console.log('Message sent:', response.message);
    console.log('Unread count:', response.unreadCount);
  } else {
    console.error('Error:', response.error);
  }
});
```

#### markAsRead
Mark messages from a specific sender as read.

```javascript
socket.emit('markAsRead', {
  senderId: 'sender_user_id'
}, (response) => {
  if (response.status === 'success') {
    console.log('Marked', response.markedCount, 'messages as read');
  }
});
```

#### deleteMessage
Delete a message you sent.

```javascript
socket.emit('deleteMessage', {
  messageId: 'message_id'
}, (response) => {
  if (response.status === 'success') {
    console.log('Message deleted');
  }
});
```

#### typing
Notify that you're typing.

```javascript
socket.emit('typing', {
  receiver: 'receiver_user_id'
});
```

#### stopTyping
Notify that you stopped typing.

```javascript
socket.emit('stopTyping', {
  receiver: 'receiver_user_id'
});
```

#### updateStatus
Update your online status.

```javascript
socket.emit('updateStatus', {
  status: 'online'  // 'online' | 'away' | 'busy' | 'offline'
});

// Shortcuts
socket.emit('setOnline');
socket.emit('setAway');
socket.emit('setBusy');
```

#### getUserStatus
Get a specific user's online status.

```javascript
socket.emit('getUserStatus', {
  userId: 'target_user_id'
}, (response) => {
  if (response.status === 'success') {
    console.log('User status:', response.data);
    // { userId, status: 'online'|'offline', lastSeen }
  }
});
```

#### requestStatusUpdates
Get status for multiple users at once.

```javascript
socket.emit('requestStatusUpdates', {
  userIds: ['user1_id', 'user2_id', 'user3_id']
});
```

---

### Events to Listen (Server → Client)

#### newMessage
Received when someone sends you a message.

```javascript
socket.on('newMessage', (data) => {
  console.log('New message:', data.message);
  console.log('From:', data.senderId);
  console.log('Unread count:', data.unreadCount);
  
  // data.message contains the full message object
});
```

#### messageSent
Confirmation that your message was sent (for syncing across devices).

```javascript
socket.on('messageSent', (data) => {
  console.log('Message sent confirmation:', data.message);
  console.log('To:', data.receiverId);
  console.log('Unread count:', data.unreadCount);
});
```

#### messagesRead
Notification that the recipient read your messages.

```javascript
socket.on('messagesRead', (data) => {
  console.log('Messages read by:', data.readBy);
  console.log('Count:', data.count);
  
  // Update UI to show "read" status
});
```

#### messageDeleted
Notification that a message was deleted.

```javascript
socket.on('messageDeleted', (data) => {
  console.log('Message deleted:', data.messageId);
  console.log('By:', data.senderId);
  
  // Remove message from UI
});
```

#### userTyping
Someone is typing to you.

```javascript
socket.on('userTyping', (data) => {
  console.log('User typing:', data.userId);
  // Show typing indicator
});
```

#### userStoppedTyping
Someone stopped typing.

```javascript
socket.on('userStoppedTyping', (data) => {
  console.log('User stopped typing:', data.userId);
  // Hide typing indicator
});
```

#### userStatusUpdate
A user's online status changed.

```javascript
socket.on('userStatusUpdate', (data) => {
  console.log('User:', data.userId);
  console.log('Status:', data.status);  // 'online' | 'away' | 'busy' | 'offline'
  console.log('Last seen:', data.lastSeen);  // ISO string if offline
});
```

#### onlineUsers
List of currently online users (received on connect).

```javascript
socket.on('onlineUsers', (users) => {
  console.log('Online users:', users);
  // [{ userId, status: 'online', lastSeen: null }, ...]
});
```

#### bulkStatusUpdate
Response to requestStatusUpdates.

```javascript
socket.on('bulkStatusUpdate', (statusMap) => {
  console.log('Status updates:', statusMap);
  // { 'user1_id': { status: 'online', lastSeen: null }, ... }
});
```

---

## Advanced Features

BananaTalk includes advanced chat features inspired by KakaoTalk and HelloTalk.

### Voice Messages

Send and receive voice messages with waveform visualization.

#### HTTP API

```
POST /api/v1/messages/voice
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body:
- voice: file (required - audio file)
- receiver: string (required - user ID)
- duration: number (optional - duration in seconds)
- waveform: array (optional - amplitude values 0-1 for visualization)
```

#### Socket Events

**Send Voice Message:**
```javascript
socket.emit('sendVoiceMessage', {
  receiver: 'user_id',
  mediaUrl: 'https://spaces.../voice.m4a',  // Already uploaded URL
  duration: 15,
  waveform: [0.2, 0.5, 0.8, 0.3, 0.6, ...]  // Amplitude data
}, (response) => {
  if (response.status === 'success') {
    console.log('Voice message sent:', response.message);
  }
});
```

**Receive Voice Message:**
```javascript
socket.on('newVoiceMessage', (data) => {
  console.log('Voice message:', data.message);
  // data.message.media.waveform - array for visualization
  // data.message.media.duration - length in seconds
});
```

**Notify When Played:**
```javascript
socket.emit('voiceMessagePlayed', {
  messageId: 'message_id',
  senderId: 'sender_user_id'
});

// Sender receives:
socket.on('voiceMessageListened', (data) => {
  console.log('Voice message listened by:', data.listenedBy);
});
```

---

### Message Corrections (HelloTalk Style)

Allow users to suggest corrections to messages - great for language learning!

#### HTTP API

**Add Correction:**
```
POST /api/v1/messages/:id/correct
Authorization: Bearer <token>

Body:
{
  "correctedText": "The correct version of the text",
  "explanation": "Optional explanation of the correction"
}
```

**Get Corrections:**
```
GET /api/v1/messages/:id/corrections
Authorization: Bearer <token>
```

**Accept Correction:**
```
PUT /api/v1/messages/:id/corrections/:correctionId/accept
Authorization: Bearer <token>
```

#### Socket Events

**Send Correction:**
```javascript
socket.emit('sendCorrection', {
  messageId: 'message_id',
  correctedText: 'The corrected text',
  explanation: 'Here is why...'
}, (response) => {
  if (response.status === 'success') {
    console.log('Correction sent:', response.correction);
  }
});
```

**Receive Correction Notification:**
```javascript
socket.on('newCorrection', (data) => {
  console.log('New correction for message:', data.messageId);
  console.log('Correction:', data.correction);
  // Show notification to user that someone corrected their message
});
```

**Accept Correction:**
```javascript
socket.emit('acceptCorrection', {
  messageId: 'message_id',
  correctionId: 'correction_id'
}, (response) => {
  if (response.status === 'success') {
    console.log('Correction accepted');
  }
});
```

**Receive Accept Notification (for corrector):**
```javascript
socket.on('correctionAccepted', (data) => {
  console.log('Your correction was accepted!');
  console.log('Message:', data.messageId);
});
```

---

### Disappearing Messages

Self-destructing messages that delete automatically after reading or time expiration.

#### HTTP API

```
POST /api/v1/messages/disappearing
Authorization: Bearer <token>

Body:
{
  "message": "This will self-destruct!",
  "receiver": "user_id",
  "destructTimer": 30,    // Delete 30 seconds after read
  "expiresIn": 3600       // Or delete after 1 hour regardless
}
```

**Trigger Self-Destruct:**
```
POST /api/v1/messages/:id/trigger-destruct
Authorization: Bearer <token>
```

#### Socket Events

**Send Disappearing Message:**
```javascript
socket.emit('sendDisappearingMessage', {
  receiver: 'user_id',
  message: 'Secret message!',
  destructTimer: 10,  // Seconds after read to delete
  expiresIn: 3600     // Seconds until auto-delete
}, (response) => {
  if (response.status === 'success') {
    console.log('Disappearing message sent');
  }
});
```

**Receive Disappearing Message:**
```javascript
socket.on('newDisappearingMessage', (data) => {
  console.log('Disappearing message:', data.message);
  console.log('Destruct timer:', data.destructTimer);
  console.log('Expires at:', data.expiresAt);
  
  // Show countdown or warning icon
});
```

**Acknowledge Reading (triggers timer):**
```javascript
socket.emit('triggerSelfDestruct', {
  messageId: 'message_id'
});

// Or acknowledge with callback:
socket.emit('acknowledgeDisappearingMessage', {
  messageId: 'message_id',
  senderId: 'sender_id'
});
```

**Message Self-Destructed:**
```javascript
socket.on('messageAutoDeleted', (data) => {
  console.log('Message deleted:', data.messageId);
  // Remove from UI
});
```

**Sender Gets Destruct Trigger Notification:**
```javascript
socket.on('messageDestructTriggered', (data) => {
  console.log('Message will be destroyed at:', data.destructAt);
});

socket.on('disappearingMessageRead', (data) => {
  console.log('Message read by:', data.readBy);
  console.log('At:', data.readAt);
});
```

---

### Polls

Create in-chat polls for quick decision making.

#### HTTP API

**Create Poll:**
```
POST /api/v1/messages/poll
Authorization: Bearer <token>

Body:
{
  "conversationId": "conversation_id",
  "question": "What should we eat?",
  "options": ["Pizza", "Sushi", "Tacos", "Burgers"],
  "settings": {
    "allowMultipleVotes": false,
    "maxVotesPerUser": 1,
    "isAnonymous": false,
    "showResultsBeforeVote": true,
    "allowAddOptions": false,
    "isQuiz": false,
    "correctOptionIndex": null,
    "explanation": null
  },
  "expiresIn": 86400  // 24 hours
}
```

**Vote:**
```
POST /api/v1/messages/poll/:pollId/vote
Authorization: Bearer <token>

Body:
{
  "optionIndex": 0  // Index of the option to vote for
}
```

**Get Results:**
```
GET /api/v1/messages/poll/:pollId
Authorization: Bearer <token>
```

**Close Poll:**
```
POST /api/v1/messages/poll/:pollId/close
Authorization: Bearer <token>
```

#### Socket Events

**Create Poll:**
```javascript
socket.emit('createPoll', {
  conversationId: 'conv_id',
  question: 'Where to meet?',
  options: ['Cafe', 'Park', 'Mall'],
  settings: {
    allowMultipleVotes: false,
    isAnonymous: false
  },
  expiresIn: 3600  // 1 hour
}, (response) => {
  if (response.status === 'success') {
    console.log('Poll created:', response.poll);
  }
});
```

**Receive New Poll:**
```javascript
socket.on('newPoll', (data) => {
  console.log('New poll:', data.poll);
  console.log('In conversation:', data.conversationId);
  // Show poll UI
});
```

**Vote on Poll:**
```javascript
socket.emit('votePoll', {
  pollId: 'poll_id',
  optionIndex: 1  // Vote for second option
}, (response) => {
  if (response.status === 'success') {
    console.log('Voted! Results:', response.results);
  }
});
```

**Receive Vote Update:**
```javascript
socket.on('pollVoteUpdate', (data) => {
  console.log('Poll updated:', data.pollId);
  console.log('New results:', data.results);
  console.log('Voter:', data.voterId);  // null if anonymous
  // Update poll UI with new percentages
});
```

**Close Poll:**
```javascript
socket.emit('closePoll', { pollId: 'poll_id' }, (response) => {
  if (response.status === 'success') {
    console.log('Poll closed');
  }
});
```

**Receive Poll Closed:**
```javascript
socket.on('pollClosed', (data) => {
  console.log('Poll closed:', data.pollId);
  console.log('Final results:', data.results);
});
```

#### Poll Results Format
```javascript
{
  question: "Where to meet?",
  totalVotes: 5,
  uniqueVoters: 4,
  status: "active",  // or "closed", "expired"
  isQuiz: false,
  options: [
    {
      index: 0,
      text: "Cafe",
      voteCount: 2,
      percentage: 40,
      voters: [{ user: {...}, votedAt: "..." }]  // if not anonymous
    },
    {
      index: 1,
      text: "Park",
      voteCount: 3,
      percentage: 60,
      voters: [...]
    }
  ]
}
```

---

### Mentions

Tag users in messages with @username.

#### HTTP API

**Get Messages Where User is Mentioned:**
```
GET /api/v1/messages/mentions
Authorization: Bearer <token>
```

#### Message with Mentions
When creating messages, mentions are automatically parsed from text containing `@username`:

```javascript
socket.emit('sendMessage', {
  receiver: 'user_id',
  message: 'Hey @john what do you think about this?'
}, callback);
```

The backend automatically:
1. Parses `@john` from the message
2. Looks up the user with name "john"
3. Stores mention data with position in text
4. Notifies mentioned user

#### Response Format
```javascript
{
  message: "Hey @john what do you think?",
  mentions: [
    {
      user: { _id: "...", name: "john" },
      username: "john",
      startIndex: 4,  // Position in text
      endIndex: 9
    }
  ]
}
```

---

### Bookmarks

Save important messages for later reference.

#### HTTP API

**Bookmark Message:**
```
POST /api/v1/messages/:id/bookmark
Authorization: Bearer <token>
```

**Remove Bookmark:**
```
DELETE /api/v1/messages/:id/bookmark
Authorization: Bearer <token>
```

**Get Bookmarked Messages:**
```
GET /api/v1/messages/bookmarks
Authorization: Bearer <token>
```

#### Response Format
```javascript
{
  success: true,
  count: 5,
  total: 10,
  pages: 2,
  data: [
    {
      message: { /* full message object */ },
      bookmarkedAt: "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

---

### Secret Chat

Enable end-to-end encrypted conversation mode with auto-delete.

#### HTTP API

**Enable Secret Chat:**
```
POST /api/v1/conversations/:id/secret
Authorization: Bearer <token>

Body:
{
  "destructTimer": 30,      // Auto-delete messages after X seconds
  "preventScreenshots": true // Frontend enforcement
}
```

#### Socket Events

**Receive Secret Chat Enabled:**
```javascript
socket.on('secretChatEnabled', (data) => {
  console.log('Secret chat enabled for:', data.conversationId);
  console.log('Settings:', data.settings);
  
  // Enable screenshot protection
  // Show lock icon
  // Apply auto-destruct to all messages
});
```

#### Secret Chat Settings
```javascript
{
  defaultDestructTimer: 30,
  preventScreenshots: true,
  requireAuthentication: false,
  encryptionKeyId: "...",
  createdAt: "2024-01-01T12:00:00.000Z"
}
```

---

### Chat Themes

Customize conversation appearance per-user.

#### HTTP API

**Set Theme:**
```
PUT /api/v1/conversations/:id/theme
Authorization: Bearer <token>

Body:
{
  "theme": {
    "preset": "dark",  // default, dark, light, blue, pink, green, custom
    "backgroundUrl": "https://...",  // Custom background image
    "backgroundColor": "#1a1a2e",
    "senderBubbleColor": "#4a4a6a",
    "receiverBubbleColor": "#3a3a5a",
    "fontSize": "medium"  // small, medium, large
  }
}
```

#### Theme Options
```javascript
{
  preset: 'default' | 'dark' | 'light' | 'blue' | 'pink' | 'green' | 'custom',
  backgroundUrl: string,
  backgroundColor: string,
  senderBubbleColor: string,
  receiverBubbleColor: string,
  fontSize: 'small' | 'medium' | 'large'
}
```

---

### Nicknames

Set custom display names for users within a conversation.

#### HTTP API

**Set Nickname:**
```
PUT /api/v1/conversations/:id/nickname
Authorization: Bearer <token>

Body:
{
  "targetUserId": "user_id_to_nickname",
  "nickname": "Best Friend 💕"
}
```

The nickname only applies within this conversation and is visible to both participants.

---

### Quick Replies

Save and use frequently sent messages.

#### HTTP API

**Add Quick Reply:**
```
POST /api/v1/conversations/:id/quick-replies
Authorization: Bearer <token>

Body:
{
  "text": "On my way! 🏃‍♂️"
}
```

**Get Quick Replies:**
```
GET /api/v1/conversations/:id/quick-replies
Authorization: Bearer <token>
```

#### Response Format
```javascript
{
  success: true,
  data: [
    {
      _id: "qr_id",
      text: "On my way! 🏃‍♂️",
      createdBy: "user_id",
      createdAt: "2024-01-01T12:00:00.000Z",
      useCount: 15
    },
    {
      _id: "qr_id2",
      text: "Be there in 5 mins",
      createdBy: "user_id",
      createdAt: "2024-01-02T12:00:00.000Z",
      useCount: 8
    }
  ]
}
```

---

### Translation

Translate messages to different languages.

#### HTTP API

**Translate Message:**
```
POST /api/v1/messages/:id/translate
Authorization: Bearer <token>

Body:
{
  "targetLanguage": "ko"  // ISO language code
}
```

**Get Translations:**
```
GET /api/v1/messages/:id/translations
Authorization: Bearer <token>
```

#### Response Format
```javascript
{
  success: true,
  data: {
    language: "ko",
    translatedText: "안녕하세요!",
    translatedAt: "2024-01-01T12:00:00.000Z"
  },
  cached: false  // true if translation was already cached
}
```

---

## Message Schema Reference

### Full Message Object

```typescript
interface Message {
  _id: string;
  sender: User;
  receiver: User;
  participants: User[];
  message?: string;
  
  // Message type
  messageType: 'text' | 'media' | 'voice' | 'poll' | 'location' | 'contact' | 'sticker' | 'system';
  
  // Media attachment
  media?: {
    url: string;                    // Full URL (DigitalOcean Spaces)
    type: 'image' | 'video' | 'document' | 'audio' | 'voice' | 'location';
    thumbnail?: string;             // For videos
    fileName?: string;
    fileSize?: number;              // In bytes
    mimeType?: string;
    duration?: number;              // For audio/video/voice in seconds
    waveform?: number[];            // Voice message amplitude data (0-1)
    dimensions?: {
      width: number;
      height: number;
    };
    // For location type only
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
      placeName?: string;
    };
  };
  
  // Status
  read: boolean;
  readAt?: Date;
  readBy: Array<{ user: string; readAt: Date }>;
  
  // Reactions
  reactions: Array<{ user: string; emoji: string }>;
  
  // Mentions (HelloTalk style)
  mentions?: Array<{
    user: User;
    username: string;
    startIndex: number;
    endIndex: number;
  }>;
  
  // Corrections (HelloTalk language learning feature)
  corrections?: Array<{
    _id: string;
    corrector: User;
    originalText: string;
    correctedText: string;
    explanation?: string;
    createdAt: Date;
    isAccepted: boolean;
  }>;
  
  // Self-destruct settings
  selfDestruct?: {
    enabled: boolean;
    expiresAt?: Date;
    destructAfterRead: boolean;
    destructTimer: number;  // Seconds after read
    destructAt?: Date;      // When destruction will happen
  };
  
  // Translations
  translations?: Array<{
    language: string;       // ISO code
    translatedText: string;
    translatedAt: Date;
    provider?: 'google' | 'deepl' | 'papago';
  }>;
  
  // Poll reference
  poll?: Poll;
  isScheduled: boolean;
  scheduledFor?: Date;
  
  // Reply/Forward
  replyTo?: Message;
  isForwarded: boolean;
  forwardedFrom?: {
    sender: User;
    messageId: string;
    originalMessage: string;
  };
  
  // Edit/Delete
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedFor: string[];
  
  // Pin
  pinned: boolean;
  pinnedAt?: Date;
  pinnedBy?: User;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Poll object
interface Poll {
  _id: string;
  message: string;          // Reference to message
  conversation: string;     // Reference to conversation
  creator: User;
  question: string;
  options: Array<{
    text: string;
    votes: Array<{ user: string; votedAt: Date }>;
    voteCount: number;
  }>;
  settings: {
    allowMultipleVotes: boolean;
    maxVotesPerUser: number;
    isAnonymous: boolean;
    showResultsBeforeVote: boolean;
    allowAddOptions: boolean;
    isQuiz: boolean;
    correctOptionIndex?: number;
    explanation?: string;
  };
  status: 'active' | 'closed' | 'expired';
  expiresAt?: Date;
  closedAt?: Date;
  closedBy?: User;
  totalVotes: number;
  uniqueVoters: number;
  createdAt: Date;
}
```

### Media Types

| Type | Description | Supported Formats |
|------|-------------|-------------------|
| `image` | Photo attachment | JPEG, PNG, GIF, WebP |
| `video` | Video attachment | MP4, MOV, AVI |
| `audio` | Voice message or audio file | MP3, WAV, M4A |
| `document` | Document/file | PDF, DOC, etc. |
| `location` | Shared location | N/A |
| `voice` | Voice message with waveform | M4A, WAV, MP3 |

### Conversation Object

```typescript
interface Conversation {
  _id: string;
  participants: User[];
  lastMessage: Message;
  lastMessageAt: Date;
  
  // Per-user state
  unreadCount: Array<{ user: string; count: number }>;
  mutedBy: Array<{ user: string; mutedUntil?: Date; mutedAt: Date }>;
  archivedBy: string[];
  pinnedBy: Array<{ user: string; pinnedAt: Date }>;
  
  // Group chat
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  
  // Theme customization
  theme?: {
    preset: string;
    backgroundUrl?: string;
    backgroundColor?: string;
    senderBubbleColor?: string;
    receiverBubbleColor?: string;
    fontSize?: string;
  };
  
  userThemes?: Array<{
    user: string;
    theme: object;
  }>;
  
  // Secret chat (KakaoTalk style)
  isSecret: boolean;
  secretChatSettings?: {
    defaultDestructTimer: number;
    preventScreenshots: boolean;
    requireAuthentication: boolean;
    encryptionKeyId?: string;
    createdAt: Date;
  };
  
  // Nicknames (KakaoTalk style)
  nicknames?: Array<{
    user: string;
    nickname: string;
    setBy: string;
    setAt: Date;
  }>;
  
  // Quick replies
  quickReplies?: Array<{
    _id: string;
    text: string;
    createdBy: string;
    createdAt: Date;
    useCount: number;
  }>;
  
  // Labels/Tags
  labels?: Array<{
    name: string;
    color: string;
    addedBy: string;
  }>;
  
  // Language settings (HelloTalk style)
  languageSettings?: {
    primaryLanguage?: string;
    enableCorrections: boolean;
    autoTranslate: boolean;
    translateTo?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Code Examples

### Complete React/React Native Example

```javascript
// chatService.js
import { io } from 'socket.io-client';
import axios from 'axios';

const API_URL = 'https://api.banatalk.com/api/v1';

class ChatService {
  constructor() {
    this.socket = null;
    this.token = null;
  }

  // Initialize with auth token
  init(token) {
    this.token = token;
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    this.socket = io('https://api.banatalk.com', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    return new Promise((resolve, reject) => {
      this.socket.on('connect', () => resolve());
      this.socket.on('connect_error', (err) => reject(err));
    });
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // ============ HTTP Methods ============

  // Get conversation list
  async getConversations() {
    const response = await axios.get(`${API_URL}/conversations`);
    return response.data.data;
  }

  // Get messages for a conversation
  async getMessages(senderId, receiverId) {
    const response = await axios.get(
      `${API_URL}/messages/conversation/${senderId}/${receiverId}`
    );
    return response.data.data;
  }

  // Send message with attachment (HTTP)
  async sendMessageWithAttachment(receiverId, message, file) {
    const formData = new FormData();
    formData.append('receiver', receiverId);
    if (message) formData.append('message', message);
    if (file) formData.append('attachment', file);

    const response = await axios.post(`${API_URL}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  }

  // Search messages
  async searchMessages(query) {
    const response = await axios.get(`${API_URL}/messages/search?q=${query}`);
    return response.data.data;
  }

  // Block user
  async blockUser(userId, reason) {
    const response = await axios.post(`${API_URL}/users/${userId}/block`, { reason });
    return response.data;
  }

  // Unblock user
  async unblockUser(userId) {
    const response = await axios.delete(`${API_URL}/users/${userId}/block`);
    return response.data;
  }

  // ============ Socket Methods ============

  // Send text message (Socket)
  sendMessage(receiverId, message) {
    return new Promise((resolve, reject) => {
      this.socket.emit('sendMessage', {
        receiver: receiverId,
        message: message
      }, (response) => {
        if (response.status === 'success') {
          resolve(response.message);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  // Mark messages as read
  markAsRead(senderId) {
    return new Promise((resolve) => {
      this.socket.emit('markAsRead', { senderId }, resolve);
    });
  }

  // Delete message
  deleteMessage(messageId) {
    return new Promise((resolve, reject) => {
      this.socket.emit('deleteMessage', { messageId }, (response) => {
        if (response.status === 'success') {
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  // Typing indicators
  startTyping(receiverId) {
    this.socket.emit('typing', { receiver: receiverId });
  }

  stopTyping(receiverId) {
    this.socket.emit('stopTyping', { receiver: receiverId });
  }

  // ============ Event Listeners ============

  onNewMessage(callback) {
    this.socket.on('newMessage', callback);
  }

  onMessageSent(callback) {
    this.socket.on('messageSent', callback);
  }

  onMessagesRead(callback) {
    this.socket.on('messagesRead', callback);
  }

  onMessageDeleted(callback) {
    this.socket.on('messageDeleted', callback);
  }

  onUserTyping(callback) {
    this.socket.on('userTyping', callback);
  }

  onUserStoppedTyping(callback) {
    this.socket.on('userStoppedTyping', callback);
  }

  onUserStatusUpdate(callback) {
    this.socket.on('userStatusUpdate', callback);
  }

  onOnlineUsers(callback) {
    this.socket.on('onlineUsers', callback);
  }

  // Remove listeners
  removeAllListeners() {
    this.socket.removeAllListeners();
  }
}

export default new ChatService();
```

### Usage in React Component

```jsx
// ChatScreen.jsx
import React, { useEffect, useState, useRef } from 'react';
import chatService from './chatService';

function ChatScreen({ userId, receiverId, token }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    // Initialize chat service
    chatService.init(token).then(() => {
      // Load messages
      chatService.getMessages(userId, receiverId).then(setMessages);

      // Listen for new messages
      chatService.onNewMessage((data) => {
        if (data.senderId === receiverId) {
          setMessages(prev => [...prev, data.message]);
          chatService.markAsRead(receiverId);
        }
      });

      // Listen for typing
      chatService.onUserTyping((data) => {
        if (data.userId === receiverId) {
          setIsTyping(true);
        }
      });

      chatService.onUserStoppedTyping((data) => {
        if (data.userId === receiverId) {
          setIsTyping(false);
        }
      });

      // Listen for status
      chatService.onUserStatusUpdate((data) => {
        if (data.userId === receiverId) {
          setIsOnline(data.status === 'online');
        }
      });

      // Listen for read receipts
      chatService.onMessagesRead((data) => {
        if (data.readBy === receiverId) {
          setMessages(prev => prev.map(msg => 
            msg.sender._id === userId ? { ...msg, read: true } : msg
          ));
        }
      });
    });

    return () => {
      chatService.removeAllListeners();
    };
  }, [userId, receiverId, token]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    try {
      const message = await chatService.sendMessage(receiverId, inputText);
      setMessages(prev => [...prev, message]);
      setInputText('');
      chatService.stopTyping(receiverId);
    } catch (error) {
      alert('Failed to send: ' + error.message);
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);

    // Typing indicator logic
    chatService.startTyping(receiverId);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      chatService.stopTyping(receiverId);
    }, 2000);
  };

  const handleFileUpload = async (file) => {
    try {
      const message = await chatService.sendMessageWithAttachment(
        receiverId,
        inputText,
        file
      );
      setMessages(prev => [...prev, message]);
      setInputText('');
    } catch (error) {
      alert('Failed to upload: ' + error.message);
    }
  };

  return (
    <div className="chat-screen">
      <div className="chat-header">
        <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
        <span>{isOnline ? 'Online' : 'Offline'}</span>
      </div>

      <div className="messages-container">
        {messages.map(msg => (
          <div 
            key={msg._id} 
            className={`message ${msg.sender._id === userId ? 'sent' : 'received'}`}
          >
            {msg.message && <p>{msg.message}</p>}
            {msg.media && msg.media.type === 'image' && (
              <img src={msg.media.url} alt="attachment" />
            )}
            <span className="time">
              {new Date(msg.createdAt).toLocaleTimeString()}
              {msg.sender._id === userId && (
                <span className="read-status">
                  {msg.read ? '✓✓' : '✓'}
                </span>
              )}
            </span>
          </div>
        ))}
        {isTyping && <div className="typing-indicator">Typing...</div>}
      </div>

      <div className="input-container">
        <input
          type="text"
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Type a message..."
        />
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => handleFileUpload(e.target.files[0])}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

export default ChatScreen;
```

---

## Error Handling

### Socket.IO Error Format

All socket callbacks return:

```javascript
// Success
{
  status: 'success',
  // ... additional data
}

// Error
{
  status: 'error',
  error: 'Error message description'
}
```

### HTTP Error Format

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common Error Codes

| HTTP Code | Description |
|-----------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Blocked user or insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Server Error |

### Error Handling Example

```javascript
// HTTP
try {
  const response = await axios.post('/api/v1/messages', data);
  return response.data;
} catch (error) {
  if (error.response) {
    // Server responded with error
    const { status, data } = error.response;
    
    switch (status) {
      case 401:
        // Redirect to login
        break;
      case 403:
        alert(data.error); // "Cannot send message to blocked user"
        break;
      case 429:
        alert('Please slow down. Try again later.');
        break;
      default:
        alert(data.error || 'Something went wrong');
    }
  } else {
    // Network error
    alert('Network error. Check your connection.');
  }
}

// Socket
socket.emit('sendMessage', data, (response) => {
  if (response.status === 'error') {
    if (response.error.includes('limit exceeded')) {
      // Show upgrade to VIP prompt
    } else if (response.error.includes('blocked')) {
      // Show blocked user message
    } else {
      alert(response.error);
    }
  }
});
```

---

## Rate Limiting

Message sending is rate-limited based on user mode:

| User Mode | Messages per Day |
|-----------|------------------|
| Visitor | 10 |
| Regular | 100 |
| VIP | Unlimited |

### Limit Error Response

When limit is exceeded:

```json
{
  "success": false,
  "error": "Daily message limit exceeded. Used 100/100. Resets at 12:00 AM."
}
```

### Checking Limits

```javascript
// Get user limits via REST API
GET /api/v1/auth/users/:userId/limits
Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "userMode": "regular",
    "messages": {
      "used": 45,
      "limit": 100,
      "remaining": 55,
      "resetsAt": "2024-01-02T00:00:00.000Z"
    }
  }
}
```

---

## Best Practices

1. **Always handle reconnection**: Socket.IO may disconnect. Re-authenticate and resync on reconnect.

2. **Optimistic UI updates**: Update UI immediately when sending, then confirm with callback.

3. **Debounce typing indicators**: Don't spam typing events. Use a timeout.

4. **Cache conversations**: Store messages locally and only fetch new ones.

5. **Handle offline gracefully**: Queue messages when offline, send when reconnected.

6. **Paginate message history**: Don't load all messages at once. Use limit/offset.

7. **Compress images before upload**: Reduce file size client-side for faster uploads.

---

## Support

For issues or questions, contact: support@banatalk.com

