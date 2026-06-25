# 🚀 Engagement Push Notifications - Quick Start Guide

Get automatic engagement campaigns running in **30 minutes**.

---

## Step 1: Verify FCM Setup (5 min)

```bash
# Check Firebase config is loaded
grep -i "firebase\|fcm" config/firebase.js | head -5

# Verify FCM service exists
ls -la services/fcmService.js
```

✅ **Expected**: Files exist and have content

---

## Step 2: Test the Broadcast API (10 min)

### Get Admin Token
1. Login to app as admin user
2. Copy JWT token from localStorage/auth response

### Send Test Broadcast
```bash
# Send to all users
curl -X POST http://localhost:5003/api/v1/notifications/broadcast \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetAudience": "all",
    "title": "🎉 Test Campaign",
    "body": "Congrats! You received a test notification.",
    "data": { "route": "/home" }
  }'
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "targetAudience": "all",
    "totalUsers": 574,
    "delivered": 450,
    "failed": 30
  }
}
```

✅ **Success**: See high delivery rate (>80%)

---

## Step 3: Enable Re-engagement Campaign (5 min)

### Check if Job is Running
```bash
# In server logs, should see:
# "💌 Sending re-engagement notifications..." every 24 hours

# Or manually trigger:
node -e "
require('dotenv').config({ path: './config/config.env' });
const jobs = require('./jobs/notificationJobs');
jobs.sendReengagementNotifications().then(result => {
  console.log('Result:', result);
  process.exit(0);
});
"
```

### Add to Scheduler (if not running)
```javascript
// In jobs/scheduler.js, ensure this is included:
const { sendReengagementNotifications } = require('./notificationJobs');

// Add to scheduler (runs daily):
schedule.scheduleJob('0 2 * * *', sendReengagementNotifications); // 2 AM daily
```

✅ **Success**: Job runs and sends notifications to inactive users

---

## Step 4: Customize Campaign Messages (10 min)

### Edit Re-engagement Messages
**File**: `utils/notificationTemplates.js` (line 127-156)

**Current messages** (randomized):
1. "Still working on [Language]?"
2. "Quick practice session?"
3. "Vocabulary fades without review"

**To customize**, edit the `messages` array:

```javascript
const getReengagementTemplate = (user = {}) => {
  const lang = (user.language_to_learn && String(user.language_to_learn).trim()) || 'your language';

  const messages = [
    {
      title: `Still working on ${lang}?`,
      body: 'Your study deck and practice partners are waiting on BananaTalk',
    },
    {
      title: 'Quick practice session?',
      body: `5 minutes with the AI Tutor is enough to keep your ${lang} moving`,
    },
    {
      title: 'Vocabulary fades without review',
      body: 'Your saved words are ready — open BananaTalk to keep them fresh',
    },
    // ✅ ADD YOUR CUSTOM MESSAGE HERE:
    {
      title: 'Your streak is paused 🔥',
      body: `Don't lose your momentum! Open BananaTalk to keep your ${lang} streak alive.`,
    },
    {
      title: 'Your practice partners miss you!',
      body: 'Someone wants to chat with you about ${lang}',
    },
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  return {
    ...randomMessage,
    data: {
      type: 'system',
      screen: 'home',
    },
  };
};
```

✅ **Updated**: Re-engagement messages now include custom variants

---

## Step 5: Adjust Notification Caps (5 min)

### View Current Caps
**File**: `config/notificationCaps.js`

```javascript
module.exports = {
  daily: {
    moment_like: 5,      // 5 likes per day
    moment_comment: 10,  // 10 comments per day
    profile_visit: 3,    // 3 visits per day
    follower_moment: 5,  // 5 follower moments per day
    friend_request: 10,  // 10 requests per day
  },
  weekly: {
    re_engagement: 1,    // 1 re-engagement per week
    digest: 1,           // 1 digest per week
  },
};
```

### Adjust for Your Campaign
```javascript
module.exports = {
  daily: {
    moment_like: 5,
    moment_comment: 10,
    profile_visit: 3,
    follower_moment: 5,
    friend_request: 10,
    // ✅ ADD YOUR CAMPAIGN CAPS:
    streak_reminder: 1,        // 1 streak reminder per day
    free_trial_expiring: 1,    // 1 trial expiring warning per day
    achievement: 2,            // 2 achievements per day
  },
  weekly: {
    re_engagement: 1,
    digest: 1,
  },
};
```

✅ **Updated**: Notification caps now include new campaign types

---

## Step 6: Monitor Delivery (Ongoing)

### Check Notification History
```bash
# See all notifications sent
curl -X GET 'http://localhost:5003/api/v1/notifications/history?limit=50' \
  -H "Authorization: Bearer USER_TOKEN"
