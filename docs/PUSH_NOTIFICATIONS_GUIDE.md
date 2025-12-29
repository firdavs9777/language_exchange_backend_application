# Push Notifications Implementation Guide

## Overview
This document describes the complete push notification system implemented using Firebase Cloud Messaging (FCM) for BananaTalk.

## Architecture

### Components
1. **Firebase Admin SDK** - Handles FCM communication
2. **FCM Service** - Low-level FCM operations (token management, sending)
3. **Notification Service** - Business logic for different notification types
4. **API Routes** - Endpoints for token management, settings, and history
5. **Background Jobs** - Maintenance tasks and user engagement
6. **Integrations** - Chat, moments, friends, profile visits

## Setup Instructions

### 1. Firebase Configuration
The Firebase Admin SDK is already configured using the service account key:
- File: `bananatalk-backend-firebase-adminsdk-7rg93-ab0f66ac7c.json`
- Config: `config/firebase.js`
- Project ID: `bananatalk-backend`

### 2. Environment Variables
Added to `config/config.env`:
```
FIREBASE_PROJECT_ID=bananatalk-backend
```

### 3. Database Migration (REQUIRED)
⚠️ **Important:** Run this migration to update existing users with notification fields.

```bash
# Run the migration script
npm run migrate:notifications

# Or directly
node migrations/addNotificationFields.js
```

**What the migration does:**
- Adds `fcmTokens` array (empty by default)
- Adds `notificationSettings` with default preferences
- Adds `badges` with zero counts
- Creates database indexes for performance
- Verifies all users were updated successfully

**Expected Output:**
```
✅ Successfully updated: 150 users
✅ User model indexes created
✅ Notification model indexes created
✅ Migration verified successfully!
```

### 4. Database Changes
New fields added to User model:
- `fcmTokens` - Array of FCM tokens with platform and device info
- `notificationSettings` - User preferences for notifications
- `badges` - Unread message and notification counts

New Notification model created for notification history.

**Note:** New users automatically get these fields. The migration is only needed for existing users.

## API Endpoints

### Token Management

#### Register FCM Token
```
POST /api/v1/notifications/register-token
Headers: Authorization: Bearer <token>
Body:
{
  "token": "fcm_token_here",
  "platform": "ios" | "android",
  "deviceId": "unique_device_id"
}
```

#### Remove FCM Token
```
DELETE /api/v1/notifications/remove-token/:deviceId
Headers: Authorization: Bearer <token>
```

### Notification Settings

#### Get Settings
```
GET /api/v1/notifications/settings
Headers: Authorization: Bearer <token>
```

#### Update Settings
```
PUT /api/v1/notifications/settings
Headers: Authorization: Bearer <token>
Body:
{
  "enabled": true,
  "chatMessages": true,
  "moments": true,
  "friendRequests": true,
  "profileVisits": true,
  "marketing": false,
  "sound": true,
  "vibration": true,
  "showPreview": true
}
```

#### Mute Conversation
```
POST /api/v1/notifications/mute-chat/:conversationId
Headers: Authorization: Bearer <token>
```

#### Unmute Conversation
```
POST /api/v1/notifications/unmute-chat/:conversationId
Headers: Authorization: Bearer <token>
```

### Notification History

#### Get History
```
GET /api/v1/notifications/history?page=1&limit=20
Headers: Authorization: Bearer <token>
```

#### Mark as Read
```
POST /api/v1/notifications/mark-read/:notificationId
Headers: Authorization: Bearer <token>
```

#### Mark All as Read
```
POST /api/v1/notifications/mark-all-read
Headers: Authorization: Bearer <token>
```

#### Clear All
```
DELETE /api/v1/notifications/clear-all
Headers: Authorization: Bearer <token>
```

### Badge Management

#### Get Badge Count
```
GET /api/v1/notifications/badge-count
Headers: Authorization: Bearer <token>
```

#### Reset Badge
```
POST /api/v1/notifications/reset-badge
Headers: Authorization: Bearer <token>
Body:
{
  "type": "messages" | "notifications"
}
```

