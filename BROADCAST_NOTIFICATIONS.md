# Broadcast Notifications

Send announcements/news to all users via push notifications.

## Overview

Admin-only feature to broadcast messages to all active users at once. Perfect for announcing new features, important updates, or system maintenance notices.

## API Endpoints

### 1. Send Broadcast Notification

**POST** `/api/v1/admin/broadcast`

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Body:**
```json
{
  "title": "🎉 New Feature Available",
  "body": "Check out our new AI-powered vocabulary quizzes!",
  "imageUrl": "https://example.com/image.jpg" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Broadcast notification sent successfully",
  "stats": {
    "usersTargeted": 450,
    "devicesReached": 782,
    "failed": 5,
    "errored": 0,
    "successRate": "99.4%",
    "timeTaken": "2.34s"
  }
}
```

### 2. Get Broadcast Statistics

**GET** `/api/v1/admin/broadcast/stats`

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "usersWithActiveTokens": 450,
    "totalActiveDevices": 782,
    "averageDevicesPerUser": "1.7"
  }
}
```

## Usage Examples

### Using cURL

```bash
curl -X POST http://localhost:5000/api/v1/admin/broadcast \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Feature: Vocabulary Quiz",
    "body": "Master new words with AI-powered quizzes. Try it now!",
    "imageUrl": "https://example.com/feature-image.jpg"
  }'
```

### Using Postman

1. Create new POST request
2. URL: `http://localhost:5000/api/v1/admin/broadcast`
3. Headers:
   - `Authorization: Bearer <admin-token>`
   - `Content-Type: application/json`
4. Body (JSON):
   ```json
   {
     "title": "New Feature Available",
     "body": "Check out our latest update!",
     "imageUrl": "https://example.com/image.jpg"
   }
   ```
5. Click Send

### Using JavaScript/Fetch

```javascript
const sendBroadcast = async (title, body, imageUrl) => {
  const response = await fetch('/api/v1/admin/broadcast', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      body,
      imageUrl
    })
  });
  
  const result = await response.json();
  console.log('Broadcast stats:', result.stats);
};

sendBroadcast(
  '🎉 New Feature: AI Quiz',
  'Try our new vocabulary quizzes!',
  'https://example.com/image.jpg'
);
```

## Features

### ✅ Multi-Device Support
- Sends to all devices a user has the app installed on
- Tracks delivery per device, not just per user

### ✅ Admin-Only
- Requires admin authentication token
- Logged in admin audit trail

### ✅ Real-time Delivery Tracking
- Shows immediate success/failure counts
- Detailed statistics on delivery

### ✅ No Spam
- Broadcasts don't count against user's notification caps
- Doesn't respect quiet hours (admin announcements are important)

### ✅ Validation
- Title: max 100 characters
- Body: max 500 characters
- Optional image URL

## What Gets Logged

Each broadcast is recorded in `AdminAuditLog`:
```javascript
{
  admin: adminUserId,
  action: 'broadcast_notification',
  details: {
    title: 'Feature Title',
    body: 'Feature Description',
    usersTargeted: 450,
    devicesReached: 782,
    failed: 5
  },
  timestamp: '2026-07-10T15:30:00Z'
}
```

## Best Practices

### ✅ Do's

- **Be clear** - Use simple, direct language
- **Be timely** - Send announcements when users are likely to see them
- **Include action** - Tell users what to do next ("Try it now", "Update your app")
- **Use emojis** - Make titles stand out (🎉, ✨, 🚀, 🔔)
- **Keep it short** - Body should be 1-2 sentences
- **Test first** - Check stats before major announcements

### ❌ Don'ts

- **Don't spam** - Limit to important announcements only
- **Don't be vague** - "New update available" is too generic
- **Don't use all caps** - "CHECK THIS OUT!!!" looks spammy
- **Don't test on production** - Use your admin account in dev first

## Examples

### New Feature Announcement
```json
{
  "title": "✨ AI-Powered Vocabulary Quiz",
  "body": "Learn words 3x faster with personalized AI quizzes. Start learning today!",
  "imageUrl": "https://cdn.example.com/ai-quiz-feature.jpg"
}
```

### System Maintenance
```json
{
  "title": "🔧 Scheduled Maintenance",
  "body": "We'll be updating our servers tonight at 2 AM. The app will be briefly unavailable."
}
```

### Engagement Campaign
```json
{
  "title": "🔥 Weekly Challenge",
  "body": "Complete 5 conversations this week and earn 50 bonus points. Challenge accepted?"
}
```

### Bug Fix/Security Update
```json
{
  "title": "🛡️ Security Update",
  "body": "Please update your app to the latest version for improved security and performance."
}
```

## Troubleshooting

### "No users with active FCM tokens"
- Not enough users have push notifications enabled
- Ask users to enable notifications in app settings
- Check if the app's notification request was denied by users

### Low success rate (<90%)
- Some devices may have uninstalled the app
- Old/invalid FCM tokens are being cleaned up (normal)
- Check if users have disabled notifications

### Broadcast doesn't appear immediately
- FCM delivery can take up to 30 seconds
- Check app logs to see if notification was received
- Verify app has permission to show notifications

## Monitoring

Check broadcast audit logs:
```javascript
const AdminAuditLog = require('./models/AdminAuditLog');
const broadcasts = await AdminAuditLog.find({ 
  action: 'broadcast_notification' 
}).sort({ timestamp: -1 }).limit(10);
```

## Future Enhancements

Possible improvements:
- **Scheduled broadcasts** - Schedule announcements for specific times
- **Targeted broadcasts** - Send to specific user segments (by language, region, etc.)
- **A/B testing** - Test two different messages and see which performs better
- **Rich notifications** - Include action buttons (Open App, Learn More, etc.)
- **Localization** - Send messages in user's preferred language
- **Analytics** - Track notification clicks and engagement
