# Chat Features API Documentation for Frontend Developers

This document provides comprehensive information about all modern chat features implemented in the backend, including media sharing, user blocking, message management, real-time features, and more.

---

## Table of Contents

1. [Media Sharing](#1-media-sharing)
2. [User Blocking](#2-user-blocking)
3. [Message Management](#3-message-management)
4. [Real-time Features (Socket.IO)](#4-real-time-features-socketio)
5. [Conversation Management](#5-conversation-management)
6. [Message Search](#6-message-search)
7. [Message Reactions](#7-message-reactions)
8. [Location Sharing](#8-location-sharing)

---

## 1. Media Sharing

### Overview
Users can now send images, audio files, videos, and documents along with text messages. Media files are automatically validated, processed, and stored.

### Supported Media Types

| Type | Formats | Max Size | Notes |
|------|---------|----------|-------|
| Image | JPEG, PNG, GIF, WEBP | 10MB | Thumbnails generated automatically |
| Audio | MP3, M4A, WAV, AAC | 25MB | Duration extraction (future) |
| Video | MP4, MOV, AVI | 100MB | Thumbnail generation (future) |
| Document | PDF, DOC, DOCX, TXT | 50MB | - |

### 1.1. Send Message with Media

**Endpoint**: `POST /api/v1/messages`  
**Access**: Private  
**Content-Type**: `multipart/form-data`

**Request Body**:
```
message: "Optional text message"
receiver: "userId"
file: <file> (optional, for media)
```

**Example (JavaScript/Fetch)**:
```javascript
const formData = new FormData();
formData.append('message', 'Check this out!');
formData.append('receiver', 'userId123');
formData.append('file', fileInput.files[0]); // File from input

const response = await fetch('/api/v1/messages', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "_id": "messageId",
    "message": "Check this out!",
    "sender": { /* user object */ },
    "receiver": { /* user object */ },
    "media": {
      "url": "http://host/uploads/message-123-image.jpg",
      "type": "image",
      "thumbnail": "http://host/uploads/message-123-thumb.jpg",
      "fileName": "photo.jpg",
      "fileSize": 245678,
      "mimeType": "image/jpeg",
      "dimensions": {
        "width": 1920,
        "height": 1080
      }
    },
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Media-Only Messages**: You can send media without text by omitting the `message` field:
```javascript
formData.append('receiver', 'userId123');
formData.append('file', fileInput.files[0]);
// No message field
```

**Error Responses**:
- `400 Bad Request`: Invalid file type, file too large, or missing required fields
- `401 Unauthorized`: Invalid or missing authentication token
- `403 Forbidden`: User is blocked or cannot send message
- `429 Too Many Requests`: Daily message limit exceeded

---

## 2. User Blocking

### Overview
Users can block other users to prevent them from sending messages. Blocked users cannot message each other, and their messages are filtered from conversations.

### 2.1. Block a User

**Endpoint**: `POST /api/v1/users/:userId/block`  
**Access**: Private

**Request Body** (optional):
```json
{
  "reason": "Harassment" // Optional reason for blocking
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "User blocked successfully",
  "data": {
    "blockedUserId": "userId",
    "blockedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### 2.2. Unblock a User

**Endpoint**: `DELETE /api/v1/users/:userId/block`  
**Access**: Private

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "User unblocked successfully",
  "data": {
    "unblockedUserId": "userId"
  }
}
```

### 2.3. Get Blocked Users List

**Endpoint**: `GET /api/v1/users/:userId/blocked`  
**Access**: Private (users can only view their own blocked list)

**Success Response (200 OK)**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "userId": "blockedUserId1",
      "user": { /* user object */ },
      "blockedAt": "2025-01-15T10:30:00.000Z",
      "reason": "Harassment"
    }
  ]
}
```

### 2.4. Check Block Status

**Endpoint**: `GET /api/v1/users/:userId/block-status/:targetUserId`  
**Access**: Private

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "isBlocked": false,
    "isBlockedBy": false,
    "canMessage": true
  }
}
```

**Frontend Implementation Notes**:
- Check `canMessage` before allowing message sending
- Show appropriate UI when users are blocked
- Filter blocked users from conversation lists
- Display block status in user profiles

---

## 3. Message Management

### 3.1. Edit Message

**Endpoint**: `PUT /api/v1/messages/:id`  
**Access**: Private (only sender can edit)

**Request Body**:
```json
{
  "message": "Updated message text"
}
```

**Constraints**:
- Only the sender can edit
- Can only edit within 15 minutes of creation
- Cannot edit deleted messages
- Maximum 2000 characters

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Message edited successfully",
  "data": {
    "_id": "messageId",
    "message": "Updated message text",
    "isEdited": true,
    "editedAt": "2025-01-15T10:35:00.000Z",
    /* ... other fields ... */
  }
}
```

**Frontend Display**: Show "edited" indicator when `isEdited` is `true`.

### 3.2. Delete Message

**Endpoint**: `DELETE /api/v1/messages/:id`  
**Access**: Private (only sender can delete)

**Request Body**:
```json
{
  "deleteForEveryone": true // or false for "delete for me"
}
```

**Constraints**:
- "Delete for everyone" only works within 1 hour of creation
- "Delete for me" works anytime
- Media files are deleted when "delete for everyone" is used

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Message deleted for everyone",
  "data": {}
}
```

### 3.3. Reply to Message

**Endpoint**: `POST /api/v1/messages/:id/reply`  
**Access**: Private

**Request Body**:
```json
{
  "message": "This is a reply",
  "receiver": "userId"
}
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "Reply sent successfully",
  "data": {
    "_id": "replyMessageId",
    "message": "This is a reply",
    "replyTo": {
      "_id": "originalMessageId",
      "message": "Original message",
      "sender": { /* user object */ }
    },
    "sender": { /* user object */ },
    "receiver": { /* user object */ }
  }
}
```

**Frontend Display**: Show original message preview when displaying replies.

### 3.4. Forward Message

**Endpoint**: `POST /api/v1/messages/:id/forward`  
**Access**: Private

**Request Body**:
```json
{
  "receivers": ["userId1", "userId2", "userId3"]
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Message forwarded to 3 recipient(s)",
  "data": {
    "forwarded": 3,
    "errors": [] // Array of errors if any receivers failed
  }
}
```

### 3.5. Pin Message

**Endpoint**: `POST /api/v1/messages/:id/pin`  
**Access**: Private (participants can pin)

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Message pinned",
  "data": {
    "_id": "messageId",
    "pinned": true,
    "pinnedAt": "2025-01-15T10:30:00.000Z",
    "pinnedBy": "userId"
  }
}
```

### 3.6. Get Message Replies

**Endpoint**: `GET /api/v1/messages/:id/replies?page=1&limit=20`  
**Access**: Private

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20, max: 100)

**Success Response (200 OK)**:
```json
{
  "success": true,
  "count": 5,
  "total": 5,
  "data": [
    { /* reply message objects */ }
  ]
}
```

---

## 4. Real-time Features (Socket.IO)

### Overview
Real-time features are handled via Socket.IO. Connect to the Socket.IO server and listen for events.

### 4.1. Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://your-server-url', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('connect', () => {
  console.log('Connected to server');
});
```

### 4.2. Typing Indicators

**Emit Event**: `typingStart`
```javascript
socket.emit('typingStart', {
  receiverId: 'userId'
});
```

**Emit Event**: `typingStop`
```javascript
socket.emit('typingStop', {
  receiverId: 'userId'
});
```

**Listen Event**: `userTyping`
```javascript
socket.on('userTyping', (data) => {
  console.log('User typing:', data);
  // data: { userId: 'userId', isTyping: true/false }
  
  if (data.isTyping) {
    // Show typing indicator
  } else {
    // Hide typing indicator
  }
});
```

**Note**: Typing automatically stops after 3 seconds of inactivity.

### 4.3. Online/Offline Status

**Listen Event**: `userOnline`
```javascript
socket.on('userOnline', (data) => {
  // data: { userId: 'userId' }
  // Update UI to show user as online
});
```

**Listen Event**: `userOffline`
```javascript
socket.on('userOffline', (data) => {
  // data: { userId: 'userId' }
  // Update UI to show user as offline
});
```

### 4.4. Message Read Receipts

**Emit Event**: `markMessageRead`
```javascript
socket.emit('markMessageRead', {
  messageId: 'messageId'
});
```

**Listen Event**: `messageRead`
```javascript
socket.on('messageRead', (data) => {
  // data: { messageId: 'messageId', readBy: 'userId', readAt: Date }
  // Update message status to "read"
});
```

**Listen Event**: `messagesRead` (bulk read)
```javascript
socket.on('messagesRead', (data) => {
  // data: { readBy: 'userId', count: 5 }
  // Mark multiple messages as read
});
```

### 4.5. Message Reactions (Real-time)

**Emit Event**: `addReaction`
```javascript
socket.emit('addReaction', {
  messageId: 'messageId',
  emoji: '👍'
});
```

**Emit Event**: `removeReaction`
```javascript
socket.emit('removeReaction', {
  messageId: 'messageId',
  emoji: '👍'
});
```

**Listen Event**: `messageReaction`
```javascript
socket.on('messageReaction', (data) => {
  // data: { messageId: 'messageId', reactions: [...] }
  // Update message reactions in UI
});
```

### 4.6. New Message (Real-time)

**Listen Event**: `newMessage`
```javascript
socket.on('newMessage', (data) => {
  // data: { 
  //   message: { /* message object */ },
  //   conversationId: 'conversationId',
  //   unreadCount: 5
  // }
  // Add message to conversation UI
  // Update unread count
});
```

---

## 5. Conversation Management

### 5.1. Get All Conversations

**Endpoint**: `GET /api/v1/conversations?archived=false&muted=false&pinned=false`  
**Access**: Private

**Query Parameters**:
- `archived` (optional): `true`/`false` to filter archived conversations
- `muted` (optional): `true`/`false` to filter muted conversations
- `pinned` (optional): `true`/`false` to filter pinned conversations

**Success Response (200 OK)**:
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "_id": "conversationId",
      "participants": [ /* user objects */ ],
      "otherParticipant": { /* user object */ },
      "lastMessage": { /* message object */ },
      "lastMessageAt": "2025-01-15T10:30:00.000Z",
      "unreadCount": 5,
      "isMuted": false,
      "isPinned": true,
      "isArchived": false
    }
  ]
}
```

### 5.2. Get Single Conversation

**Endpoint**: `GET /api/v1/conversations/:id`  
**Access**: Private

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "_id": "conversationId",
    "participants": [ /* user objects */ ],
    "otherParticipant": { /* user object */ },
    "lastMessage": { /* message object */ },
    "unreadCount": 5
  }
}
```

### 5.3. Mute Conversation

**Endpoint**: `POST /api/v1/conversations/:id/mute`  
**Access**: Private

**Request Body** (optional):
```json
{
  "duration": 3600000 // Duration in milliseconds (optional, null = permanent)
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Conversation muted successfully",
  "data": { /* conversation object */ }
}
```

### 5.4. Unmute Conversation

**Endpoint**: `POST /api/v1/conversations/:id/unmute`  
**Access**: Private

### 5.5. Archive Conversation

**Endpoint**: `POST /api/v1/conversations/:id/archive`  
**Access**: Private

### 5.6. Unarchive Conversation

**Endpoint**: `POST /api/v1/conversations/:id/unarchive`  
**Access**: Private

### 5.7. Pin Conversation

**Endpoint**: `POST /api/v1/conversations/:id/pin`  
**Access**: Private

### 5.8. Unpin Conversation

**Endpoint**: `POST /api/v1/conversations/:id/unpin`  
**Access**: Private

### 5.9. Mark Conversation as Read

**Endpoint**: `PUT /api/v1/conversations/:id/read`  
**Access**: Private

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Conversation marked as read",
  "data": { /* conversation object */ }
}
```