```

### Monitor Server Logs
```bash
# Watch for notification sends
tail -f | grep "📢\|✅ Broadcast\|💌 Sending re-engagement"
```

### Check User Preferences
```bash
# Verify user has marketing notifications enabled
curl -X GET http://localhost:5003/api/v1/notifications/settings \
  -H "Authorization: Bearer USER_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "chatMessages": true,
    "moments": true,
    "marketing": true,  // ✅ This must be true
    "sound": true,
    "vibration": true
  }
}
```

---

## What Happens Next

### Day 1: Re-engagement Enabled
- 📊 ~480 users inactive 7+ days
- 🔔 ~400 receive re-engagement notification
- 📈 Track opens in logs

### Day 2-7: Monitor Performance
- ✅ How many opened the notification?
- ✅ How many clicked through to app?
- ✅ How many are now active?

### Week 2: Add More Campaigns
- Streak reminders
- Trial expiring warnings
- Achievement notifications

---

## Troubleshooting

### ❌ "No users match the target audience"
```javascript
// Check if any users exist with tokens
db.users.countDocuments({ 'fcmTokens.0': { $exists: true } })
// Should return: >0

// Check if users have marketing enabled
db.users.countDocuments({ 'notificationSettings.marketing': true })
// Should return: >0
```

### ❌ "Delivered: 0 / Failed: 574"
**Cause**: No valid FCM tokens registered

**Fix**:
1. Open app on device
2. App automatically registers FCM token
3. Then try broadcast again

### ❌ User not receiving notifications
**Check in order**:
1. Is user's phone connected to internet?
2. Does app have notification permission?
3. Is notifications enabled in app settings?
4. Is user in quiet hours? (Default: 22:00-08:00 Asia/Seoul)

---

## Performance Expectations

| Metric | Value |
|--------|-------|
| **Broadcast 574 users** | ~3 seconds |
| **Delivery rate** | 80-95% (depends on user connectivity) |
| **FCM latency** | <5 seconds (usually <1s) |
| **Open rate** | 20-40% (measure after launch) |
| **Cost** | Free tier covers ~500k notif/month |

---

## Next Steps

- [ ] Test broadcast to "all" audience
- [ ] Enable re-engagement job
- [ ] Customize re-engagement messages
- [ ] Check server logs for sends
- [ ] Monitor open rates for 1 week
- [ ] Add streak reminder campaign
- [ ] Add trial expiring campaign
- [ ] Set up A/B testing (optional)

**Estimated time to full engagement system**: **1 week**

---

## Help & Support

### Check Notification Service Logs
```bash
# Look for notification-related logs
grep -i "notification\|fcm\|broadcast" server.log | tail -20
```

### Enable Debug Logging
```javascript
// Add to fcmService.js before sendToUser
console.log(`📤 Sending notification to ${userId}:`, {
  title: notification.title,
  body: notification.body,
  timestamp: new Date().toISOString()
});
```

### Test Single User
```bash
curl -X POST http://localhost:5003/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "moment_like"
  }'
```

**Result**: You should receive a test notification on your device within 5 seconds
