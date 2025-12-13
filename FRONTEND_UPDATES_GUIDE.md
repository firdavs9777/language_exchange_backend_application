# BananaTalk Frontend Updates Guide

This document outlines all the backend changes that require frontend updates.

---

## Table of Contents

1. [Blocking System](#1-blocking-system)
2. [Moments New Features](#2-moments-new-features)
3. [Stories Updates](#3-stories-updates)
4. [Comments Updates](#4-comments-updates)
5. [Advanced Chat Features](#5-advanced-chat-features)
6. [API Changes Summary](#6-api-changes-summary)

---

## 1. Blocking System

### What Changed
When a user blocks someone (or gets blocked), they can no longer see each other's content anywhere in the app.

### Frontend Requirements

#### Handle Blocked Content Responses

The backend now returns specific responses when content is blocked:

```javascript
// Moments from blocked user - returns empty array with blocked flag
{
  "success": true,
  "count": 0,
  "totalMoments": 0,
  "data": [],
  "blocked": true,
  "message": "Content not available"
}

// Single moment from blocked user - returns 403
{
  "success": false,
  "error": "This content is not available"
}

// Stories from blocked user
{
  "success": true,
  "count": 0,
  "data": [],
  "blocked": true,
  "message": "Content not available"
}
```

#### Update Your API Handler

```javascript
// Example: Handle blocked content gracefully
const fetchUserMoments = async (userId) => {
  try {
    const response = await api.get(`/moments/user/${userId}`);
    
    if (response.data.blocked) {
      // Show "Content not available" UI instead of empty state
      return { blocked: true, moments: [] };
    }
    
    return { blocked: false, moments: response.data.data };
  } catch (error) {
    if (error.response?.status === 403) {
      // User is blocked
      return { blocked: true, moments: [] };
    }
    throw error;
  }
};
```

#### UI Recommendations

1. **Profile Page**: Show "This content is not available" message instead of empty moments
2. **Feed**: Blocked users' content is automatically filtered - no change needed
3. **Direct Messages**: Show "You can't message this user" if blocked
4. **Comments**: Blocked users' comments are automatically hidden

---

## 2. Moments New Features

### 2.1 Save/Bookmark Moments

#### Endpoints

```
POST /api/v1/moments/:id/save      - Save a moment
DELETE /api/v1/moments/:id/save   - Unsave a moment
GET /api/v1/moments/saved         - Get saved moments
```

#### Implementation

```javascript
// Save a moment
const saveMoment = async (momentId) => {
  const response = await api.post(`/moments/${momentId}/save`);
  return response.data;
  // Response: { success: true, data: { _id, saveCount, isSaved: true } }
};

// Unsave a moment
const unsaveMoment = async (momentId) => {
  const response = await api.delete(`/moments/${momentId}/save`);
  return response.data;
  // Response: { success: true, data: { _id, saveCount, isSaved: false } }
};

// Get saved moments
const getSavedMoments = async (page = 1, limit = 10) => {
  const response = await api.get(`/moments/saved?page=${page}&limit=${limit}`);
  return response.data;
};
```

#### UI Components Needed

- Bookmark icon on each moment card (toggleable)
- "Saved" tab in user profile or menu
- Saved moments list screen

---

### 2.2 Share Moments

#### Endpoint

```
POST /api/v1/moments/:id/share
```

#### Implementation

```javascript
const shareMoment = async (momentId) => {
  // Track share in backend
  await api.post(`/moments/${momentId}/share`);
  
  // Use native share or copy link
  if (navigator.share) {
    await navigator.share({
      title: 'Check out this moment',
      url: `https://banatalk.com/moments/${momentId}`
    });
  } else {
    // Copy to clipboard
    await navigator.clipboard.writeText(`https://banatalk.com/moments/${momentId}`);
    showToast('Link copied!');
  }
};
```

---

### 2.3 Report Moments

#### Endpoint

```
POST /api/v1/moments/:id/report
```

#### Request Body

```json
{
  "reason": "spam",  // Required: spam, inappropriate, harassment, hate_speech, violence, misinformation, other
  "description": "Optional details about the report"
}
```

#### Implementation

```javascript
const reportMoment = async (momentId, reason, description = '') => {
  const response = await api.post(`/moments/${momentId}/report`, {
    reason,
    description
  });
  return response.data;
  // Response: { success: true, message: "Report submitted successfully..." }
};
```

#### UI Components Needed

- "Report" option in moment menu (3-dot menu)
- Report modal with reason selection:
  - Spam
  - Inappropriate content
  - Harassment
  - Hate speech
  - Violence
  - Misinformation
  - Other (with text input)
- Confirmation message after reporting

---

### 2.4 Trending Moments

#### Endpoint

```
GET /api/v1/moments/trending?page=1&limit=10
```

Returns moments sorted by likes + comments from the last 7 days.

#### Implementation

```javascript
const getTrendingMoments = async (page = 1, limit = 10) => {
  const response = await api.get(`/moments/trending?page=${page}&limit=${limit}`);
  return response.data;
};
```

#### UI: Add "Trending" tab in Explore/Discover section

---

### 2.5 Explore/Discover Moments

#### Endpoint

```
GET /api/v1/moments/explore?category=food&language=en&mood=happy&tags=travel,food
```

#### Query Parameters

| Parameter | Values |
|-----------|--------|
| `category` | general, language-learning, culture, food, travel, music, books, hobbies |
| `language` | ISO 639-1 codes (en, ko, ja, etc.) |
| `mood` | happy, excited, grateful, motivated, relaxed, curious |
| `tags` | Comma-separated tags |
| `page` | Page number |
| `limit` | Items per page |

#### Implementation

```javascript
const exploreMoments = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.category) params.append('category', filters.category);
  if (filters.language) params.append('language', filters.language);
  if (filters.mood) params.append('mood', filters.mood);
  if (filters.tags) params.append('tags', filters.tags.join(','));
  params.append('page', filters.page || 1);
  params.append('limit', filters.limit || 10);
  
  const response = await api.get(`/moments/explore?${params}`);
  return response.data;
};
```

#### UI Components Needed

- Explore/Discover screen with filter chips
- Category selector
- Language filter
- Mood filter
- Tag search

---

### 2.6 Updated Moment Object

The Moment object now includes additional fields:

```typescript
interface Moment {
  // ... existing fields ...
  
