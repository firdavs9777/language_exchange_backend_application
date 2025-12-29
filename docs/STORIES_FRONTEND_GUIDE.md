# BananaTalk Stories - Complete Frontend Implementation Guide

This guide covers all story features including the new additions: reactions, replies, polls, highlights, close friends, and more.

---

## Table of Contents

1. [Story Object Schema](#story-object-schema)
2. [Basic Story Operations](#basic-story-operations)
3. [Story Reactions](#story-reactions)
4. [Story Replies](#story-replies)
5. [Story Polls](#story-polls)
6. [Story Question Box](#story-question-box)
7. [Story Sharing](#story-sharing)
8. [Story Highlights](#story-highlights)
9. [Story Archive](#story-archive)
10. [Close Friends](#close-friends)
11. [Socket.IO Events](#socketio-events)
12. [Creating Stories with Features](#creating-stories-with-features)
13. [UI Components Needed](#ui-components-needed)

---

## Story Object Schema

```typescript
interface Story {
  _id: string;
  user: User;
  
  // Media
  mediaUrl: string;           // Legacy single URL
  mediaUrls: string[];        // Multiple media (use this)
  mediaType: 'image' | 'video' | 'text';
  
  // Text story
  text?: string;
  backgroundColor: string;    // Hex color
  textColor: string;          // Hex color
  fontStyle: 'normal' | 'bold' | 'italic' | 'handwriting';
  
  // Privacy
  privacy: 'public' | 'friends' | 'close_friends';
  
  // Views
  views: Array<{
    user: User;
    viewedAt: Date;
    viewDuration?: number;
  }>;
  viewCount: number;
  
  // Reactions (NEW)
  reactions: Array<{
    user: User;
    emoji: string;
    reactedAt: Date;
  }>;
  reactionCount: number;
  
  // Replies (NEW)
  replies: Array<{
    user: User;
    message: Message;
    repliedAt: Date;
  }>;
  replyCount: number;
  
  // Mentions (NEW)
  mentions: Array<{
    user: User;
    username: string;
    position: { x: number; y: number };  // 0-100 percentage
  }>;
  
  // Location (NEW)
  location?: {
    name: string;
    address: string;
    coordinates: {
      type: 'Point';
      coordinates: [number, number];  // [lng, lat]
    };
    placeId?: string;
  };
  
  // Link sticker (NEW)
  link?: {
    url: string;
    title: string;
    displayText: string;  // "Learn More", "Shop Now"
  };
  
  // Poll (NEW)
  poll?: {
    question: string;
    options: Array<{
      text: string;
      votes: string[];
      voteCount: number;
    }>;
    isAnonymous: boolean;
    expiresAt?: Date;
  };
  
  // Question box (NEW)
  questionBox?: {
    prompt: string;  // "Ask me anything!"
    responses: Array<{
      user: User;
      text: string;
      respondedAt: Date;
      isAnonymous: boolean;
    }>;
  };
  
  // Music (NEW)
  music?: {
    trackId: string;
    title: string;
    artist: string;
    coverUrl: string;
    previewUrl: string;
    startTime: number;
    duration: number;
  };
  
  // Hashtags (NEW)
  hashtags: string[];
  
  // Highlight reference (NEW)
  highlight?: StoryHighlight;
  
  // Archive (NEW)
  isArchived: boolean;
  archivedAt?: Date;
  
  // Shares (NEW)
  shares: Array<{
    user: User;
    sharedTo: 'dm' | 'story' | 'external';
    sharedAt: Date;
  }>;
  shareCount: number;
  
  // Settings
  allowReplies: boolean;
  allowSharing: boolean;
  
  // Status
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
}
```

---

## Basic Story Operations

### Get Stories Feed

```javascript
GET /api/v1/stories/feed
Authorization: Bearer <token>

// Response
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "user_id",
      "user": { ... },
      "stories": [ ... ],
      "hasUnviewed": 3,
      "latestStory": { ... }
    }
  ]
}
```

### Get My Stories

```javascript
GET /api/v1/stories/my-stories
Authorization: Bearer <token>
```

### Get User's Stories

```javascript
GET /api/v1/stories/user/:userId
Authorization: Bearer <token>

// If blocked:
{
  "success": true,
  "count": 0,
  "data": [],
  "blocked": true,
  "message": "Content not available"
}
```

### Create Story

```javascript
POST /api/v1/stories
Authorization: Bearer <token>
Content-Type: multipart/form-data

// Form Data:
media: File[]              // Up to 5 files
text: string               // For text stories
backgroundColor: string    // Hex color (#000000)
textColor: string          // Hex color (#ffffff)
privacy: string            // 'public' | 'friends' | 'close_friends'

// For advanced features, include as JSON:
poll: JSON.stringify({
  question: "What's for lunch?",
  options: ["Pizza", "Sushi", "Tacos"]
})

questionBox: JSON.stringify({
  prompt: "Ask me anything!"
})

location: JSON.stringify({
  name: "Central Park",
  address: "New York, NY",
  coordinates: { type: "Point", coordinates: [-73.9654, 40.7829] }
})

link: JSON.stringify({
  url: "https://example.com",
  title: "My Website",
  displayText: "Visit Now"
})

mentions: JSON.stringify([
  { user: "user_id", username: "john", position: { x: 50, y: 30 } }
])

hashtags: JSON.stringify(["travel", "food", "nyc"])

music: JSON.stringify({
  trackId: "spotify:track:xxx",
  title: "Song Name",
  artist: "Artist",
  coverUrl: "https://...",
  previewUrl: "https://..."
})
```

### Delete Story

```javascript
DELETE /api/v1/stories/:id
Authorization: Bearer <token>
```

### Mark Story as Viewed

```javascript
POST /api/v1/stories/:id/view
Authorization: Bearer <token>

Body:
{
  "viewDuration": 5  // Optional: seconds spent viewing
}
```

### Get Story Viewers (Owner Only)

```javascript
GET /api/v1/stories/:id/views
Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "viewCount": 45,
    "views": [
      {
        "user": { "_id": "...", "name": "John", "images": [...] },
        "viewedAt": "2024-01-01T12:00:00.000Z",
        "viewDuration": 5
      }
    ]
  }
}
```

---

## Story Reactions

Quick emoji reactions to stories (like Instagram/Snapchat).

### React to Story

```javascript
POST /api/v1/stories/:id/react
Authorization: Bearer <token>

Body:
{
  "emoji": "❤️"  // Any emoji
}

// Response
{
  "success": true,
  "data": {
    "reactionCount": 15,
    "userReaction": "❤️"
  }
}
```

### Remove Reaction

```javascript
DELETE /api/v1/stories/:id/react
Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "reactionCount": 14,
    "userReaction": null
  }
}
```

### Get Story Reactions (Owner Only)

```javascript
GET /api/v1/stories/:id/reactions
Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "reactionCount": 15,
    "reactions": [
      {
        "user": { "_id": "...", "name": "John", "images": [...] },
        "emoji": "❤️",
        "reactedAt": "2024-01-01T12:00:00.000Z"
      }
    ]
  }
}
```

### Common Reaction Emojis

```javascript
const STORY_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '🔥', '👏', '🎉', '💯', '👀'];
```

---

## Story Replies

Replies are sent as DMs to the story owner.

### Reply to Story

```javascript
POST /api/v1/stories/:id/reply
Authorization: Bearer <token>

Body:
{
  "message": "Love this! Where was this taken?"
}

// Response
{
  "success": true,
  "data": {
    "message": {
      "_id": "msg_id",
      "sender": { ... },
      "message": "Love this! Where was this taken?",
      "createdAt": "..."
    },
    "replyCount": 3
  }
}
```

The owner receives both:
1. `storyReply` socket event
2. `newMessage` socket event with `isStoryReply: true`

---

## Story Polls

Interactive polls in stories.

### Create Story with Poll

```javascript
// When creating story, include poll data:
poll: JSON.stringify({
  question: "Where should we go?",
  options: ["Beach", "Mountains", "City"],
  isAnonymous: false
})
```

### Vote on Poll

```javascript
POST /api/v1/stories/:id/poll/vote
Authorization: Bearer <token>

Body:
{
  "optionIndex": 0  // Index of selected option
}

// Response
{
  "success": true,
  "data": {
    "poll": {
      "question": "Where should we go?",
      "options": [
        { "index": 0, "text": "Beach", "voteCount": 15, "percentage": 50, "voted": true },
        { "index": 1, "text": "Mountains", "voteCount": 10, "percentage": 33, "voted": false },
        { "index": 2, "text": "City", "voteCount": 5, "percentage": 17, "voted": false }
      ]
    }
  }
}
```

---

## Story Question Box

Allow followers to ask questions (AMA style).

### Create Story with Question Box

```javascript
// When creating story, include:
questionBox: JSON.stringify({
  prompt: "Ask me anything about my trip! 🌴"
})
```

### Answer a Question

```javascript
POST /api/v1/stories/:id/question/answer
Authorization: Bearer <token>

Body:
{
  "text": "What was the best food you had?",
  "isAnonymous": false  // Optional
}

// Response
{
  "success": true,
  "message": "Answer submitted"
}
```

### Get Responses (Owner Only)

```javascript
GET /api/v1/stories/:id/question/responses
Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "prompt": "Ask me anything about my trip!",
    "responses": [
      {
        "user": { ... },  // null if anonymous
        "text": "What was the best food?",
        "respondedAt": "...",
        "isAnonymous": false
      }
    ]
  }
}
```

---

## Story Sharing

### Share Story

```javascript
POST /api/v1/stories/:id/share
Authorization: Bearer <token>

Body:
{
  "sharedTo": "dm",        // 'dm' | 'story' | 'external'
  "receiverId": "user_id"  // Required if sharedTo is 'dm'
}

// Response
{
  "success": true,
  "data": {
    "shareCount": 10
  }
}
```

---

## Story Highlights

Save stories permanently on profile.

### Create Highlight

```javascript
POST /api/v1/stories/highlights
Authorization: Bearer <token>

Body:
{
  "title": "Travel 2024",
  "storyId": "story_id",      // Optional: start with this story
  "coverImage": "https://..."  // Optional: custom cover
}

// Response
{
  "success": true,
  "data": {
    "_id": "highlight_id",
    "title": "Travel 2024",
    "coverImage": "...",
    "storyCount": 1,
    "stories": [...]
  }
}
```

### Get My Highlights

```javascript
GET /api/v1/stories/highlights
Authorization: Bearer <token>
```

### Get User's Highlights

```javascript
GET /api/v1/stories/highlights/user/:userId
Authorization: Bearer <token>
```

### Add Story to Highlight

```javascript
POST /api/v1/stories/highlights/:highlightId/stories
Authorization: Bearer <token>

Body:
{
  "storyId": "story_id"
}
```

### Remove Story from Highlight

```javascript
DELETE /api/v1/stories/highlights/:highlightId/stories/:storyId
Authorization: Bearer <token>
```

### Update Highlight

```javascript
PUT /api/v1/stories/highlights/:id
Authorization: Bearer <token>

Body:
{
  "title": "New Title",
  "coverImage": "https://..."
}
```

### Delete Highlight

```javascript
DELETE /api/v1/stories/highlights/:id
Authorization: Bearer <token>
```

---

## Story Archive

View your old/expired stories.

### Get Archived Stories

```javascript
GET /api/v1/stories/archive?page=1&limit=20
Authorization: Bearer <token>

// Response
{
  "success": true,
  "count": 20,
  "total": 150,
  "pages": 8,
  "data": [
    {
      "_id": "story_id",
      "mediaUrls": [...],
      "createdAt": "...",
      "archivedAt": "...",
      "viewCount": 45
    }
  ]
}
```

### Archive Story Manually

```javascript
POST /api/v1/stories/:id/archive
Authorization: Bearer <token>

// Response
{
  "success": true,
  "message": "Story archived"
}
```

---

## Close Friends

Manage close friends list for private stories.

### Get Close Friends List

```javascript
GET /api/v1/stories/close-friends
Authorization: Bearer <token>

// Response
{
  "success": true,
  "count": 15,
  "data": [
    {
      "_id": "user_id",
      "name": "John Doe",
      "images": [...],
      "bio": "..."
    }
  ]
}
```

### Add to Close Friends

```javascript
POST /api/v1/stories/close-friends/:userId
Authorization: Bearer <token>

// Response
{
  "success": true,
  "message": "Added to close friends"
}
```

### Remove from Close Friends

```javascript
DELETE /api/v1/stories/close-friends/:userId
Authorization: Bearer <token>

// Response
{
  "success": true,
  "message": "Removed from close friends"
}
```

---

## Socket.IO Events

### Events to Listen For

#### Story Reaction Received

```javascript
socket.on('storyReaction', (data) => {
  console.log('New reaction on story:', data.storyId);
  console.log('Reaction:', data.reaction);
  console.log('Total reactions:', data.reactionCount);
  
  // Update UI: show reaction animation, update count
});
```

#### Story Reply Received

```javascript
socket.on('storyReply', (data) => {
  console.log('Reply to story:', data.storyId);
  console.log('Message:', data.message);
  console.log('Total replies:', data.replyCount);
  
  // This also comes as a 'newMessage' event
});

// Also listen for message with story reference
socket.on('newMessage', (data) => {
  if (data.isStoryReply) {
    console.log('This message is a reply to story:', data.storyId);
  }
});
```

#### Poll Vote Received (Owner)

```javascript
socket.on('storyPollVote', (data) => {
  console.log('Poll vote on story:', data.storyId);
  console.log('Updated results:', data.pollResults);
  
  // Update poll UI with new percentages
});
```

#### Question Answer Received (Owner)

```javascript
socket.on('storyQuestionAnswer', (data) => {
  console.log('Question answer on story:', data.storyId);
  console.log('Answer:', data.answer);
  
  // Show notification that someone answered
});
```

---

## Creating Stories with Features

### Full Story Creation Example

```javascript
const createStory = async (formData) => {
  const data = new FormData();
  
  // Media files
  formData.files.forEach(file => {
    data.append('media', file);
  });
  
  // Basic fields
  data.append('text', formData.text);
  data.append('backgroundColor', formData.backgroundColor);
  data.append('textColor', formData.textColor);
  data.append('privacy', formData.privacy);
  
  // Poll (optional)
  if (formData.poll) {
    data.append('poll', JSON.stringify({
      question: formData.poll.question,
      options: formData.poll.options,
      isAnonymous: formData.poll.isAnonymous
    }));
  }
  
  // Question box (optional)
  if (formData.questionBox) {
    data.append('questionBox', JSON.stringify({
      prompt: formData.questionBox.prompt
    }));
  }
  
  // Location (optional)
  if (formData.location) {
    data.append('location', JSON.stringify({
      name: formData.location.name,
      address: formData.location.address,
      coordinates: {
        type: 'Point',
        coordinates: [formData.location.lng, formData.location.lat]
      }
    }));
  }
  
  // Link (optional)
  if (formData.link) {
    data.append('link', JSON.stringify({
      url: formData.link.url,
      title: formData.link.title,
      displayText: formData.link.displayText
    }));
  }
  
  // Mentions (optional)
  if (formData.mentions?.length > 0) {
    data.append('mentions', JSON.stringify(formData.mentions));
  }
  
  // Hashtags (optional)
  if (formData.hashtags?.length > 0) {
    data.append('hashtags', JSON.stringify(formData.hashtags));
  }
  
  // Music (optional)
  if (formData.music) {
    data.append('music', JSON.stringify(formData.music));
  }
  
  const response = await api.post('/stories', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  return response.data;
};
```

---

## UI Components Needed

### Story Viewer Screen

- [ ] Tap left/right to navigate
- [ ] Progress bar at top
- [ ] User info header
- [ ] Swipe up for link (if present)
- [ ] Reply input at bottom
- [ ] Reaction quick-pick bar
- [ ] Poll UI overlay
- [ ] Question box overlay
- [ ] Location sticker
- [ ] Mention tags (tappable)
- [ ] Music info bar

### Story Creation Screen

- [ ] Camera/Gallery picker
- [ ] Text tool with fonts
- [ ] Background color picker
- [ ] Sticker tray:
  - [ ] Poll sticker
  - [ ] Question sticker
  - [ ] Location sticker
  - [ ] Mention sticker
  - [ ] Link sticker
  - [ ] Music sticker
- [ ] Privacy selector (Public/Friends/Close Friends)
- [ ] Hashtag input
- [ ] Close friends indicator (green circle)

### Profile Highlights

- [ ] Highlight circles below bio
- [ ] Create new highlight button
- [ ] Highlight viewer (like stories)
- [ ] Edit highlight modal
- [ ] Add to highlight option after viewing own story

### Close Friends Management

- [ ] Close friends list screen
- [ ] Add/remove toggle per user
- [ ] Search followers
- [ ] Green badge indicator

### Story Archive

- [ ] Calendar/grid view of old stories
- [ ] Preview thumbnails
- [ ] Option to add to highlight
- [ ] Option to repost

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/stories/feed` | Get stories feed |
| `GET` | `/stories/my-stories` | Get my active stories |
| `POST` | `/stories` | Create story |
| `GET` | `/stories/:id` | Get single story |
| `DELETE` | `/stories/:id` | Delete story |
| `POST` | `/stories/:id/view` | Mark as viewed |
| `GET` | `/stories/:id/views` | Get viewers (owner) |
| `POST` | `/stories/:id/react` | React to story |
| `DELETE` | `/stories/:id/react` | Remove reaction |
| `GET` | `/stories/:id/reactions` | Get reactions (owner) |
| `POST` | `/stories/:id/reply` | Reply to story |
| `POST` | `/stories/:id/poll/vote` | Vote on poll |
| `POST` | `/stories/:id/question/answer` | Answer question |
| `GET` | `/stories/:id/question/responses` | Get answers (owner) |
| `POST` | `/stories/:id/share` | Share story |
| `POST` | `/stories/:id/archive` | Archive story |
| `GET` | `/stories/archive` | Get archived stories |
| `GET` | `/stories/highlights` | Get my highlights |
| `POST` | `/stories/highlights` | Create highlight |
| `GET` | `/stories/highlights/user/:userId` | Get user's highlights |
| `PUT` | `/stories/highlights/:id` | Update highlight |
| `DELETE` | `/stories/highlights/:id` | Delete highlight |
| `POST` | `/stories/highlights/:id/stories` | Add story to highlight |
| `DELETE` | `/stories/highlights/:id/stories/:storyId` | Remove from highlight |
| `GET` | `/stories/close-friends` | Get close friends |
| `POST` | `/stories/close-friends/:userId` | Add close friend |
| `DELETE` | `/stories/close-friends/:userId` | Remove close friend |

---

## Questions?

Refer to the backend controller files for detailed implementation or contact the backend team.