### Testing

#### Send Test Notification
```
POST /api/v1/notifications/test
Headers: Authorization: Bearer <token>
Body:
{
  "userId": "optional_user_id",
  "type": "chat_message" | "moment_like" | "moment_comment" | "friend_request" | "profile_visit" | "system"
}
```

## Notification Types

### 1. Chat Messages
**Trigger:** User sends a message via Socket.IO
**Condition:** Recipient is offline
**Data:**
- `type`: "chat_message"
- `senderId`: Sender user ID
- `conversationId`: Conversation ID
- `messageId`: Message ID
- `screen`: "chat"

### 2. Moment Likes
**Trigger:** User likes a moment
**Condition:** Liker is not the moment owner
**Data:**
- `type`: "moment_like"
- `userId`: Liker user ID
- `momentId`: Moment ID
- `screen`: "moment_detail"

### 3. Moment Comments
**Trigger:** User comments on a moment
**Condition:** Commenter is not the moment owner
**Data:**
- `type`: "moment_comment"
- `userId`: Commenter user ID
- `momentId`: Moment ID
- `commentId`: Comment ID
- `screen`: "moment_detail"

### 4. Friend Requests
**Trigger:** User follows another user
**Data:**
- `type`: "friend_request"
- `userId`: Requester user ID
- `screen`: "profile"

### 5. Profile Visits (VIP Feature)
**Trigger:** Someone views a VIP user's profile
**Condition:** Viewer is not the profile owner
**Data:**
- `type`: "profile_visit"
- `userId`: Visitor user ID
- `screen`: "profile"

### 6. System Notifications
**Trigger:** Various system events
**Examples:**
- Re-engagement (inactive for 7+ days)
- VIP subscription expiring (3 days before)
- Welcome messages
- Updates and announcements

## Background Jobs

All jobs are scheduled automatically via `jobs/scheduler.js`:

### 1. Token Cleanup
- **Schedule:** Daily at 2:00 AM
- **Function:** Removes FCM tokens not updated in 90 days
- **File:** `jobs/notificationJobs.js`

### 2. Re-engagement Notifications
- **Schedule:** Weekly, Monday at 10:00 AM
- **Function:** Sends notifications to users inactive for 7+ days
- **Condition:** User has marketing notifications enabled

### 3. Subscription Reminders
- **Schedule:** Daily at 9:00 AM
- **Function:** Notifies VIP users 3 days before subscription expires
- **Condition:** VIP subscription ending in 3 days

### 4. Notification History Cleanup
- **Schedule:** Weekly, Sunday at 3:00 AM
- **Function:** Deletes notifications older than 30 days (backup for TTL index)

## Platform-Specific Features

### iOS (APNS)
- Badge count management
- Sound alerts
- Category for notification actions
- Mutable content for rich notifications

### Android
- Notification channels
- High priority delivery
- Custom icons
- Vibration patterns

## User Preferences

Users can control notifications through settings:
- **Global toggle:** Enable/disable all notifications
- **Type-specific:** Control each notification type separately
- **Muted chats:** Disable notifications for specific conversations
- **Preview toggle:** Show/hide message preview in notifications
- **Sound/Vibration:** Control notification sounds and vibrations

## Testing Checklist

### Pre-Deployment
- [ ] Run database migration (`npm run migrate:notifications`)
- [ ] Verify all existing users have new fields
- [ ] Check database indexes are created

### API Testing
- [ ] Register FCM token from mobile app
- [ ] Verify token stored in database
- [ ] Update notification settings via API
- [ ] Get notification history
- [ ] Send test notification via API endpoint

### Notification Flow Testing
- [ ] Send chat message and receive push notification
- [ ] Like a moment and verify notification
- [ ] Comment on moment and verify notification
- [ ] Follow a user and verify friend request notification

### Preference Testing
- [ ] Mute a conversation and verify no notifications
- [ ] Disable chat notifications and test
- [ ] Toggle notification preview on/off
- [ ] Test sound and vibration settings

