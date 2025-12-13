# Stories API Response Examples

Simple examples of what the frontend should expect from story endpoints.

---

## Get My Stories

**Endpoint:** `GET /api/v1/stories/my-stories`  
**Auth:** Required

### Success Response (with stories)

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "user": {
        "_id": "507f191e810c19729de860ea",
        "name": "John Doe",
        "email": "john@example.com",
        "images": ["https://...", "https://..."],
        "imageUrls": ["https://...", "https://..."],
        "bio": "Language learner",
        "native_language": "English",
        "language_to_learn": "Korean"
      },
      "mediaUrl": "https://my-projects-media.sfo3.digitaloceanspaces.com/bananatalk/stories/1234567890-image.jpg",
      "mediaUrls": [
        "https://my-projects-media.sfo3.digitaloceanspaces.com/bananatalk/stories/1234567890-image.jpg"
      ],
      "mediaType": "image",
      "text": "Beautiful sunset! 🌅",
      "backgroundColor": "#FF6B6B",
      "textColor": "#FFFFFF",
      "privacy": "friends",
      "viewCount": 15,
      "reactionCount": 3,
      "replyCount": 2,
      "isActive": true,
      "expiresAt": "2024-01-02T12:00:00.000Z",
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "user": {
        "_id": "507f191e810c19729de860ea",
        "name": "John Doe",
        "email": "john@example.com",
        "images": ["https://..."],
        "imageUrls": ["https://..."],
        "bio": "Language learner",
        "native_language": "English",
        "language_to_learn": "Korean"
      },
      "mediaUrl": "https://my-projects-media.sfo3.digitaloceanspaces.com/bananatalk/stories/1234567891-video.mp4",
      "mediaUrls": [
        "https://my-projects-media.sfo3.digitaloceanspaces.com/bananatalk/stories/1234567891-video.mp4"
      ],
      "mediaType": "video",
      "text": null,
      "backgroundColor": "#000000",
      "textColor": "#FFFFFF",
      "privacy": "close_friends",
      "viewCount": 5,
      "reactionCount": 1,
      "replyCount": 0,
      "isActive": true,
      "expiresAt": "2024-01-02T14:00:00.000Z",
      "createdAt": "2024-01-01T14:00:00.000Z",
      "updatedAt": "2024-01-01T14:00:00.000Z"
    }
  ],
  "message": "Stories retrieved successfully"
}
```

### Success Response (no stories)

```json
{
  "success": true,
  "count": 0,
  "data": [],
  "message": "No active stories found"
}
```

### Error Response

```json
{
  "error": "Server error",
  "message": "Error: ..."
}
```

---

## Get Stories Feed

**Endpoint:** `GET /api/v1/stories/feed`  
**Auth:** Required

### Success Response

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "507f191e810c19729de860ea",
      "user": {
        "_id": "507f191e810c19729de860ea",
        "name": "Jane Smith",
        "images": ["https://..."],
        "imageUrls": ["https://..."]
      },
      "stories": [
        {
          "_id": "507f1f77bcf86cd799439011",
          "mediaUrl": "https://...",
          "mediaUrls": ["https://..."],
          "mediaType": "image",
          "text": "Hello!",
          "createdAt": "2024-01-01T12:00:00.000Z",
          "viewCount": 10
        }
      ],
      "hasUnviewed": 1,
      "latestStory": {
        "_id": "507f1f77bcf86cd799439011",
        "mediaUrl": "https://...",
        "createdAt": "2024-01-01T12:00:00.000Z"
      }
    }
  ],
  "debug": {
    "blockedUsersCount": 2,
    "followingCount": 48,
    "totalStoriesFound": 45,
    "userStoryGroups": 3
  }
}
```

---

## Get User Stories

**Endpoint:** `GET /api/v1/stories/user/:userId`  
**Auth:** Required

### Success Response

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "user": {
        "_id": "507f191e810c19729de860ea",
        "name": "Jane Smith",
        "images": ["https://..."],
        "imageUrls": ["https://..."]
      },
      "mediaUrl": "https://...",
      "mediaUrls": ["https://..."],
      "mediaType": "image",
      "text": "My story!",
      "viewCount": 5,
      "createdAt": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

### Blocked User Response

```json
{
  "success": true,
  "count": 0,
  "data": [],
  "blocked": true,
  "message": "Content not available"
}
```

---

## Frontend Usage Example

```typescript
// React Native / TypeScript
const fetchMyStories = async () => {
  try {
    const response = await fetch('/api/v1/stories/my-stories', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`Found ${result.count} stories`);
      
      if (result.count === 0) {
        console.log('No active stories');
        return [];
      }
      
      return result.data.map(story => ({
        id: story._id,
        mediaUrl: story.mediaUrl,
        mediaUrls: story.mediaUrls,
        mediaType: story.mediaType,
        text: story.text,
        backgroundColor: story.backgroundColor,
        textColor: story.textColor,
        viewCount: story.viewCount,
        createdAt: story.createdAt,
        user: {
          id: story.user._id,
          name: story.user.name,
          imageUrl: story.user.imageUrls?.[0] || null
        }
      }));
    }
    
    throw new Error(result.message || 'Failed to fetch stories');
  } catch (error) {
    console.error('Error fetching stories:', error);
    return [];
  }
};
```

---

## Common Issues & Solutions

### Issue: `data` is empty array
- **Check:** Are stories expired? (24 hours)
- **Check:** Is `isActive: true`?
- **Check:** Console logs for debugging

### Issue: `user` is null or missing
- **Check:** User population in query
- **Check:** User exists in database

### Issue: `mediaUrl` is null
- **Check:** Story has `mediaUrls` array
- **Check:** First item in `mediaUrls` array

### Issue: Response format mismatch
- **Always check:** `result.success` first
- **Always check:** `result.count` for array length
- **Use:** `result.data` for the stories array

---

## Console Logs Reference

When calling the API, check server logs for:

```
📚 [Get My Stories] User: 507f191e810c19729de860ea
📚 [Get My Stories] Found 2 active stories
📚 [Get My Stories] Returning 2 stories
📚 [Get My Stories] Sample story: { _id: '...', mediaUrl: '...', hasUser: true, userId: '...' }
```

These logs help debug what's happening on the backend.

