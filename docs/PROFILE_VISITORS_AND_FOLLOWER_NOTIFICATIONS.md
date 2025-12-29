# Profile Visitors & Follower Notifications - Complete Guide

## 🎯 Overview

This document covers three major features:
1. **Profile Visitor Tracking** - Track who visits your profile
2. **Profile Visitor Display** - Show visitor list with details (like HelloTalk)
3. **Follower Moment Notifications** - Notify followers when you post a moment

---

## 📊 Feature 1: Profile Visitor Tracking

### Database Schema

#### ProfileVisit Model
Tracks each profile visit with detailed information:

```javascript
{
  profileOwner: ObjectId,      // Whose profile was visited
  visitor: ObjectId,           // Who visited
  visitedAt: Date,             // When
  duration: Number,            // Visit duration (seconds)
  source: String,              // 'search', 'moments', 'chat', etc.
  deviceType: String,          // 'ios', 'android', 'web'
  isAnonymous: Boolean         // For future privacy features
}
```

**Features:**
- ✅ Automatic deduplication (5-minute window)
- ✅ Auto-deletion after 90 days (TTL index)
- ✅ Efficient indexes for fast queries
- ✅ Visit statistics and analytics

#### User Model Extension
Added to User schema:

```javascript
profileStats: {
  totalVisits: Number,          // Total visit count
  uniqueVisitors: Number,       // Unique visitors count
  lastVisitorUpdate: Date       // Last update timestamp
}
```

---

## 🔌 API Endpoints

### 1. Record Profile Visit

**Endpoint:** `POST /api/v1/users/:userId/profile-visit`

**Auth:** Required (Bearer token)

**Body:**
```json
{
  "source": "moments",        // Optional: 'search', 'moments', 'chat', 'followers', 'direct'
  "deviceType": "ios"         // Optional: 'ios', 'android', 'web'
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile visit recorded",
  "data": {
    "recorded": true
  }
}
```

**Notes:**
- Own profile visits are not recorded
- Visits from blocked users are silently ignored
- Duplicate visits within 5 minutes are merged
- VIP profile owners receive push notifications

---

### 2. Get Profile Visitors

**Endpoint:** `GET /api/v1/users/:userId/visitors`

**Auth:** Required (Must be profile owner)

**Query Parameters:**
- `limit` (default: 20) - Number of visitors to return
- `page` (default: 1) - Page number for pagination

**Response:**
```json
{
  "success": true,
  "count": 15,
  "stats": {
    "totalVisits": 150,
    "uniqueVisitors": 48,
    "visitsToday": 12,
    "visitsThisWeek": 45,
    "bySource": [
      { "_id": "moments", "count": 80 },
      { "_id": "search", "count": 40 },
      { "_id": "chat", "count": 30 }
    ]
  },
  "data": [
    {
      "user": {
        "_id": "60d5ec49f1b2c8b1f8c8e8e8",
        "name": "Alice Johnson",
        "photo": "https://cdn.banatalk.com/profiles/alice.jpg",
        "gender": "female",
        "city": "San Francisco",
        "country": "USA",
        "isVIP": true,
        "nativeLanguage": "English"
      },
      "lastVisit": "2025-12-18T14:30:00.000Z",
      "visitCount": 5,
      "source": "moments"
    }
  ]
}
```

---

### 3. Get My Visitor Stats

**Endpoint:** `GET /api/v1/users/me/visitor-stats`

**Auth:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "totalVisits": 150,
    "uniqueVisitors": 48,
    "visitsToday": 12,
    "visitsThisWeek": 45,
    "bySource": [
      { "_id": "moments", "count": 80 },
      { "_id": "search", "count": 40 }
    ]
  }
}
```

---

### 4. Clear Visit History

**Endpoint:** `DELETE /api/v1/users/me/visitors`

**Auth:** Required

**Response:**
```json
{
  "success": true,
  "message": "Visit history cleared"
}
```

---

### 5. Get My Visited Profiles

**Endpoint:** `GET /api/v1/users/me/visited-profiles`

**Auth:** Required

**Query Parameters:**
- `limit` (default: 20)

**Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "user": {
        "_id": "60d5ec49f1b2c8b1f8c8e8e8",
        "name": "Bob Smith",
        "photo": "https://cdn.banatalk.com/profiles/bob.jpg",
        "gender": "male",
        "city": "New York",
        "country": "USA",
        "isVIP": false,
        "nativeLanguage": "English"
      },
      "visitedAt": "2025-12-18T14:30:00.000Z",
      "source": "search"
    }
  ]
}
```

---

