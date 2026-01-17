# Chat System API Documentation

Complete API reference for the BananaTalk real-time chat system. This document covers conversations, messages, real-time events, and advanced features.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Conversations API](#conversations-api)
4. [Messages API](#messages-api)
5. [Advanced Message Features](#advanced-message-features)
6. [Media Messages](#media-messages)
7. [Real-time Socket.IO Events](#real-time-socketio-events)
8. [Polls](#polls)
9. [Data Models](#data-models)
10. [Error Handling](#error-handling)

---

## Overview

The chat system provides:

- **1-on-1 Direct Messages**: Private conversations between two users
- **Real-time Messaging**: Instant message delivery via Socket.IO
- **Media Support**: Images, videos (up to 1GB/10min), voice messages, documents
- **Language Learning Features**: Message corrections, translations (HelloTalk-style)
- **Advanced Features**: Reactions, replies, forwards, polls, self-destructing messages
- **Conversation Management**: Mute, archive, pin, themes, nicknames, quick replies
- **Secret Chat Mode**: End-to-end encryption indicators, screenshot prevention

### Base URL

```
https://your-api-domain.com/api/v1
```

### Rate Limits

| User Type | Messages Per Day |
|-----------|------------------|
| Regular   | 1000             |
| Visitor   | 50               |

---

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

---

## Conversations API

### Get All Conversations

Returns a list of conversations for the authenticated user.

```http
GET /conversations
```

**Query Parameters:**

| Parameter | Type    | Description                    |
|-----------|---------|--------------------------------|
| page      | number  | Page number (default: 1)       |
| limit     | number  | Items per page (default: 20)   |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "conversation_id",
      "participants": [
        {
          "_id": "user_id",
          "name": "John Doe",
          "images": ["https://..."]
        }
      ],
      "lastMessage": {
        "_id": "message_id",
        "message": "Hello!",
        "createdAt": "2024-01-15T10:30:00Z"
      },
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "unreadCount": [
        { "user": "user_id", "count": 3 }
      ],
      "isGroup": false,
      "isPinned": false,
      "isMuted": false,
      "isArchived": false
    }
  ]
}
```

### Get Single Conversation

```http
GET /conversations/:id
```

**Response includes:**
- Conversation details
- Theme settings
- Nicknames
- Quick replies
- Language settings
- Secret chat status

### Mute/Unmute Conversation

```http
POST /conversations/:id/mute
POST /conversations/:id/unmute
```

**Mute Request Body (optional):**

```json
{
  "duration": 86400000  // Duration in milliseconds (null = forever)
}
```

### Archive/Unarchive Conversation

```http
POST /conversations/:id/archive
POST /conversations/:id/unarchive
```

### Pin/Unpin Conversation

```http
POST /conversations/:id/pin
POST /conversations/:id/unpin
```

### Mark as Read

```http
PUT /conversations/:id/read
```

### Set Conversation Theme

```http
PUT /conversations/:id/theme
```

**Request Body:**

```json
{
  "preset": "dark",           // "default", "dark", "light", "blue", "pink", "green", "custom"
  "backgroundUrl": "https://...",
  "backgroundColor": "#1a1a1a",
  "senderBubbleColor": "#007bff",
  "receiverBubbleColor": "#28a745",
  "fontSize": "medium"        // "small", "medium", "large"
}
```

### Set Nickname

Set a custom nickname for the other user in the conversation.

```http
PUT /conversations/:id/nickname
```

**Request Body:**

```json
{
  "targetUserId": "user_id",
  "nickname": "Best Friend"
}
```

### Enable Secret Chat

```http
POST /conversations/:id/secret
```

**Request Body:**

```json
{
  "destructTimer": 30,         // Seconds until messages self-destruct after read
  "preventScreenshots": true,
  "requireAuthentication": false
}
```

### Quick Replies

```http
GET /conversations/:id/quick-replies
POST /conversations/:id/quick-replies
```

**POST Request Body:**

```json
{
  "text": "Thanks for the correction!"
}
```

---

## Messages API

### Get Messages (Basic)

```http
GET /messages
GET /messages/conversation/:senderId/:receiverId
```

**Query Parameters:**

| Parameter | Type   | Description                  |
|-----------|--------|------------------------------|
| page      | number | Page number                  |
| limit     | number | Messages per page            |
| before    | string | Get messages before this ID  |
| after     | string | Get messages after this ID   |

### Send Message

```http
POST /messages
```

**Request Body (JSON or Form Data):**

```json
{
  "receiver": "receiver_user_id",
  "message": "Hello, how are you?",
  "replyTo": "message_id",           // Optional: reply to a message
  "location": {                       // Optional: location message
    "latitude": 37.7749,
    "longitude": -122.4194,
    "address": "San Francisco, CA",
    "placeName": "Golden Gate Park"
  }
}
```

**With attachment (multipart/form-data):**

| Field      | Type   | Description                    |
|------------|--------|--------------------------------|
| receiver   | string | Receiver user ID               |
| message    | string | Optional text message          |
| attachment | file   | Image or video file            |

### Get Single Message

```http
GET /messages/:id
```

### Edit Message

```http
PUT /messages/:id
```

**Request Body:**

```json
{
  "message": "Updated message text"
}
```

**Note:** Only the sender can edit, and only within a time limit.

### Delete Message

```http
DELETE /messages/:id
```

**Query Parameters:**

| Parameter | Type    | Description                    |
|-----------|---------|--------------------------------|
| forAll    | boolean | Delete for all participants    |

### Search Messages

```http
GET /messages/search
```

**Query Parameters:**

| Parameter | Type   | Description                    |
|-----------|--------|--------------------------------|
| q         | string | Search query                   |
| userId    | string | Filter by conversation partner |
| from      | date   | Start date                     |
| to        | date   | End date                       |
| type      | string | Message type filter            |

### Reply to Message

```http
POST /messages/:id/reply
```

**Request Body:**

```json
{
  "message": "I agree with this!"
}
```

### Forward Message

```http
POST /messages/:id/forward
```

**Request Body:**

```json
{
  "receiverIds": ["user_id_1", "user_id_2"]
}
```

### Pin Message

```http
POST /messages/:id/pin
```

### Get Message Replies

```http
GET /messages/:id/replies
```

---

## Advanced Message Features

### Reactions

**Get Reactions:**

```http
GET /messages/:id/reactions
```

**Add Reaction:**

```http
POST /messages/:id/reactions
```

```json
{
  "emoji": "❤️"
}
```

**Remove Reaction:**

```http
DELETE /messages/:id/reactions/:emoji
```

### Language Corrections (HelloTalk-style)

Send a correction suggestion for a message:

```http
POST /messages/:id/correct
```

**Request Body:**

```json
{
  "correctedText": "This is the corrected sentence.",
  "explanation": "You should use 'is' instead of 'are' here."
}
```

**Get Corrections:**

```http
GET /messages/:id/corrections
```

**Accept Correction:**

```http
PUT /messages/:id/corrections/:correctionId/accept
```

### Translations

**Translate Message:**

```http
POST /messages/:id/translate
```

**Request Body:**

```json
{
  "targetLanguage": "ko"  // ISO language code
}
```

**Get Translations:**

```http
GET /messages/:id/translations
```

### Bookmarks

**Bookmark Message:**

```http
POST /messages/:id/bookmark
```

**Remove Bookmark:**

```http
DELETE /messages/:id/bookmark
```

**Get All Bookmarks:**

```http
GET /messages/bookmarks
```

### Mentions

Get messages where you were mentioned:

```http
GET /messages/mentions
```

### Disappearing Messages

**Send Self-Destructing Message:**

```http
POST /messages/disappearing
```

**Request Body:**

```json
{
  "receiver": "user_id",
  "message": "This message will self-destruct",
  "destructTimer": 10,    // Seconds after read
  "expiresIn": 3600       // Optional: absolute expiry in seconds
}
```

**Trigger Destruct (after reading):**

```http
POST /messages/:id/trigger-destruct
```

---

## Media Messages

### Video Message

**Endpoint:**

```http
POST /messages/video
Content-Type: multipart/form-data
```

**Form Fields:**

| Field    | Type   | Required | Description                |
|----------|--------|----------|----------------------------|
| video    | file   | Yes      | Video file                 |
| receiver | string | Yes      | Receiver user ID           |
| message  | string | No       | Optional caption           |

**Video Constraints:**

| Constraint      | Value                                   |
|-----------------|-----------------------------------------|
| Max File Size   | 1GB (1,073,741,824 bytes)              |
| Max Duration    | 10 minutes (600 seconds)               |
| Allowed Formats | MP4, MOV, AVI, WebM, 3GP, M4V          |
| Thumbnail       | Auto-generated at 1-second mark        |

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "message_id",
    "sender": { "_id": "...", "name": "..." },
    "receiver": { "_id": "...", "name": "..." },
    "messageType": "media",
    "media": {
      "url": "https://my-projects-media.sfo3.digitaloceanspaces.com/...",
      "type": "video",
      "thumbnail": "https://my-projects-media.sfo3.digitaloceanspaces.com/...-thumb.jpg",
      "duration": 45.5,
      "mimeType": "video/mp4",
      "fileSize": 15000000,
      "dimensions": { "width": 1920, "height": 1080 }
    },
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Get Video Configuration:**

```http
GET /messages/video-config
```

### Voice Message

**Endpoint:**

```http
POST /messages/voice
Content-Type: multipart/form-data
```

**Form Fields:**

| Field    | Type   | Required | Description                |
|----------|--------|----------|----------------------------|
| voice    | file   | Yes      | Audio file (MP3, M4A, WAV) |
| receiver | string | Yes      | Receiver user ID           |
| duration | number | No       | Duration in seconds        |
| waveform | array  | No       | Audio waveform data [0-1]  |

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "message_id",
    "messageType": "voice",
    "media": {
      "url": "https://...",
      "type": "voice",
      "duration": 15.3,
      "waveform": [0.1, 0.3, 0.5, 0.8, 0.4, ...]
    }
  }
}
```

### Image Message

Use the standard message endpoint with `attachment` field:

```http
POST /messages
Content-Type: multipart/form-data
```

| Field      | Type   | Description              |
|------------|--------|--------------------------|
| attachment | file   | Image file (JPG, PNG, etc.) |
| receiver   | string | Receiver user ID         |
| message    | string | Optional caption         |

---

## Real-time Socket.IO Events

### Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('wss://your-api-domain.com', {
  auth: {
    token: 'your_jwt_token'
  },
  query: {
    deviceId: 'device_unique_id'  // For multi-device support
  }
});
```

### Client Events (Emit)

#### Send Message

```javascript
socket.emit('sendMessage', {
  receiver: 'user_id',
  message: 'Hello!'
}, (response) => {
  if (response.status === 'success') {
    console.log('Message sent:', response.message);
  } else {
    console.error('Error:', response.error);
  }
});
```

#### Typing Indicators

```javascript
// Start typing
socket.emit('typing', { receiver: 'user_id' });

// Stop typing
socket.emit('stopTyping', { receiver: 'user_id' });
```

#### Mark as Read

```javascript
socket.emit('markAsRead', { senderId: 'user_id' }, (response) => {
  console.log('Marked', response.markedCount, 'messages as read');
});
```

#### Delete Message

```javascript
socket.emit('deleteMessage', { messageId: 'message_id' });
```

#### Update Status

```javascript
socket.emit('updateStatus', { status: 'away' });  // 'online', 'away', 'busy', 'offline'
```

#### Get User Status

```javascript
socket.emit('getUserStatus', { userId: 'user_id' }, (response) => {
  console.log('User status:', response.data.status);
});
```

#### Request Bulk Status Updates

```javascript
socket.emit('requestStatusUpdates', {
  userIds: ['user1', 'user2', 'user3']
});
```

#### Logout

```javascript
socket.emit('logout', {}, (response) => {
  console.log('Logged out successfully');
});
```

### Server Events (Listen)

#### New Message

```javascript
socket.on('newMessage', (data) => {
  const { message, unreadCount, senderId } = data;
  // Handle new message
});
```

#### Message Sent Confirmation

```javascript
socket.on('messageSent', (data) => {
  const { message, unreadCount, receiverId } = data;
  // Sync message across devices
});
```

#### Messages Read

```javascript
socket.on('messagesRead', (data) => {
  const { readBy, count } = data;
  // Update read receipts
});
```

#### Message Deleted

```javascript
socket.on('messageDeleted', (data) => {
  const { messageId, senderId } = data;
  // Remove message from UI
});
```

#### Typing Indicators

```javascript
socket.on('userTyping', (data) => {
  const { userId, isTyping } = data;
  // Show typing indicator
});

socket.on('userStoppedTyping', (data) => {
  const { userId, isTyping } = data;
  // Hide typing indicator
});
```

#### User Status Updates

```javascript
socket.on('userStatusUpdate', (data) => {
  const { userId, status, lastSeen, deviceCount } = data;
  // Update user status in UI
});

socket.on('bulkStatusUpdate', (statusMap) => {
  // { userId1: { status, lastSeen }, userId2: { ... } }
});
```

#### Online Users List

```javascript
socket.on('onlineUsers', (users) => {
  // Array of online users with status info
});
```

#### Voice Message Events

```javascript
socket.on('newVoiceMessage', (data) => {
  const { message, duration } = data;
  // Handle voice message
});

socket.on('voiceMessageListened', (data) => {
  const { messageId, listenedBy } = data;
  // Show "listened" indicator
});
```

#### Correction Events

```javascript
socket.on('newCorrection', (data) => {
  const { messageId, correction, correctorId } = data;
  // Show correction notification
});

socket.on('correctionAccepted', (data) => {
  const { messageId, correctionId, acceptedBy } = data;
  // Update correction status
});
```

#### Poll Events

```javascript
socket.on('newPoll', (data) => {
  const { poll, message, conversationId } = data;
  // Show poll
});

socket.on('pollVoteUpdate', (data) => {
  const { pollId, results, voterId } = data;
  // Update poll results
});

socket.on('pollClosed', (data) => {
  const { pollId, results } = data;
  // Show final results
});
```

#### Disappearing Message Events

```javascript
socket.on('newDisappearingMessage', (data) => {
  const { message, destructTimer, expiresAt } = data;
  // Handle disappearing message
});

socket.on('messageDestructTriggered', (data) => {
  const { messageId, destructAt } = data;
  // Start countdown
});

socket.on('messageAutoDeleted', (data) => {
  const { messageId } = data;
  // Remove message from UI
});

socket.on('disappearingMessageRead', (data) => {
  const { messageId, readAt, readBy } = data;
  // Update read status
});
```

#### Connection Events

```javascript
socket.on('ping', () => {
  socket.emit('pong');
});

socket.on('forceDisconnect', (data) => {
  console.log('Disconnected:', data.reason, data.message);
  // Handle forced disconnect (max connections reached)
});

socket.on('authError', (data) => {
  console.log('Auth error:', data.message);
  // Redirect to login
});

socket.on('messageError', (data) => {
  console.error('Message error:', data.error);
});
```

---

## Polls

### Create Poll

```http
POST /messages/poll
```

**Request Body:**

```json
{
  "conversationId": "conversation_id",
  "question": "What's your favorite programming language?",
  "options": ["JavaScript", "Python", "Go", "Rust"],
  "settings": {
    "allowMultipleVotes": false,
    "maxVotesPerUser": 1,
    "isAnonymous": false,
    "showResultsBeforeVote": false,
    "allowAddOptions": false,
    "isQuiz": false,
    "correctOptionIndex": null,
    "explanation": null
  },
  "expiresIn": 86400  // Seconds until poll expires
}
```

### Get Poll Results

```http
GET /messages/poll/:pollId
```

### Vote on Poll

```http
POST /messages/poll/:pollId/vote
```

**Request Body:**

```json
{
  "optionIndex": 0
}
```

### Close Poll

```http
POST /messages/poll/:pollId/close
```

---

## Data Models

### Message Object

```typescript
interface Message {
  _id: string;
  sender: User;
  receiver: User;
  message: string;
  messageType: 'text' | 'media' | 'voice' | 'poll' | 'location' | 'contact' | 'sticker' | 'system';
  read: boolean;
  readAt: Date;
  createdAt: Date;
  updatedAt: Date;

  // Media
  media?: {
    url: string;
    type: 'image' | 'video' | 'document' | 'audio' | 'voice' | 'location';
    thumbnail?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: number;
    dimensions?: { width: number; height: number };
    waveform?: number[];
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
      placeName?: string;
    };
  };

  // Reactions
  reactions: Array<{ user: string; emoji: string }>;

  // Reply/Forward
  replyTo?: Message;
  isForwarded: boolean;
  forwardedFrom?: {
    sender: string;
    messageId: string;
    originalMessage: string;
  };

  // Edit/Delete
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;

  // Pin
  pinned: boolean;
  pinnedAt?: Date;
  pinnedBy?: string;

  // Corrections (HelloTalk)
  corrections: Array<{
    _id: string;
    corrector: User;
    originalText: string;
    correctedText: string;
    explanation: string;
    createdAt: Date;
    isAccepted: boolean;
  }>;

  // Translations
  translations: Array<{
    language: string;
    translatedText: string;
    translatedAt: Date;
    provider: 'google' | 'deepl' | 'papago' | null;
  }>;

  // Mentions
  mentions: Array<{
    user: string;
    username: string;
    startIndex: number;
    endIndex: number;
  }>;

  // Self-Destruct
  selfDestruct?: {
    enabled: boolean;
    expiresAt?: Date;
    destructAfterRead: boolean;
    destructTimer: number;
    destructAt?: Date;
  };

  // Poll
  poll?: string;  // Poll ID
}
```

### Conversation Object

```typescript
interface Conversation {
  _id: string;
  participants: User[];
  lastMessage: Message;
  lastMessageAt: Date;
  unreadCount: Array<{ user: string; count: number }>;
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;

  // Mute/Archive/Pin
  mutedBy: Array<{ user: string; mutedUntil: Date; mutedAt: Date }>;
  archivedBy: string[];
  pinnedBy: Array<{ user: string; pinnedAt: Date }>;

  // Theme
  theme: {
    preset: 'default' | 'dark' | 'light' | 'blue' | 'pink' | 'green' | 'custom';
    backgroundUrl?: string;
    backgroundColor?: string;
    senderBubbleColor?: string;
    receiverBubbleColor?: string;
    fontSize: 'small' | 'medium' | 'large';
  };

  // Nicknames
  nicknames: Array<{
    user: string;
    nickname: string;
    setBy: string;
    setAt: Date;
  }>;

  // Quick Replies
  quickReplies: Array<{
    _id: string;
    text: string;
    createdBy: string;
    useCount: number;
  }>;

  // Secret Chat
  isSecret: boolean;
  secretChatSettings?: {
    defaultDestructTimer: number;
    preventScreenshots: boolean;
    requireAuthentication: boolean;
    encryptionKeyId?: string;
    createdAt: Date;
  };

  // Language Settings
  languageSettings: {
    primaryLanguage?: string;
    enableCorrections: boolean;
    autoTranslate: boolean;
    translateTo?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}
```

### Poll Object

```typescript
interface Poll {
  _id: string;
  message: string;
  conversation: string;
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
  closedBy?: string;
  totalVotes: number;
  uniqueVoters: number;
  createdAt: Date;
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Common Error Codes

| Status Code | Description                          |
|-------------|--------------------------------------|
| 400         | Bad Request (validation error)       |
| 401         | Unauthorized (invalid/missing token) |
| 403         | Forbidden (not allowed)              |
| 404         | Not Found                            |
| 429         | Rate Limit Exceeded                  |
| 500         | Server Error                         |

### Rate Limit Error

```json
{
  "success": false,
  "error": "Daily message limit exceeded. Used 1000/1000. Resets at midnight.",
  "type": "limit_exceeded",
  "details": {
    "current": 1000,
    "max": 1000,
    "resetTime": "2024-01-16T00:00:00Z"
  }
}
```

### Video Upload Errors

```json
{
  "success": false,
  "error": "Video duration (720s) exceeds maximum of 600 seconds (10 minutes)",
  "maxDuration": 600
}
```

```json
{
  "success": false,
  "error": "Video size exceeds maximum limit of 1024MB"
}
```

---

## Best Practices

### 1. Socket Connection Management

```javascript
// Reconnection handling
socket.on('disconnect', () => {
  console.log('Disconnected, attempting reconnect...');
});

socket.on('connect', () => {
  console.log('Connected!');
  // Re-sync state after reconnection
});

// Handle multiple devices
socket.on('forceDisconnect', (data) => {
  if (data.reason === 'max_connections') {
    // Show notification about other device
  }
});
```

### 2. Optimistic Updates

```javascript
// Send message with optimistic update
const tempId = Date.now().toString();
addMessageToUI({ ...message, _id: tempId, pending: true });

socket.emit('sendMessage', data, (response) => {
  if (response.status === 'success') {
    updateMessageId(tempId, response.message._id);
  } else {
    markMessageFailed(tempId);
  }
});
```

### 3. Typing Indicator Debounce

```javascript
let typingTimeout;

function handleTyping(receiverId) {
  if (!typingTimeout) {
    socket.emit('typing', { receiver: receiverId });
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stopTyping', { receiver: receiverId });
    typingTimeout = null;
  }, 2000);
}
```

### 4. Message Pagination

```javascript
async function loadMoreMessages(conversationId, lastMessageId) {
  const response = await fetch(
    `/api/v1/messages/conversation/${userId}/${otherId}?before=${lastMessageId}&limit=50`
  );
  return response.json();
}
```

### 5. Video Upload with Progress

```javascript
async function uploadVideo(file, receiverId, onProgress) {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('receiver', receiverId);

  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      onProgress(Math.round((e.loaded / e.total) * 100));
    }
  });

  return new Promise((resolve, reject) => {
    xhr.onload = () => resolve(JSON.parse(xhr.response));
    xhr.onerror = reject;
    xhr.open('POST', '/api/v1/messages/video');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}
```

---

## Process Flows

### Message Sending Flow

```
┌────────────┐     ┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Client   │────▶│   Socket    │────▶│   Server     │────▶│  MongoDB   │
│            │     │  sendMessage│     │  Validate    │     │   Save     │
└────────────┘     └─────────────┘     └──────────────┘     └────────────┘
                                               │
                                               ▼
┌────────────┐     ┌─────────────┐     ┌──────────────┐
│  Receiver  │◀────│   Socket    │◀────│   Emit to    │
│   Client   │     │ newMessage  │     │  user_room   │
└────────────┘     └─────────────┘     └──────────────┘
```

### Video Upload Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Video Upload Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. Client uploads video via multipart/form-data               │
│            │                                                    │
│            ▼                                                    │
│   2. Multer-S3 streams to DigitalOcean Spaces                  │
│            │                                                    │
│            ▼                                                    │
│   3. Server validates duration with ffprobe (max 10 min)       │
│            │                                                    │
│            ├── If invalid: Delete from S3, return error        │
│            │                                                    │
│            ▼                                                    │
│   4. Generate thumbnail at 1-second mark with ffmpeg           │
│            │                                                    │
│            ▼                                                    │
│   5. Upload thumbnail to S3                                    │
│            │                                                    │
│            ▼                                                    │
│   6. Create message in MongoDB with video + thumbnail URLs     │
│            │                                                    │
│            ▼                                                    │
│   7. Notify receiver via Socket.IO                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

*Last updated: January 2024*
