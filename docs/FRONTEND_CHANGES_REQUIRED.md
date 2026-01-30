# Frontend Changes Required for Backend Updates

**Created**: January 31, 2026
**Backend Version**: Pre-Launch Optimized
**Priority**: Review before deployment

---

## Table of Contents

1. [Authentication Changes](#1-authentication-changes)
2. [API Authorization Changes](#2-api-authorization-changes)
3. [Rate Limiting Handling](#3-rate-limiting-handling)
4. [Response Format Changes](#4-response-format-changes)
5. [New Error Codes](#5-new-error-codes)
6. [Removed/Changed Endpoints](#6-removedchanged-endpoints)
7. [Security Improvements](#7-security-improvements)
8. [Performance Optimizations](#8-performance-optimizations)

---

## 1. Authentication Changes

### All Message Routes Now Require Authentication

**Before**: Some message routes were public
**After**: ALL message routes require Bearer token

**Affected Routes**:
```
GET /api/v1/messages              # Now requires auth
GET /api/v1/messages/:id          # Now requires auth
GET /api/v1/messages/user/:userId # Now requires auth
GET /api/v1/messages/senders/:userId # Now requires auth
GET /api/v1/messages/conversation/:senderId/:receiverId # Now requires auth
GET /api/v1/messages/from/:userId # Now requires auth
```

**Frontend Action Required**:
- Ensure all message API calls include Authorization header
- Handle 401 errors by redirecting to login

### User Routes Now Require Authentication

**Affected Routes**:
```
GET /api/v1/auth/users            # Now requires auth
GET /api/v1/auth/users/:id        # Now requires auth
PUT /api/v1/auth/users/:id        # Now requires auth (self or admin only)
DELETE /api/v1/auth/users/:id     # Now requires auth (self or admin only)
PUT /api/v1/auth/users/:userId/follow/:targetUserId   # Now requires auth
PUT /api/v1/auth/users/:userId/unfollow/:targetUserId # Now requires auth
```

**Frontend Action Required**:
- Add Authorization header to all user API calls
- Community/explore screens need auth token

---

## 2. API Authorization Changes

### Users Can Only Modify Their Own Data

**New Behavior**:
- `PUT /api/v1/auth/users/:id` - Users can only update their own profile
- `DELETE /api/v1/auth/users/:id` - Users can only delete their own account

**Error Response** (403 Forbidden):
```json
{
  "success": false,
  "error": "Not authorized to update this user"
}
```

**Frontend Action Required**:
- Remove any UI that allows modifying other users' profiles
- Handle 403 errors gracefully

### Messages Authorization

**New Behavior**:
- Users can only view messages where they are sender OR receiver
- Users can only view their own message history

**Error Response** (403 Forbidden):
```json
{
  "success": false,
  "error": "Not authorized to view this message"
}
```

### Comments Authorization

**New Behavior**:
- Comments can only be deleted by:
  - Comment author
  - Moment owner (owner of the post)
  - Admin users

**Frontend Action Required**:
- Show delete button only for comment owner or moment owner
- Handle 403 errors on delete attempts

---

## 3. Rate Limiting Handling

### New Rate Limits Applied

| Feature | Limit | Window |
|---------|-------|--------|
| Social Interactions (like, share, follow) | 30 requests | 1 minute |
| Reports | 10 reports | 1 hour |
| Search | 20 searches | 1 minute |
| AI Conversation | 20-200/hour | Based on tier |
| AI Quiz Generation | 10-100/hour | Based on tier |
| AI Lesson Builder | 5-50/hour | Based on tier |

### Rate Limit Response

**HTTP Status**: 429 Too Many Requests

**Response Body**:
```json
{
  "success": false,
  "error": "Too many interactions. Please slow down."
}
```

**Headers Included**:
```
RateLimit-Limit: 30
RateLimit-Remaining: 0
RateLimit-Reset: 1706745600
```

**Frontend Action Required**:

1. **Handle 429 errors globally**:
```dart
if (response.statusCode == 429) {
  // Show "Please slow down" message
  // Optionally disable button temporarily
  // Use RateLimit-Reset header for countdown
}
```

2. **Implement debouncing for interactions**:
```dart
// Debounce like button to prevent spam
ElevatedButton(
  onPressed: debounce(() => likePost(postId), 500),
  child: Text('Like'),
)
```

3. **Show rate limit warnings for AI features**:
```dart
// Check rate limit before AI operations
final response = await api.get('/ai-conversation/rate-limit');
if (response.data['remaining'] < 5) {
  showWarning('You have ${response.data['remaining']} AI messages left today');
}
```

---

## 4. Response Format Changes

### User List Response (Optimized)

**Before**: Full user objects with all fields
**After**: Only essential fields returned

**New Response**:
```json
{
  "success": true,
  "count": 10,
  "total": 100,
  "pages": 10,
  "data": [
    {
      "_id": "...",
      "name": "John Doe",
      "images": ["url1", "url2"],
      "native_language": "en",
      "language_to_learn": "es",
      "level": 5
    }
  ]
}
```

**Removed Fields**: `email`, `bio`, `streakDays`, `totalXp`, `createdAt`

**Frontend Action Required**:
- Update user list models to not expect removed fields
- Fetch full profile only when viewing user detail

### User Profile Response (Optimized)

**Fields Returned**:
```json
{
  "name": "...",
  "bio": "...",
  "images": [...],
  "native_language": "...",
  "language_to_learn": "...",
  "level": 5,
  "streakDays": 10,
  "totalXp": 1500,
  "createdAt": "..."
}
```

**Removed from public profiles**: `email` (privacy protection)

**Frontend Action Required**:
- Don't display email in public profiles
- Only show email in user's own profile settings

---

## 5. New Error Codes

### Authorization Errors (403)

```dart
switch (error.response?.statusCode) {
  case 403:
    final message = error.response?.data['error'];
    if (message.contains('Not authorized')) {
      // User doesn't have permission
      showError('You don\'t have permission to do this');
    }
    break;
}
```

### Rate Limit Errors (429)

```dart
case 429:
  final error = response.data['error'];
  if (error.contains('interactions')) {
    showSnackBar('Please slow down');
  } else if (error.contains('reports')) {
    showSnackBar('Too many reports. Try again later.');
  } else if (error.contains('AI') || error.contains('requests')) {
    showDialog('Rate Limit', 'Upgrade to premium for more AI usage');
  }
  break;
```

### Common Error Messages

| Error Message | User-Friendly Display |
|---------------|----------------------|
| "Not authorized to view this message" | "This message is private" |
| "Not authorized to update this user" | "You can only edit your own profile" |
| "Not authorized to delete this comment" | "You can only delete your own comments" |
| "Too many interactions. Please slow down." | "Slow down! Try again in a moment" |
| "Too many reports submitted" | "Report limit reached. Try again in an hour" |
| "Too many search requests" | "Search limit reached. Please wait" |

---

## 6. Removed/Changed Endpoints

### Changed Endpoints

| Endpoint | Change |
|----------|--------|
| `POST /api/v1/auth/users` | Now admin-only (was unprotected) |
| `DELETE /api/v1/comments/:id` | Fixed (was broken), now requires auth |

### Behavior Changes

1. **Comment Delete**: Now properly removes comment and updates moment's comment count atomically

2. **User Update**: Now filters sensitive fields (role, userMode, vipSubscription) for non-admins

---

## 7. Security Improvements

### Token Handling

**Best Practices**:
1. Store tokens securely (Keychain/Keystore, not SharedPreferences)
2. Include token in all API requests
3. Handle token expiration gracefully

```dart
// Example interceptor
dio.interceptors.add(InterceptorsWrapper(
  onRequest: (options, handler) {
    final token = secureStorage.read('token');
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  },
  onError: (error, handler) {
    if (error.response?.statusCode == 401) {
      // Token expired - redirect to login
      navigateToLogin();
    }
    handler.next(error);
  },
));
```

### Input Validation

The backend now validates:
- Lesson completion scores (0-100)
- Time spent values (max 24 hours)
- ObjectId formats
- Array contents

**Frontend should also validate** before sending to prevent unnecessary API calls.

---

## 8. Performance Optimizations

### Recommended Frontend Optimizations

1. **Pagination**: Use pagination for all list endpoints
   ```dart
   // Good
   api.get('/moments?page=1&limit=20');

   // Bad - don't fetch all at once
   api.get('/moments?limit=1000');
   ```

2. **Caching**: Cache user profiles and static data
   ```dart
   // Cache user data for 5 minutes
   final user = cache.get('user_$userId') ??
                await api.get('/users/$userId');
   cache.set('user_$userId', user, duration: Duration(minutes: 5));
   ```

3. **Debouncing**: Debounce search and interactions
   ```dart
   // Debounce search input
   searchController.addListener(
     debounce(() => searchUsers(searchController.text), 300)
   );
   ```

4. **Optimistic Updates**: Update UI before API response for better UX
   ```dart
   // Optimistic like
   setState(() => isLiked = true);
   try {
     await api.post('/moments/$id/like');
   } catch (e) {
     setState(() => isLiked = false); // Revert on error
   }
   ```

---

## Quick Reference: API Headers

### Required Headers

```
Authorization: Bearer <token>
Content-Type: application/json
```

### Rate Limit Headers (Response)

```
RateLimit-Limit: 30
RateLimit-Remaining: 25
RateLimit-Reset: 1706745600
```

---

## 9. New Community API Endpoints

### Nearby Users

```
GET /api/v1/community/nearby
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| latitude | number | User's current latitude (required) |
| longitude | number | User's current longitude (required) |
| radius | number | Search radius in km (default: 50, max: 500) |
| limit | number | Max users to return (default: 50, max: 100) |
| offset | number | Pagination offset |
| language | string | Filter by language |
| minAge | number | Minimum age filter |
| maxAge | number | Maximum age filter |
| gender | string | Gender filter (male/female/other) |
| onlineOnly | boolean | Only show online users |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "user123",
      "name": "John",
      "images": ["https://..."],
      "location": {
        "city": "Seoul",
        "country": "South Korea"
      },
      "distance": 2.5,
      "native_language": "English",
      "language_to_learn": "Korean",
      "isOnline": true,
      "lastSeen": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": { "total": 150, "limit": 50, "offset": 0, "hasMore": true }
}
```

### Wave Feature

**Send Wave:**
```
POST /api/v1/community/wave
Body: { "targetUserId": "user456", "message": "Hi!" }
Response: { "success": true, "data": { "waveId": "...", "isMutual": false, "message": "Wave sent!" } }
```

**Get Waves Received:**
```
GET /api/v1/community/waves?page=1&limit=20&unreadOnly=true
```

**Mark Waves as Read:**
```
PUT /api/v1/community/waves/read
Body: { "waveIds": ["wave1", "wave2"] } // Optional, marks all if empty
```

### Topics API

**Get All Topics:**
```
GET /api/v1/community/topics?category=lifestyle&lang=en
Response: { "success": true, "data": [{ "id": "topic_travel", "name": "Travel", "icon": "airplane", ... }] }
```

**Get Users by Topic:**
```
GET /api/v1/community/topics/:topicId/users?page=1&limit=20
```

**Update My Topics:**
```
PUT /api/v1/community/topics/my
Body: { "topics": ["topic_travel", "topic_music"] }
```

---

## 10. Lesson Completion Fix

The `POST /api/v1/lessons/:id/complete` endpoint now properly calculates scores from the answers array.

**Request:**
```json
{
  "answers": [
    { "exerciseIndex": 0, "answer": "optionId or text" },
    { "exerciseIndex": 1, "answer": "user answer" }
  ],
  "timeSpentMs": 120000
}
```

**Note:** The `score`, `correctAnswers`, and `totalQuestions` are now calculated server-side based on the answers. You no longer need to send these values.

---

## Migration Checklist

**Authentication & Authorization:**
- [ ] Add Authorization header to all message API calls
- [ ] Add Authorization header to user list/profile API calls
- [ ] Add Authorization header to follow/unfollow API calls
- [ ] Handle 403 Forbidden errors gracefully
- [ ] Handle 429 Rate Limit errors with user feedback

**Data Models:**
- [ ] Update user models to not expect `email` in public profiles
- [ ] Add `topics` field to user model
- [ ] Add `languageLevel` field to user model

**UI/UX:**
- [ ] Implement debouncing for like/share/follow buttons
- [ ] Show rate limit warnings for AI features

**New Features (Community):**
- [ ] Implement nearby users screen using `/api/v1/community/nearby`
- [ ] Add wave feature using `/api/v1/community/wave` endpoints
- [ ] Implement topics selection using `/api/v1/community/topics`
- [ ] Update lesson completion to not send score (calculated server-side)

**Testing:**
- [ ] Test all flows with authentication
- [ ] Update error handling for new error messages
- [ ] Test location permissions for nearby users feature

---

## Questions?

If you have questions about these changes, check:
1. `docs/BACKEND_OPTIMIZATION_PLAN.md` - Full technical details
2. `docs/AI_LESSON_BUILDER.md` - AI lesson endpoints
3. Postman collection for testing endpoints

---

**Document Version**: 1.0
**Last Updated**: January 31, 2026
