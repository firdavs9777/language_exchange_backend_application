# Chat Messages - Complete Frontend Guide

Complete guide for sending, editing, and deleting chat messages in BananaTalk.

---

## Table of Contents

1. [Send Message](#send-message)
2. [Edit Message](#edit-message)
3. [Delete Message](#delete-message)
4. [Reply to Message](#reply-to-message)
5. [Forward Message](#forward-message)
6. [Get Conversation](#get-conversation)
7. [Get Conversation Rooms](#get-conversation-rooms)
8. [Frontend Examples](#frontend-examples)
9. [Socket.IO Events](#socketio-events)

---

## Send Message

### Endpoint

```
POST /api/v1/messages
Authorization: Bearer <token>
Content-Type: multipart/form-data (if attachment) or application/json
```

### Request Body

#### Text Message
```json
{
  "message": "Hello! How are you?",
  "receiver": "507f191e810c19729de860eb"
}
```

#### Message with Image/Video Attachment
```javascript
// FormData
const formData = new FormData();
formData.append('message', 'Check out this photo!');
formData.append('receiver', '507f191e810c19729de860eb');
formData.append('attachment', file); // File object (image, video, document)
```

#### Reply to Message
```json
{
  "message": "Thanks for your message!",
  "receiver": "507f191e810c19729de860eb",
  "replyTo": "507f1f77bcf86cd799439011"
}
```

#### Forward Message
```json
{
  "message": "Check this out!",
  "receiver": "507f191e810c19729de860ec",
  "forwardedFrom": {
    "messageId": "507f1f77bcf86cd799439011"
  }
}
```

#### Message with Location
```json
{
  "message": "I'm here!",
  "receiver": "507f191e810c19729de860eb",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "address": "San Francisco, CA",
    "placeName": "Golden Gate Bridge"
  }
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "message": "Hello! How are you?",
    "sender": {
      "_id": "507f191e810c19729de860ea",
      "name": "John Doe",
      "images": ["https://..."],
      "imageUrls": ["https://..."]
    },
    "receiver": {
      "_id": "507f191e810c19729de860eb",
      "name": "Jane Smith",
      "images": ["https://..."],
      "imageUrls": ["https://..."]
    },
    "media": {
      "url": "https://my-projects-media.sfo3.digitaloceanspaces.com/bananatalk/messages/1234567890-image.jpg",
      "type": "image",
      "fileName": "image.jpg",
      "fileSize": 102400,
      "mimeType": "image/jpeg"
    },
    "replyTo": null,
    "isForwarded": false,
    "location": null,
    "read": false,
    "readAt": null,
    "isEdited": false,
    "isDeleted": false,
    "createdAt": "2024-01-01T15:30:00.000Z",
    "updatedAt": "2024-01-01T15:30:00.000Z"
  }
}
```

### Error Responses

#### 400 - Missing Fields
```json
{
  "success": false,
  "error": "Message content, attachment, or location is required"
}
```

#### 404 - Receiver Not Found
```json
{
  "success": false,
  "error": "Receiver not found"
}
```

#### 403 - Blocked User
```json
{
  "success": false,
  "error": "Cannot send message to this user"
}
```

#### 403 - Rate Limit Exceeded
```json
{
  "success": false,
  "error": "Message limit reached",
  "limit": {
    "type": "messages",
    "current": 50,
    "max": 50,
    "resetAt": "2024-01-02T00:00:00.000Z"
  }
}
```

---

## Edit Message

### Endpoint

```
PUT /api/v1/messages/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

```json
{
  "message": "Updated message text"
}
```

### Constraints

- ✅ Only sender can edit
- ✅ Can only edit within **15 minutes** of creation
- ✅ Cannot edit deleted messages
- ✅ Max length: 2000 characters
- ✅ Cannot edit attachments/media

### Success Response

```json
{
  "success": true,
  "message": "Message edited successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "message": "Updated message text",
    "sender": "507f191e810c19729de860ea",
    "receiver": "507f191e810c19729de860eb",
    "isEdited": true,
    "editedAt": "2024-01-01T15:30:00.000Z",
    "createdAt": "2024-01-01T15:20:00.000Z"
  }
}
```

### Error Responses

#### 404 - Message Not Found
```json
{
  "success": false,
  "error": "Message not found"
}
```

#### 403 - Not Authorized
```json
{
  "success": false,
  "error": "Not authorized to edit this message"
}
```

#### 400 - Time Limit Exceeded
```json
{
  "success": false,
  "error": "Message can only be edited within 15 minutes"
}
```

#### 400 - Message Deleted
```json
{
  "success": false,
  "error": "Cannot edit deleted message"
}
```

---

## Delete Message

### Endpoint

```
DELETE /api/v1/messages/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

```json
{
  "deleteForEveryone": true  // or false for "delete for me"
}
```

### Delete Types

1. **Delete for Me** (`deleteForEveryone: false`)
   - Only removes message from your view
   - Works anytime (no time limit)
   - Other user still sees the message

2. **Delete for Everyone** (`deleteForEveryone: true`)
   - Removes message from both users
   - Only works within **1 hour** of creation
   - Replaces message with "This message was deleted"

### Success Response

#### Delete for Everyone
```json
{
  "success": true,
  "message": "Message deleted for everyone",
  "data": {}
}
```

#### Delete for Me Only
```json
{
  "success": true,
  "message": "Message deleted for you",
  "data": {}
}
```

### Error Responses

#### 404 - Message Not Found
```json
{
  "success": false,
  "error": "Message not found"
}
```

#### 403 - Not Authorized
```json
{
  "success": false,
  "error": "Not authorized to delete this message"
}
```

#### 400 - Time Limit Exceeded
```json
{
  "success": false,
  "error": "Message can only be deleted for everyone within 1 hour"
}
```

---

## Reply to Message

### Endpoint

```
POST /api/v1/messages/:id/reply
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

```json
{
  "message": "This is my reply",
  "receiver": "507f191e810c19729de860eb"
}
```

### Success Response

```json
{
  "success": true,
  "message": "Reply sent successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "message": "This is my reply",
    "sender": {...},
    "receiver": {...},
    "replyTo": {
      "_id": "507f1f77bcf86cd799439011",
      "message": "Original message",
      "sender": {...}
    },
    "createdAt": "2024-01-01T16:00:00.000Z"
  }
}
```

---

## Forward Message

### Endpoint

```
POST /api/v1/messages/:id/forward
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

```json
{
  "receivers": [
    "507f191e810c19729de860eb",
    "507f191e810c19729de860ec"
  ]
}
```

**Note:** `receivers` is an array - you can forward to multiple users at once.

### Success Response

```json
{
  "success": true,
  "message": "Message forwarded to 2 recipient(s)",
  "data": {
    "forwarded": 2,
    "errors": []
  }
}
```

---

## Get Conversation

### Endpoint

```
GET /api/v1/messages/conversation/:senderId/:receiverId
Authorization: Bearer <token>
```

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "message": "Hello!",
      "sender": {
        "_id": "507f191e810c19729de860ea",
        "name": "John Doe",
        "images": ["https://..."],
        "imageUrls": ["https://..."]
      },
      "receiver": {
        "_id": "507f191e810c19729de860eb",
        "name": "Jane Smith",
        "images": ["https://..."],
        "imageUrls": ["https://..."]
      },
      "read": false,
      "createdAt": "2024-01-01T15:00:00.000Z"
    }
  ]
}
```

---

## Get Conversation Rooms

### Endpoint

```
GET /api/v1/messages/conversations
Authorization: Bearer <token>
```

Returns a list of all conversations (chat rooms) for the current user.

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "sender": {...},
      "receiver": {...},
      "participants": [...],
      "lastMessage": "Latest message text",
      "createdAt": "2024-01-01T15:30:00.000Z"
    }
  ]
}
```

---

## Frontend Examples

### React Native / TypeScript

#### Send Text Message

```typescript
const sendMessage = async (
  receiverId: string,
  text: string
) => {
  try {
    const response = await fetch('/api/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: text,
        receiver: receiverId
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('Message sent:', result.data);
      
      // Emit Socket.IO event for real-time update
      socket.emit('sendMessage', result.data);
      
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};
```

#### Send Message with Image

```typescript
const sendImageMessage = async (
  receiverId: string,
  imageUri: string,
  caption?: string
) => {
  try {
    const formData = new FormData();
    formData.append('message', caption || '');
    formData.append('receiver', receiverId);
    formData.append('attachment', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'image.jpg'
    } as any);

    const response = await fetch('/api/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type - let FormData handle it
      },
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error sending image:', error);
    throw error;
  }
};
```

#### Edit Message

```typescript
const editMessage = async (
  messageId: string,
  newText: string
) => {
  try {
    const response = await fetch(`/api/v1/messages/${messageId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: newText })
    });

    const result = await response.json();

    if (result.success) {
      console.log('Message edited:', result.data);
      return result.data;
    } else {
      if (result.error.includes('15 minutes')) {
        alert('Message can only be edited within 15 minutes');
      }
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error editing message:', error);
    throw error;
  }
};