### Badge & History Testing
- [ ] Test badge count updates
- [ ] Verify notification history is saved
- [ ] Mark notifications as read
- [ ] Mark all as read
- [ ] Clear notification history

### Background Jobs Testing
- [ ] Test token cleanup job manually
- [ ] Verify re-engagement notifications work
- [ ] Test subscription reminder logic
- [ ] Check old notification cleanup

## Troubleshooting

### No notifications received
1. Check user's notification settings (`GET /api/v1/notifications/settings`)
2. Verify FCM token is registered and active
3. Check if conversation is muted (for chat messages)
4. Verify Firebase credentials are correct
5. Check server logs for FCM errors

### Invalid token errors
- Tokens are automatically removed when FCM reports them as invalid
- Run token cleanup job to remove stale tokens
- User needs to re-register token from the app

### Notifications not respecting preferences
- Verify `notificationSettings` in User model
- Check `_shouldSendNotification` logic in `notificationService.js`
- Ensure preferences are properly updated via API

## Integration with Flutter App

The Flutter app should:
1. Request notification permissions on first launch
2. Obtain FCM token from Firebase
3. Register token with backend via `POST /api/v1/notifications/register-token`
4. Handle notification taps and navigate to appropriate screens
5. Update badge counts when app is opened
6. Re-register token if it changes
7. Remove token on logout via `DELETE /api/v1/notifications/remove-token/:deviceId`

## Files Created/Modified

### New Files
- `config/firebase.js` - Firebase Admin SDK configuration
- `models/Notification.js` - Notification history model
- `services/fcmService.js` - FCM service layer
- `services/notificationService.js` - Notification business logic
- `utils/notificationTemplates.js` - Notification message templates
- `controllers/notifications.js` - API controller
- `routes/notifications.js` - API routes
- `middleware/notificationMiddleware.js` - Validation middleware
- `jobs/notificationJobs.js` - Background jobs

### Modified Files
- `models/User.js` - Added FCM tokens, notification settings, and badges
- `server.js` - Added notification routes
- `socket/socketHandler.js` - Added push notification for chat messages
- `controllers/moments.js` - Added notification for moment likes
- `controllers/comments.js` - Added notification for comments
- `controllers/users.js` - Added notification for friend requests
- `jobs/scheduler.js` - Added notification job scheduling
- `.gitignore` - Added Firebase service account exclusion
- `config/config.env` - Added Firebase project ID
- `package.json` - Added firebase-admin dependency

## Security Considerations

1. **Service Account Key:** Never commit `*firebase-adminsdk*.json` files to git
2. **Token Storage:** FCM tokens are stored securely in MongoDB
3. **Authentication:** All notification endpoints require authentication
4. **Rate Limiting:** Existing rate limiters apply to notification endpoints
5. **User Privacy:** Respects user notification preferences and muted chats
6. **Token Cleanup:** Automatic removal of invalid/expired tokens

## Performance Optimization

1. **Batch Sending:** `sendToUsers` supports batch notifications
2. **Async Processing:** Notifications sent asynchronously, don't block main flow
3. **Token Caching:** Active tokens retrieved efficiently from database
4. **History Cleanup:** TTL index + scheduled job prevent database bloat
5. **Conditional Sending:** Checks preferences before sending to save API calls

## Next Steps

1. Complete Flutter app integration
2. Test on physical iOS and Android devices
3. Monitor FCM delivery reports
4. Fine-tune notification frequency based on user feedback
5. Add notification analytics (delivery rates, click rates)
6. Implement notification templates for multiple languages
7. Add notification grouping/bundling for multiple notifications
8. Implement notification scheduling for specific times

## Support

For issues or questions:
- Check server logs for detailed error messages
- Review Firebase Console for delivery metrics
- Test with the `/api/v1/notifications/test` endpoint
- Verify user settings and token registration

## References

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK for Node.js](https://firebase.google.com/docs/admin/setup)
- [iOS Push Notifications](https://developer.apple.com/notifications/)
- [Android Notification Channels](https://developer.android.com/training/notify-user/channels)