  // NEW FIELDS
  savedBy: string[];      // User IDs who saved this moment
  saveCount: number;      // Total saves
  shareCount: number;     // Total shares
  isSaved?: boolean;      // True if current user saved it (in saved list)
  
  // Soft delete (admin use)
  isDeleted: boolean;
  deletedAt?: Date;
}
```

---

## 3. Stories Updates

### Blocking Applied

Stories from blocked users are automatically hidden. No frontend changes needed - just handle empty states gracefully.

```javascript
// If user is blocked, stories endpoint returns:
{
  "success": true,
  "count": 0,
  "data": [],
  "blocked": true,
  "message": "Content not available"
}
```

---

## 4. Comments Updates

### Blocking Applied

Comments from blocked users are automatically filtered out. The frontend receives a clean list without blocked users' comments.

### Error Handling

When trying to comment on a blocked user's moment:

```json
{
  "success": false,
  "error": "Cannot comment on this content"
}
```

Handle this in your comment submission:

```javascript
const addComment = async (momentId, text) => {
  try {
    const response = await api.post(`/moments/${momentId}/comments`, { text });
    return response.data;
  } catch (error) {
    if (error.response?.status === 403) {
      showToast("You can't comment on this content");
      return null;
    }
    throw error;
  }
};
```

---

## 5. Advanced Chat Features

Refer to `CHAT_FRONTEND_GUIDE.md` for detailed implementation of:

- Voice messages with waveform
- Message corrections (HelloTalk style)
- Disappearing/self-destruct messages
- In-chat polls
- Mentions (@username)
- Message bookmarks
- Secret chat mode
- Chat themes
- Nicknames
- Quick replies
- Translation

---

## 6. API Changes Summary

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/moments/:id/save` | Save/bookmark moment |
| `DELETE` | `/moments/:id/save` | Unsave moment |
| `GET` | `/moments/saved` | Get saved moments |
| `POST` | `/moments/:id/share` | Increment share count |
| `POST` | `/moments/:id/report` | Report moment |
| `GET` | `/moments/trending` | Get trending moments |
| `GET` | `/moments/explore` | Explore with filters |

### Changed Endpoints

| Endpoint | Change |
|----------|--------|
| `GET /moments` | Now filters blocked users (requires token for full filtering) |
| `GET /moments/:id` | Returns 403 if blocked |
| `GET /moments/user/:userId` | Returns `blocked: true` if blocked |
| `GET /stories/feed` | Filters blocked users |
| `GET /stories/user/:userId` | Returns `blocked: true` if blocked |
| `GET /stories/:id` | Returns 403 if blocked |
| `GET /moments/:momentId/comments` | Filters blocked users' comments |
| `POST /moments/:momentId/comments` | Returns 403 if blocked |
| `POST /moments/:id/like` | Returns 403 if blocked |

### New Response Fields

```javascript
// Moments now include:
{
  saveCount: number,
  shareCount: number,
  savedBy: string[],
  isSaved: boolean  // When fetching saved list
}

// Blocked content responses include:
{
  blocked: true,
  message: "Content not available"
}
```

---

## 7. Migration Checklist

### Required Changes

- [ ] Update API error handling for 403 blocked responses
- [ ] Add save/bookmark functionality to moment cards
- [ ] Create saved moments screen
- [ ] Add share functionality
- [ ] Add report functionality with reason modal
- [ ] Create explore/discover screen with filters
- [ ] Add trending moments section
- [ ] Handle `blocked: true` response in profiles/stories

### Optional Enhancements

- [ ] Add "Content not available" placeholder for blocked profiles
- [ ] Show save count on moments
- [ ] Show share count on moments
- [ ] Add category/mood chips when creating moments
- [ ] Implement tag search/discovery

---

## 8. Testing Checklist

1. **Blocking**
   - [ ] Block a user → their moments disappear from feed
   - [ ] View blocked user's profile → shows "Content not available"
   - [ ] Try to like blocked user's moment → fails gracefully
   - [ ] Try to comment on blocked user's moment → fails gracefully
   - [ ] Unblock user → their content reappears

2. **Save/Bookmark**
   - [ ] Save a moment → icon toggles, count increases
   - [ ] View saved moments → shows all saved
   - [ ] Unsave → removed from saved list

3. **Report**
   - [ ] Report a moment → confirmation shown
   - [ ] Try to report again → "Already reported" message

4. **Share**
   - [ ] Share moment → native share or clipboard copy works
   - [ ] Share count increments

5. **Trending/Explore**
   - [ ] Trending shows popular moments
   - [ ] Filters work correctly
   - [ ] Pagination works

---

## Questions?

If you need clarification on any of these changes, check the backend controller files or reach out to the backend team.