## 📱 Flutter Integration - Profile Visitors

### 1. Record a Visit (Call when viewing a profile)

```dart
Future<void> recordProfileVisit(String userId, String source) async {
  try {
    final response = await http.post(
      Uri.parse('$API_URL/users/$userId/profile-visit'),
      headers: {
        'Authorization': 'Bearer $authToken',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'source': source,        // 'search', 'moments', 'chat', 'direct'
        'deviceType': Platform.isIOS ? 'ios' : 'android',
      }),
    );

    if (response.statusCode == 200) {
      print('✅ Profile visit recorded');
    }
  } catch (e) {
    print('❌ Error recording visit: $e');
  }
}
```

**Call this when:**
- User taps on a profile from search results: `source: 'search'`
- User taps on a profile from moments: `source: 'moments'`
- User taps on a profile from chat: `source: 'chat'`
- User directly navigates to profile: `source: 'direct'`

---

### 2. Get Visitors List

```dart
Future<List<ProfileVisitor>> getMyVisitors({int page = 1, int limit = 20}) async {
  try {
    final response = await http.get(
      Uri.parse('$API_URL/users/me/visitors?page=$page&limit=$limit'),
      headers: {
        'Authorization': 'Bearer $authToken',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return (data['data'] as List)
          .map((visitor) => ProfileVisitor.fromJson(visitor))
          .toList();
    }
    return [];
  } catch (e) {
    print('❌ Error fetching visitors: $e');
    return [];
  }
}
```

---

### 3. Display Visitor Count on Profile

```dart
FutureBuilder<Map<String, dynamic>>(
  future: getVisitorStats(),
  builder: (context, snapshot) {
    if (snapshot.hasData) {
      final stats = snapshot.data!;
      return Row(
        children: [
          Icon(Icons.visibility, size: 16),
          SizedBox(width: 4),
          Text('${stats['uniqueVisitors']} visitors'),
        ],
      );
    }
    return SizedBox.shrink();
  },
)
```

---

## 🔔 Feature 2: Follower Moment Notifications

### How It Works

When a user posts a moment, all their followers automatically receive a push notification.

**Flow:**
1. User posts a moment
2. Backend finds all followers
3. Sends push notification to each follower
4. Notification includes moment preview
5. Tapping notification opens moment detail

### Backend Implementation

#### Notification Type Added
- Type: `follower_moment`
- Template: `"{userName} posted a moment"`
- Body: Preview of moment text
- Tap action: Opens moment detail screen

#### User Settings
Added to `notificationSettings`:
```javascript
followerMoments: {
  type: Boolean,
  default: true  // Users can disable in app settings
}
```

---

## 🔌 Notification Preferences API

Users can enable/disable follower moment notifications:

**Endpoint:** `PUT /api/v1/notifications/settings`

**Body:**
```json
{
  "followerMoments": true  // or false to disable
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "chatMessages": true,
    "moments": true,
    "followerMoments": true,
    "friendRequests": true,
    "profileVisits": true,
    "sound": true,
    "vibration": true,
    "showPreview": true
  }
}
```

---

## 📱 Flutter Integration - Follower Notifications

### Handle Notification Tap

In your FCM handler:

```dart
void _handleMessageTap(RemoteMessage message) {
  final type = message.data['type'];
  
  switch (type) {
    case 'follower_moment':
      final momentId = message.data['momentId'];
      final userId = message.data['userId'];
      // Navigate to moment detail
      Navigator.pushNamed(
        context,
        '/moment-detail',
        arguments: {'momentId': momentId, 'userId': userId},
      );
      break;
    
    // ... other cases
  }
}
```

---

### Display Notification Settings

```dart
SwitchListTile(
  title: Text('Follower Moments'),
  subtitle: Text('Get notified when people you follow post moments'),
  value: _followerMomentsEnabled,
  onChanged: (value) async {
    setState(() => _followerMomentsEnabled = value);
    await updateNotificationSettings({
      'followerMoments': value,
    });
  },
)
```

---

## 🧪 Testing

### Test Profile Visitors

1. **Setup:**
   - User A: Logged in
   - User B: Logged in

2. **Test Recording Visit:**
   ```bash
   curl -X POST https://api.banatalk.com/api/v1/users/{USER_A_ID}/profile-visit \
     -H "Authorization: Bearer {USER_B_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"source": "search", "deviceType": "ios"}'
   ```

3. **Test Get Visitors (User A):**
   ```bash
   curl https://api.banatalk.com/api/v1/users/{USER_A_ID}/visitors \
     -H "Authorization: Bearer {USER_A_TOKEN}"
   ```

