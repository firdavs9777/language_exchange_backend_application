# Edit, Delete & Message Functionality - Frontend Guide

Complete guide for editing, deleting content, and sending messages in BananaTalk.

---

## Table of Contents

1. [Edit Moment](#edit-moment)
2. [Delete Moment](#delete-moment)
3. [Edit Message](#edit-message)
4. [Delete Message](#delete-message)
5. [Create/Send Message](#createsend-message)
6. [Error Handling](#error-handling)
7. [Frontend Examples](#frontend-examples)

---

## Edit Moment

### Endpoint

```
PUT /api/v1/moments/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

```json
{
  "text": "Updated moment text",
  "category": "travel",
  "language": "korean",
  "mood": "happy",
  "tags": ["travel", "seoul"],
  "location": {
    "coordinates": [-122.4194, 37.7749],
    "formattedAddress": "San Francisco, CA, USA",
    "city": "San Francisco",
    "state": "California",
    "country": "USA"
  },
  "privacy": "public"
}
```

**Note:** Cannot update `user`, `images`, `likes`, `comments`, or `createdAt` fields.

### Success Response

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "text": "Updated moment text",
    "user": {
      "_id": "507f191e810c19729de860ea",
      "name": "John Doe",
      "images": ["https://..."]
    },
    "images": ["https://..."],
    "category": "travel",
    "language": "korean",
    "mood": "happy",
    "tags": ["travel", "seoul"],
    "likeCount": 10,
    "commentCount": 5,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T15:30:00.000Z"
  }
}
```

### Error Responses

#### 404 - Moment Not Found
```json
{
  "success": false,
  "error": "Moment not found"
}
```

#### 403 - Not Authorized
```json
{
  "success": false,
  "error": "Not authorized to update this moment"
}
```

#### 400 - Validation Error
```json
{
  "success": false,
  "error": "Validation error",
  "details": {
    "text": "Text is required",
    "category": "Invalid category"
  }
}
```

---

## Delete Moment

### Endpoint

```
DELETE /api/v1/moments/:id
Authorization: Bearer <token>
```

### Request Body

None (empty body)

### Success Response

```json
{
  "success": true,
  "data": {},
  "message": "Moment deleted successfully"
}
```

### Error Responses

#### 404 - Moment Not Found
```json
{
  "success": false,
  "error": "Moment not found with id of 507f1f77bcf86cd799439011"
}
```

#### 403 - Not Authorized
```json
{
  "success": false,
  "error": "Not authorized to delete this moment"
}
```

**Note:** All associated images are automatically deleted from DigitalOcean Spaces.

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

**Important Constraints:**
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

#### 400 - Edit Time Limit Exceeded
```json
{
  "success": false,
  "error": "Message can only be edited within 15 minutes"
}
```

#### 400 - Message Too Long
```json
{
  "success": false,
  "error": "Message cannot exceed 2000 characters"
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

**Delete Types:**
- `deleteForEveryone: true` - Deletes for both sender and receiver (only within **1 hour**)
- `deleteForEveryone: false` - Only deletes for the current user (can delete anytime)

**Important Constraints:**
- ✅ Only sender can delete
- ✅ "Delete for everyone" only works within **1 hour** of creation
- ✅ "Delete for me" works anytime

### Success Response

#### Delete for Everyone
```json
{
  "success": true,
  "message": "Message deleted for everyone",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "isDeleted": true,
    "deletedAt": "2024-01-01T15:30:00.000Z",
    "deletedFor": ["sender_id", "receiver_id"],
    "message": "This message was deleted"
  }
}
```

#### Delete for Me Only
```json
{
  "success": true,
  "message": "Message deleted for you",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "deletedFor": ["sender_id"]
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

## Create/Send Message

### Endpoint

```
POST /api/v1/messages
Authorization: Bearer <token>
Content-Type: multipart/form-data  // or application/json (if no attachment)
```

### Request Body

#### Text Message Only
```json
{
  "message": "Hello! How are you?",
  "receiver": "507f191e810c19729de860eb"
}
```

#### Message with Attachment
```javascript
// FormData
const formData = new FormData();
formData.append('message', 'Check out this image!');
formData.append('receiver', '507f191e810c19729de860eb');
formData.append('attachment', file); // File object
```

#### Reply to Message
```json
{
  "message": "Thanks for your message!",
  "receiver": "507f191e810c19729de860eb",
  "replyTo": "507f1f77bcf86cd799439011"  // Original message ID
}
```

#### Forward Message
```json
{
  "message": "Check this out!",
  "receiver": "507f191e810c19729de860ec",
  "forwardedFrom": "507f1f77bcf86cd799439011"  // Original message ID
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
    "address": "San Francisco, CA"
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
      "images": ["https://..."]
    },
    "receiver": {
      "_id": "507f191e810c19729de860eb",
      "name": "Jane Smith",
      "images": ["https://..."]
    },
    "media": {
      "url": "https://my-projects-media.sfo3.digitaloceanspaces.com/bananatalk/messages/1234567890-image.jpg",
      "type": "image",
      "fileName": "image.jpg",
      "fileSize": 102400,
      "mimeType": "image/jpeg"
    },
    "replyTo": null,
    "forwardedFrom": null,
    "location": null,
    "isRead": false,
    "readAt": null,
    "createdAt": "2024-01-01T15:30:00.000Z"
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

## Error Handling

### Common HTTP Status Codes

| Code | Meaning | When It Happens |
|------|---------|-----------------|
| `200` | Success | Operation completed successfully |
| `201` | Created | New resource created (e.g., message) |
| `400` | Bad Request | Validation error, missing fields, time limit exceeded |
| `401` | Unauthorized | Missing or invalid authentication token |
| `403` | Forbidden | Not authorized, blocked user, rate limit exceeded |
| `404` | Not Found | Resource doesn't exist |
| `500` | Server Error | Internal server error |

### Error Response Format

```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## Frontend Examples

### React Native / TypeScript Examples

#### Edit Moment

```typescript
const editMoment = async (momentId: string, updates: {
  text?: string;
  category?: string;
  tags?: string[];
}) => {
  try {
    const response = await fetch(`/api/v1/moments/${momentId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    const result = await response.json();

    if (result.success) {
      console.log('Moment updated:', result.data);
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error editing moment:', error);
    throw error;
  }
};

// Usage
await editMoment('507f1f77bcf86cd799439011', {
  text: 'Updated text',
  tags: ['travel', 'seoul']
});
```

#### Delete Moment

```typescript
const deleteMoment = async (momentId: string) => {
  try {
    const response = await fetch(`/api/v1/moments/${momentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (result.success) {
      console.log('Moment deleted:', result.message);
      return true;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error deleting moment:', error);
    throw error;
  }
};

// Usage with confirmation
const handleDeleteMoment = async (momentId: string) => {
  const confirmed = await showConfirmDialog('Delete this moment?');
  if (confirmed) {
    await deleteMoment(momentId);
    // Refresh moments list
  }
};
```

#### Edit Message

```typescript
const editMessage = async (messageId: string, newText: string) => {
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
      // Handle specific errors
      if (result.error.includes('15 minutes')) {
        alert('Message can only be edited within 15 minutes');
      } else {
        throw new Error(result.error);
      }
    }
  } catch (error) {
    console.error('Error editing message:', error);
    throw error;
  }
};

// Check if message can be edited (within 15 minutes)
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
      } else {
        throw new Error(result.error);
      }
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
};

// Usage with options
const handleDeleteMessage = async (messageId: string, message: any) => {
  const options = [
    { label: 'Delete for me', value: false },
    { label: 'Delete for everyone', value: true }
  ];

  // Check if "delete for everyone" is still available (within 1 hour)
  const messageTime = new Date(message.createdAt).getTime();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const canDeleteForEveryone = (now - messageTime) < oneHour;

  const selected = await showActionSheet(
    canDeleteForEveryone ? options : [options[0]]
  );

  if (selected !== null) {
    await deleteMessage(messageId, selected.value);
  }
};
```

#### Send Message

```typescript
const sendMessage = async (
  receiverId: string,
  message: string,
  options?: {
    attachment?: File;
    replyTo?: string;
    forwardedFrom?: string;
    location?: { latitude: number; longitude: number; address?: string };
  }
) => {
  try {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('receiver', receiverId);

    if (options?.attachment) {
      formData.append('attachment', {
        uri: options.attachment.uri,
        type: options.attachment.type,
        name: options.attachment.name
      });
    }

    if (options?.replyTo) {
      formData.append('replyTo', options.replyTo);
    }

    if (options?.forwardedFrom) {
      formData.append('forwardedFrom', options.forwardedFrom);
    }

    if (options?.location) {
      formData.append('location', JSON.stringify(options.location));
    }

    const response = await fetch('/api/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type - let browser set it with boundary for FormData
      },
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      console.log('Message sent:', result.data);
      
      // Emit socket event if using Socket.IO
      // socket.emit('sendMessage', result.data);
      
      return result.data;
    } else {
      // Handle rate limiting
      if (result.error.includes('limit')) {
        alert(`Message limit reached. Reset at ${result.limit.resetAt}`);
      } else {
        throw new Error(result.error);
      }
    }
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Usage examples

// Simple text message
await sendMessage('507f191e810c19729de860eb', 'Hello!');

// Message with image
await sendMessage('507f191e810c19729de860eb', 'Check this out!', {
  attachment: {
    uri: 'file:///path/to/image.jpg',
    type: 'image/jpeg',
    name: 'image.jpg'
  }
});

// Reply to message
await sendMessage('507f191e810c19729de860eb', 'Thanks!', {
  replyTo: '507f1f77bcf86cd799439011'
});

// Forward message
await sendMessage('507f191e810c19729de860ec', 'Check this out!', {
  forwardedFrom: '507f1f77bcf86cd799439011'
});

// Message with location
await sendMessage('507f191e810c19729de860eb', "I'm here!", {
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    address: 'San Francisco, CA'
  }
});
```

---

## UI/UX Best Practices

### Edit Button Visibility

```typescript
// Show edit button only if:
// - User owns the content
// - For messages: within 15 minutes
// - Content is not deleted

const canEdit = (item: any, userId: string) => {
  if (item.user?._id !== userId || item.user?._id?.toString() !== userId) {
    return false;
  }

  if (item.isDeleted) {
    return false;
  }

  // For messages, check time limit
  if (item.messageType === 'message') {
    const messageTime = new Date(item.createdAt).getTime();
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    return (now - messageTime) < fifteenMinutes;
  }

  return true;
};
```

### Delete Options Menu

```typescript
// Show different delete options based on content type and time

const getDeleteOptions = (item: any) => {
  const options = [];

  if (item.messageType === 'message') {
    // Messages can be deleted for me or for everyone
    options.push({ label: 'Delete for me', value: 'deleteForMe' });

    const messageTime = new Date(item.createdAt).getTime();
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    if ((now - messageTime) < oneHour) {
      options.push({ label: 'Delete for everyone', value: 'deleteForEveryone' });
    }
  } else {
    // Moments can only be deleted completely
    options.push({ label: 'Delete', value: 'delete' });
  }

  return options;
};
```

---

## Summary

| Action | Endpoint | Method | Auth | Time Limit |
|--------|----------|--------|------|------------|
| Edit Moment | `/moments/:id` | PUT | ✅ | None |
| Delete Moment | `/moments/:id` | DELETE | ✅ | None |
| Edit Message | `/messages/:id` | PUT | ✅ | 15 minutes |
| Delete Message | `/messages/:id` | DELETE | ✅ | 1 hour (for everyone) |
| Send Message | `/messages` | POST | ✅ | Rate limited |