**Note**: This also marks all messages in the conversation as read.

---

## 6. Message Search

### 6.1. Search Messages

**Endpoint**: `GET /api/v1/messages/search`  
**Access**: Private

**Query Parameters**:
- `q` (optional): Search query (searches in message content and file names)
- `conversationId` (optional): Filter by conversation
- `senderId` (optional): Filter by sender
- `receiverId` (optional): Filter by receiver
- `mediaType` (optional): Filter by media type (`image`, `audio`, `video`, `document`)
- `dateFrom` (optional): Start date (ISO 8601)
- `dateTo` (optional): End date (ISO 8601)
- `hasMedia` (optional): `true`/`false` to filter messages with/without media
- `isPinned` (optional): `true`/`false` to filter pinned messages
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20, max: 100)

**Example Request**:
```
GET /api/v1/messages/search?q=hello&mediaType=image&page=1&limit=20
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "count": 10,
  "total": 25,
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "limit": 20,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "data": [
    { /* message objects with matching search criteria */ }
  ]
}
```

---

## 7. Message Reactions

### 7.1. Add Reaction

**Endpoint**: `POST /api/v1/messages/:id/reactions`  
**Access**: Private

**Request Body**:
```json
{
  "emoji": "👍"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Reaction added successfully",
  "data": [
    {
      "user": { /* user object */ },
      "emoji": "👍"
    }
  ]
}
```