4. **Expected:**
   - User A should see User B in their visitors list
   - Visit count should increment
   - If User A is VIP, they should receive a push notification

---

### Test Follower Moment Notifications

1. **Setup:**
   - User A follows User B
   - User A has FCM token registered
   - User A has `followerMoments` notification enabled

2. **Test:**
   - User B posts a moment
   - Watch backend logs:
   ```
   📤 Sending notification to followers...
   ✅ Sent 1 follower moment notifications (0 failed)
   📤 Sending push notification to {USER_A_ID}
   ✅ Successfully sent to device {DEVICE_ID}
   ```

3. **Expected:**
   - User A's device receives push notification
   - Notification shows: "User B posted a moment"
   - Tapping opens moment detail

---

## 🎨 UI/UX Recommendations

### Profile Visitors Section

**Like HelloTalk:**

```
┌──────────────────────────────────────┐
│  Profile Visitors (48)               │
├──────────────────────────────────────┤
│  👁️  150 total visits                 │
│  📊  12 visitors today                │
│  ⏰  5 recent visitors                │
├──────────────────────────────────────┤
│  [Alice Johnson]      [5 mins ago]   │
│  📍 San Francisco     🌟 VIP          │
│  Via: Moments                         │
├──────────────────────────────────────┤
│  [Bob Smith]          [1 hour ago]   │
│  📍 New York                          │
│  Via: Search                          │
├──────────────────────────────────────┤
│  [See All Visitors →]                │
└──────────────────────────────────────┘
```

### Notification Example

```
┌────────────────────────────────┐
│  [Profile Photo]               │
│  Alice Johnson posted a moment │
│  "Just tried the best sushi...│
│  2 minutes ago                 │
└────────────────────────────────┘
```

---

## 🔒 Privacy & Security

### Profile Visitors
- ✅ Own profile visits are NOT recorded
- ✅ Blocked users' visits are silently ignored
- ✅ Only profile owner can see their visitors
- ✅ Visitor data auto-deletes after 90 days
- ✅ Users can clear their visit history anytime

### Notifications
- ✅ Users can disable follower moment notifications
- ✅ Users can disable notification previews
- ✅ Respects all notification preferences
- ✅ Notifications saved to history for 30 days

---

## 📊 Analytics & Monitoring

### Key Metrics to Track

**Profile Visitors:**
- Total visits per user
- Unique visitors per user
- Visit sources distribution
- Average visit duration
- Most visited profiles

**Follower Notifications:**
- Notifications sent per moment
- Delivery success rate
- Tap-through rate
- Opt-out rate

### Backend Logs

Look for:
```
✅ Profile visit recorded: {visitorId} → {profileOwnerId}
✅ Sent {count} follower moment notifications
📤 Sending push notification to {userId}
ℹ️ Skipping notification (user preferences)
```

---

## 🚀 Migration Script

If you need to add these fields to existing users:

```javascript
// Add profileStats to existing users
db.users.updateMany(
  { profileStats: { $exists: false } },
  {
    $set: {
      'profileStats.totalVisits': 0,
      'profileStats.uniqueVisitors': 0,
      'profileStats.lastVisitorUpdate': null,
      'notificationSettings.followerMoments': true
    }
  }
);
```

---

## ✅ Feature Checklist

### Profile Visitors
- [x] ProfileVisit model created
- [x] User profileStats field added
- [x] Record visit endpoint
- [x] Get visitors endpoint
- [x] Get visitor stats endpoint
- [x] Clear history endpoint
- [x] Get visited profiles endpoint
- [x] VIP notification integration
- [x] TTL auto-cleanup
- [x] Privacy checks

### Follower Notifications
- [x] Notification template created
- [x] NotificationService method added
- [x] Moments controller integration
- [x] User settings field added
- [x] Preference check logic
- [x] Notification type enum updated
- [x] Push notification delivery

---

## 🎯 Summary

You now have:
1. ✅ **Profile visitor tracking** with real numbers
2. ✅ **Visitor list display** like HelloTalk
3. ✅ **Follower moment notifications** for all followers

All features are production-ready, tested, and documented! 🚀

---

## 📞 Support

If you encounter any issues:
1. Check backend logs for errors
2. Verify FCM tokens are registered
3. Check user notification preferences
4. Verify API endpoints are responding
5. Test with different user scenarios

For questions or issues, refer to:
- `PUSH_NOTIFICATIONS_GUIDE.md` - FCM setup
- `FLUTTER_FCM_IMPLEMENTATION.md` - Flutter integration
- Server logs: `pm2 logs language-app`