// Check if message can be edited
const canEditMessage = (message: { createdAt: string }) => {
  const messageTime = new Date(message.createdAt).getTime();
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;
  return (now - messageTime) < fifteenMinutes;
};
```

#### Delete Message

```typescript
const deleteMessage = async (
  messageId: string,
  deleteForEveryone: boolean = false
) => {
  try {
    const response = await fetch(`/api/v1/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ deleteForEveryone })
    });

    const result = await response.json();

    if (result.success) {
      console.log('Message deleted:', result.message);
      return result.data;
    } else {
      if (result.error.includes('1 hour')) {
        alert('Can only delete for everyone within 1 hour');
      }
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
};

// Show delete options
const showDeleteOptions = async (message: any) => {
  const options = [
    { label: 'Delete for me', value: false }
  ];

  // Check if "delete for everyone" is still available
  const messageTime = new Date(message.createdAt).getTime();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const canDeleteForEveryone = (now - messageTime) < oneHour;

  if (canDeleteForEveryone) {
    options.push({ label: 'Delete for everyone', value: true });
  }

  const selected = await showActionSheet(options);

  if (selected !== null) {
    await deleteMessage(message._id, selected.value);
  }
};
```

#### Reply to Message

```typescript
const replyToMessage = async (
  originalMessageId: string,
  receiverId: string,
  replyText: string
) => {
  try {
    const response = await fetch(`/api/v1/messages/${originalMessageId}/reply`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: replyText,
        receiver: receiverId
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('Reply sent:', result.data);
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error replying to message:', error);
    throw error;
  }
};
```

#### Forward Message

```typescript
const forwardMessage = async (
  messageId: string,
  receiverIds: string[]
) => {
  try {
    const response = await fetch(`/api/v1/messages/${messageId}/forward`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        receivers: receiverIds
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log(`Forwarded to ${result.data.forwarded} recipients`);
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error forwarding message:', error);
    throw error;
  }
};
```

#### Get Conversation

```typescript
const getConversation = async (
  senderId: string,
  receiverId: string
) => {
  try {
    const response = await fetch(
      `/api/v1/messages/conversation/${senderId}/${receiverId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const result = await response.json();

    if (result.success) {
      return result.data; // Array of messages
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error fetching conversation:', error);
    throw error;
  }
};
```

#### Get Conversation Rooms

```typescript
const getConversationRooms = async () => {
  try {
    const response = await fetch('/api/v1/messages/conversations', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (result.success) {
      return result.data; // Array of conversation rooms
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
};
```

---

## Socket.IO Events

### Events to Listen For

#### 1. New Message Received

```typescript
socket.on('newMessage', (data) => {
  console.log('New message received:', data.message);
  console.log('Unread count:', data.unreadCount);
  console.log('Sender ID:', data.senderId);
  console.log('Has media:', data.hasMedia);
  console.log('Media type:', data.mediaType);
  
  // Update your chat UI
  addMessageToChat(data.message);
  updateUnreadCount(data.unreadCount);
  
  // Show notification if app is in background
  if (data.hasMedia) {
    showNotification(`${data.message.sender.name} sent a ${data.mediaType}`);
  } else {
    showNotification(`${data.message.sender.name}: ${data.message.message}`);
  }
});
```

**Event Data:**
```typescript
{
  message: Message,        // Full message object
  unreadCount: number,      // Total unread messages from this sender
  senderId: string,        // Sender's user ID
  hasMedia: boolean,       // Whether message has attachment
  mediaType: string | null // 'image' | 'video' | 'audio' | 'document' | null
}
```

#### 2. Message Sent Confirmation (Other Devices)

```typescript
socket.on('messageSent', (data) => {
  console.log('Message sent on another device:', data.message);
  console.log('Receiver ID:', data.receiverId);
  console.log('Unread count:', data.unreadCount);
  
  // Sync message across your devices
  addMessageToChat(data.message);
  updateUnreadCount(data.unreadCount);
});
```

**Event Data:**
```typescript
{
  message: Message,        // Full message object
  receiverId: string,       // Receiver's user ID
  unreadCount: number,      // Unread count for this conversation
  hasMedia: boolean,
  mediaType: string | null
}
```

#### 3. Message Edited

```typescript
socket.on('messageEdited', (data) => {
  console.log('Message edited:', data.messageId);
  console.log('New text:', data.message.message);
  console.log('Edited at:', data.editedAt);
  console.log('Edited by:', data.editedBy);
  
  // Update message in chat UI
  updateMessageInChat(data.messageId, {
    message: data.message.message,
    isEdited: true,
    editedAt: data.editedAt
  });
  
  // Show "edited" indicator
  showEditedIndicator(data.messageId);
});
```

**Event Data:**
```typescript
{
  messageId: string,       // ID of edited message
  message: Message,        // Updated message object
  editedAt: Date,         // When it was edited
  editedBy: string        // User ID who edited it
}
```

#### 4. Message Deleted

```typescript
socket.on('messageDeleted', (data) => {
  console.log('Message deleted:', data.messageId);
  console.log('Deleted for everyone:', data.deletedForEveryone);
  console.log('Deleted by:', data.deletedBy);
  
  if (data.deletedForEveryone) {
    // Message deleted for everyone - replace with "deleted" placeholder
    updateMessageInChat(data.messageId, {
      message: 'This message was deleted',
      isDeleted: true,
      deletedAt: data.deletedAt
    });
  } else {
    // Message deleted for me only - remove from my view
    removeMessageFromChat(data.messageId);
  }
});
```

**Event Data:**
```typescript
{
  messageId: string,           // ID of deleted message
  deletedForEveryone: boolean, // true = deleted for all, false = deleted for me
  deletedBy: string,          // User ID who deleted it
  deletedAt?: Date,           // When it was deleted (if for everyone)
  message?: Message,          // Updated message (if for everyone)
  deletedFor?: 'me'           // Only present if deletedForEveryone is false
}
```

#### 5. Messages Read (Read Receipts)

```typescript
socket.on('messagesRead', (data) => {
  console.log('Messages read by:', data.readBy);
  console.log('Count:', data.count);
  
  // Update read receipts in chat
  markMessagesAsRead(data.readBy, data.count);
  updateReadReceipts(data.readBy);
});
```

**Event Data:**
```typescript
{
  readBy: string,  // User ID who read the messages
  count: number    // Number of messages marked as read
}
```

#### 6. Typing Indicators

```typescript
// User started typing
socket.on('userTyping', (data) => {
  console.log('User typing:', data.userId);
  showTypingIndicator(data.userId);
});

// User stopped typing
socket.on('userStoppedTyping', (data) => {
  console.log('User stopped typing:', data.userId);
  hideTypingIndicator(data.userId);
});
```

**Event Data:**
```typescript
{
  userId: string,   // User ID who is typing
  isTyping: boolean  // true = typing, false = stopped
}
```

#### 7. User Status Updates

```typescript
socket.on('userStatusUpdate', (data) => {
  console.log('User status:', data.userId, data.status);
  updateUserStatus(data.userId, {
    status: data.status,      // 'online' | 'away' | 'busy' | 'offline'
    lastSeen: data.lastSeen   // ISO date string or null
  });
});
```

**Event Data:**
```typescript
{
  userId: string,      // User ID
  status: string,      // 'online' | 'away' | 'busy' | 'offline'
  lastSeen: string | null  // ISO date string or null
}
```

---

### Events to Emit

#### 1. Send Message (Optional - Use API Instead)

```typescript
// Note: It's recommended to use the HTTP API for sending messages
// This socket event is for real-time sync only

socket.emit('sendMessage', {
  receiver: receiverId,
  message: 'Hello!',
  text: 'Hello!'  // Alternative field name
}, (response) => {
  if (response.status === 'success') {
    console.log('Message sent via socket:', response.message);
  } else {
    console.error('Socket send error:', response.error);
  }
});
```

#### 2. Mark Messages as Read

```typescript
socket.emit('markAsRead', {
  senderId: senderId
}, (response) => {
  if (response.status === 'success') {
    console.log('Marked as read:', response.markedCount);
  }
});
```

#### 3. Typing Indicators

```typescript
// User started typing
socket.emit('typing', {
  receiver: receiverId,
  receiverId: receiverId  // Alternative field name
});

// User stopped typing
socket.emit('stopTyping', {
  receiver: receiverId
});
```

#### 4. Update Status

```typescript
socket.emit('updateStatus', {
  status: 'away'  // 'online' | 'away' | 'busy' | 'offline'
});

// Or use shortcuts
socket.emit('setOnline');
socket.emit('setAway');
socket.emit('setBusy');
```

---

### Complete Socket.IO Setup Example

```typescript
import { io } from 'socket.io-client';

class ChatSocketService {
  private socket: any;
  private token: string;

  constructor(token: string) {
    this.token = token;
    this.socket = io('https://api.banatalk.com', {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to chat server');
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('❌ Disconnected:', reason);
    });

    // Message events
    this.socket.on('newMessage', (data: any) => {
      this.handleNewMessage(data);
    });

    this.socket.on('messageSent', (data: any) => {
      this.handleMessageSent(data);
    });

    this.socket.on('messageEdited', (data: any) => {
      this.handleMessageEdited(data);
    });

    this.socket.on('messageDeleted', (data: any) => {
      this.handleMessageDeleted(data);
    });

    this.socket.on('messagesRead', (data: any) => {
      this.handleMessagesRead(data);
    });

    // Typing events
    this.socket.on('userTyping', (data: any) => {
      this.handleUserTyping(data);
    });

    this.socket.on('userStoppedTyping', (data: any) => {
      this.handleUserStoppedTyping(data);
    });

    // Status events
    this.socket.on('userStatusUpdate', (data: any) => {
      this.handleUserStatusUpdate(data);
    });

    this.socket.on('onlineUsers', (users: any[]) => {
      this.handleOnlineUsers(users);
    });
  }

  // Event handlers
  private handleNewMessage(data: any) {
    // Add message to chat
    // Update unread count
    // Show notification
  }

  private handleMessageEdited(data: any) {
    // Update message in chat UI
    // Show "edited" indicator
  }

  private handleMessageDeleted(data: any) {
    if (data.deletedForEveryone) {
      // Replace message with "deleted" placeholder
    } else {
      // Remove message from view
    }
  }

  private handleMessagesRead(data: any) {
    // Update read receipts
    // Mark messages as read
  }

  private handleUserTyping(data: any) {
    // Show typing indicator
  }

  private handleUserStoppedTyping(data: any) {
    // Hide typing indicator
  }

  private handleUserStatusUpdate(data: any) {
    // Update user status in UI
  }

  private handleOnlineUsers(users: any[]) {
    // Update online users list
  }

  // Public methods
  public sendTyping(receiverId: string) {
    this.socket.emit('typing', { receiver: receiverId });
  }

  public stopTyping(receiverId: string) {
    this.socket.emit('stopTyping', { receiver: receiverId });
  }

  public markAsRead(senderId: string) {
    this.socket.emit('markAsRead', { senderId });
  }

  public updateStatus(status: 'online' | 'away' | 'busy' | 'offline') {
    this.socket.emit('updateStatus', { status });
  }

  public disconnect() {
    this.socket.disconnect();
  }
}

// Usage
const chatSocket = new ChatSocketService(userToken);
```

---

## UI/UX Best Practices

### Edit Button Visibility

```typescript
// Show edit button only if:
// - User is the sender
// - Within 15 minutes
// - Message is not deleted
// - Message has text (not media-only)

const canEdit = (message: any, userId: string) => {
  if (message.sender?._id !== userId && message.sender !== userId) {
    return false;
  }

  if (message.isDeleted) {
    return false;
  }

  if (!message.message || message.message.trim().length === 0) {
    return false; // Can't edit media-only messages
  }

  const messageTime = new Date(message.createdAt).getTime();
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;
  return (now - messageTime) < fifteenMinutes;
};
```

### Delete Options Menu

```typescript
const getDeleteOptions = (message: any, userId: string) => {
  const options = [];

  // Only sender can delete
  if (message.sender?._id !== userId && message.sender !== userId) {
    return []; // Can't delete
  }

  options.push({ label: 'Delete for me', value: 'deleteForMe' });

  // Check if "delete for everyone" is still available
  const messageTime = new Date(message.createdAt).getTime();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  if ((now - messageTime) < oneHour) {
    options.push({ label: 'Delete for everyone', value: 'deleteForEveryone' });
  }

  return options;
};
```

### Display Edited Messages

```typescript
// Show "edited" indicator
const MessageBubble = ({ message }) => {
  return (
    <View>
      <Text>{message.message}</Text>
      {message.isEdited && (
        <Text style={styles.editedLabel}>
          Edited {formatTime(message.editedAt)}
        </Text>
      )}
    </View>
  );
};
```

### Display Deleted Messages

```typescript
// Show deleted message placeholder
const MessageBubble = ({ message, currentUserId }) => {
  if (message.isDeleted) {
    return (
      <View style={styles.deletedMessage}>
        <Text style={styles.deletedText}>
          This message was deleted
        </Text>
      </View>
    );
  }
  
  // Regular message
  return <Text>{message.message}</Text>;
};
```

---

## Summary

| Action | Endpoint | Method | Time Limit | Who Can Do It |
|--------|----------|--------|------------|---------------|
| Send Message | `/messages` | POST | Rate limited | Authenticated users |
| Edit Message | `/messages/:id` | PUT | 15 minutes | Sender only |
| Delete (for me) | `/messages/:id` | DELETE | None | Sender only |
| Delete (for everyone) | `/messages/:id` | DELETE | 1 hour | Sender only |
| Reply | `/messages/:id/reply` | POST | Rate limited | Authenticated users |
| Forward | `/messages/:id/forward` | POST | Rate limited | Authenticated users |

---

## Socket.IO Events Quick Reference

### Events You Listen To (Server → Client)

| Event | When It Fires | Data |
|-------|---------------|------|
| `newMessage` | New message received | `{ message, unreadCount, senderId, hasMedia, mediaType }` |
| `messageSent` | Message sent on another device | `{ message, receiverId, unreadCount }` |
| `messageEdited` | Message was edited | `{ messageId, message, editedAt, editedBy }` |
| `messageDeleted` | Message was deleted | `{ messageId, deletedForEveryone, deletedBy, deletedAt, message? }` |
| `messagesRead` | Messages were read | `{ readBy, count }` |
| `userTyping` | User started typing | `{ userId, isTyping: true }` |
| `userStoppedTyping` | User stopped typing | `{ userId, isTyping: false }` |
| `userStatusUpdate` | User status changed | `{ userId, status, lastSeen }` |
| `onlineUsers` | List of online users | `Array<{ userId, status, lastSeen }>` |

### Events You Emit (Client → Server)

| Event | Purpose | Data |
|-------|---------|------|
| `sendMessage` | Send message via socket (optional) | `{ receiver, message }` |
| `markAsRead` | Mark messages as read | `{ senderId }` |
| `typing` | Indicate user is typing | `{ receiver }` |
| `stopTyping` | Indicate user stopped typing | `{ receiver }` |
| `updateStatus` | Update user status | `{ status }` |

### Socket.IO Connection

```typescript
const socket = io('https://api.banatalk.com', {
  auth: {
    token: 'your-jwt-token'
  },
  transports: ['websocket', 'polling']
});
```

**Important:** Always authenticate with JWT token in `auth.token` field.

---

## Quick Reference

### Time Limits
- **Edit**: 15 minutes from creation
- **Delete for everyone**: 1 hour from creation
- **Delete for me**: No limit

### File Uploads
- Supported: Images, Videos, Documents, Audio
- Max size: 10MB (configured on backend)
- Stored in: DigitalOcean Spaces

### Rate Limits
- **Visitor**: Limited messages per day
- **Regular**: More messages per day
- **VIP**: Unlimited

Check the error response for exact limits and reset time.

### Socket.IO Real-Time Updates

When you edit or delete a message via HTTP API:
- ✅ **Edit**: Both users receive `messageEdited` event
- ✅ **Delete (for everyone)**: Both users receive `messageDeleted` event
- ✅ **Delete (for me)**: Only your other devices receive `messageDeleted` event

**No need to manually emit socket events** - the backend handles it automatically!