**Note**: Each user can have only one reaction per message. Adding a new reaction replaces the previous one.

### 7.2. Remove Reaction

**Endpoint**: `DELETE /api/v1/messages/:id/reactions/:emoji`  
**Access**: Private

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Reaction removed successfully",
  "data": [ /* remaining reactions */ ]
}
```

### 7.3. Get Message Reactions

**Endpoint**: `GET /api/v1/messages/:id/reactions`  
**Access**: Private

**Success Response (200 OK)**:
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "user": { /* user object */ },
      "emoji": "👍"
    },
    {
      "user": { /* user object */ },
      "emoji": "❤️"
    }
  ]
}
```

---

## 8. Location Sharing

### 8.1. Send Location

**Endpoint**: `POST /api/v1/messages`  
**Access**: Private

**Request Body**:
```json
{
  "receiver": "userId",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "New York, NY, USA",
    "placeName": "Times Square"
  }
}
```

**Note**: `address` and `placeName` are optional. `message` field is also optional when sending location.

**Success Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "_id": "messageId",
    "receiver": "userId",
    "media": {
      "type": "location",
      "location": {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "address": "New York, NY, USA",
        "placeName": "Times Square"
      }
    },
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Frontend Implementation**:
- Use device geolocation API to get coordinates
- Optionally reverse geocode to get address
- Display location on map (Google Maps, Mapbox, etc.)

---

## Error Handling

### Common Error Responses

**400 Bad Request**:
```json
{
  "success": false,
  "error": "Message content, media, or location is required",
  "statusCode": 400
}
```

**401 Unauthorized**:
```json
{
  "success": false,
  "error": "Not authenticated",
  "statusCode": 401
}
```

**403 Forbidden**:
```json
{
  "success": false,
  "error": "Cannot send message to this user",
  "statusCode": 403
}
```

**404 Not Found**:
```json
{
  "success": false,
  "error": "Message not found",
  "statusCode": 404
}
```

**429 Too Many Requests** (Daily Limit Exceeded):
```json
{
  "success": false,
  "error": "Daily limit for messages exceeded. You can create 50 messages per day. Try again after 12:00:00 AM 10/27/2023.",
  "statusCode": 429,
  "data": {
    "limitType": "message",
    "current": 50,
    "max": 50,
    "resetTime": "2023-10-27T00:00:00.000Z"
  }
}
```

---

## Best Practices

### 1. Media Upload
- Compress images before upload (client-side) to reduce file size
- Show upload progress indicator
- Validate file type and size before upload
- Handle upload errors gracefully

### 2. Real-time Features
- Reconnect Socket.IO on disconnect
- Show connection status to users
- Debounce typing indicators (don't send on every keystroke)
- Handle offline scenarios

### 3. Message Display
- Show "edited" indicator for edited messages
- Display "This message was deleted" for deleted messages
- Show reply previews with original message
- Indicate forwarded messages
- Display pinned messages prominently

### 4. Blocking
- Check block status before showing message input
- Filter blocked users from user lists
- Show appropriate UI when blocked
- Allow unblocking from blocked users list

### 5. Search
- Debounce search queries
- Show loading state during search
- Handle pagination properly
- Clear search results when needed

### 6. Performance
- Paginate conversation lists
- Lazy load messages in conversations
- Cache frequently accessed data
- Optimize image loading (lazy load, thumbnails)

---

## Testing Checklist

- [ ] Send text message
- [ ] Send image message
- [ ] Send audio message
- [ ] Send video message
- [ ] Send document
- [ ] Send location
- [ ] Block user
- [ ] Unblock user
- [ ] Try messaging blocked user (should fail)
- [ ] Edit message (within 15 minutes)
- [ ] Delete message (for me)
- [ ] Delete message (for everyone)
- [ ] Reply to message
- [ ] Forward message
- [ ] Pin message
- [ ] Add reaction
- [ ] Remove reaction
- [ ] Mute conversation
- [ ] Archive conversation
- [ ] Pin conversation
- [ ] Search messages
- [ ] Typing indicators (Socket.IO)
- [ ] Online/offline status (Socket.IO)
- [ ] Read receipts (Socket.IO)
- [ ] Message reactions (Socket.IO)

---

## Additional Notes

1. **Media URLs**: All media URLs are automatically generated and include the full host path. Use them directly in `<img>`, `<audio>`, `<video>`, or download links.

2. **Conversation Updates**: Conversations are automatically created/updated when messages are sent. No need to manually create conversations.

3. **Unread Counts**: Unread counts are automatically managed. Use the `unreadCount` field in conversation objects.

4. **Blocking**: Blocking is bidirectional - if User A blocks User B, User B cannot message User A either.

5. **Message Limits**: Daily message limits still apply to all message types (text, media, location). VIP users have unlimited messages.

6. **Socket.IO Authentication**: Ensure JWT token is included in Socket.IO connection auth object.

7. **Error Handling**: Always handle errors gracefully and show user-friendly error messages.

---

**Last Updated**: January 2025  
**Version**: 1.0.0

