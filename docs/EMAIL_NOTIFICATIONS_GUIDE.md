# BananaTalk Email Notifications System

Complete guide for the email notification system, including when emails are sent and how to configure them.

---

## Table of Contents

1. [Overview](#overview)
2. [Email Types](#email-types)
3. [When Emails Are Sent](#when-emails-are-sent)
4. [User Preferences](#user-preferences)
5. [Configuration](#configuration)
6. [Scheduled Jobs](#scheduled-jobs)
7. [Email Templates](#email-templates)
8. [Testing](#testing)
9. [Recommendations](#recommendations)

---

## Overview

The email system uses **Mailgun** for delivery and includes:

- 🔐 **Security emails** (password changes, new logins)
- 👋 **Welcome email** (first-time registration)
- 💤 **Inactivity reminders** (re-engagement)
- 📊 **Weekly digests** (activity summary)
- 🔔 **Notification emails** (followers, messages, corrections)
- 👑 **Transactional emails** (VIP subscription)

---

## Email Types

### 🔐 Security Emails

| Email | Trigger | Template |
|-------|---------|----------|
| Password Changed | User updates password via settings | `passwordChangedEmail` |
| Password Reset | User resets password via forgot password | `passwordChangedEmail` |
| New Device Login | First login from a new device/IP | `newLoginEmail` |

### 👋 Onboarding Emails

| Email | Trigger | Template |
|-------|---------|----------|
| Welcome | User completes registration | `welcomeEmail` |
| Email Verification | User requests verification code | (Existing) |

### 💤 Re-engagement Emails

| Email | Trigger | Days Inactive | Template |
|-------|---------|---------------|----------|
| First Reminder | User inactive | 7 days | `inactivityReminder` |
| Second Reminder | Still inactive | 14 days | `inactivityReminder` |
| Warning | Still inactive | 21 days | `accountDeactivationWarning` |
| Final Warning | Still inactive | 28 days | `accountDeactivationWarning` |

### 📊 Engagement Emails

| Email | Trigger | Frequency | Template |
|-------|---------|-----------|----------|
| Weekly Digest | Scheduled job | Weekly (Sundays) | `weeklyDigest` |

### 🔔 Notification Emails

| Email | Trigger | Template |
|-------|---------|----------|
| New Follower | Someone follows you | `newFollowerEmail` |
| New Message | Message received (when inactive 24h+) | `newMessageEmail` |
| Correction Received | Someone corrects your message | `correctionReceivedEmail` |

### 👑 Transactional Emails

| Email | Trigger | Template |
|-------|---------|----------|
| VIP Subscription | User upgrades to VIP | `vipSubscriptionEmail` |

---

## When Emails Are Sent

### Automatic (Trigger-Based)

```
📌 REGISTRATION FLOW
├── User completes registration → Welcome Email ✅
└── Email verified → (Already implemented)

📌 PASSWORD FLOW
├── Password changed in settings → Password Changed Email ✅
└── Password reset via email → Password Changed Email ✅

📌 LOGIN FLOW
└── Login from new device → New Device Login Email ✅

📌 PURCHASE FLOW
└── VIP subscription activated → VIP Confirmation Email
```

### Scheduled (Cron Jobs)

```
📅 DAILY AT 9:00 AM
├── Check users inactive 7+ days → First Reminder
├── Check users inactive 14+ days → Second Reminder
├── Check users inactive 21+ days → Warning
└── Check users inactive 28+ days → Final Warning

📅 SUNDAYS AT 10:00 AM
└── Send weekly activity digest to all active users

📅 HOURLY
└── Archive expired stories (no email)
```

---

## User Preferences

Users can control their email preferences in `privacySettings`:

```javascript
// In User model
privacySettings: {
  emailNotifications: true,      // Master switch for all emails
  weeklyDigest: true,            // Weekly activity summary
  newMessageEmails: true,        // New message alerts (only when inactive 24h+)
  newFollowerEmails: true,       // New follower notifications
  securityAlerts: true           // Password changes, new logins
}
```

### Frontend Settings UI

```typescript
interface EmailPreferences {
  emailNotifications: boolean;   // "Receive email notifications"
  weeklyDigest: boolean;         // "Weekly activity summary"
  newMessageEmails: boolean;     // "Email me when I receive a message"
  newFollowerEmails: boolean;    // "Email me when someone follows me"
  securityAlerts: boolean;       // "Security alerts (password changes, new logins)"
}
```

---

## Configuration

### Environment Variables

```env
# Mailgun Configuration
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_REGION=us                    # or 'eu' for EU region
FROM_NAME=BananaTalk
FROM_EMAIL=noreply@banatalk.com

# Scheduler
ENABLE_SCHEDULER=true                # Set to 'false' to disable scheduled jobs
```

### Enabling/Disabling Scheduler

The scheduler starts automatically when the server starts. To disable:

```env
ENABLE_SCHEDULER=false
```

Or in code:

```javascript
// In server.js
if (process.env.ENABLE_SCHEDULER !== 'false') {
  const { startScheduler } = require('./jobs/scheduler');
  startScheduler();
}
```

---

## Scheduled Jobs

### Running Jobs Manually

```javascript
// Run specific job
const { runInactivityCheck } = require('./jobs/inactivityEmailJob');
const { runWeeklyDigest } = require('./jobs/weeklyDigestJob');

await runInactivityCheck();
await runWeeklyDigest();

// Run all jobs now (for testing)
const { runAllJobsNow } = require('./jobs/scheduler');
await runAllJobsNow();
```

### Running via CLI

Create a script to run jobs:

```bash
# Create run-jobs.js
node -e "
  require('./config/db')();
  const { runAllJobsNow } = require('./jobs/scheduler');
  runAllJobsNow().then(() => process.exit(0));
"
```

### Using PM2 Cron

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'banana-api',
    script: 'server.js',
    // ... other config
  }, {
    name: 'banana-jobs',
    script: 'jobs/scheduler.js',
    instances: 1,
    cron_restart: '0 9 * * *'  // Restart daily at 9 AM
  }]
};
```

---

## Email Templates

All templates are in `utils/emailTemplates.js`. They feature:

- 📱 Responsive design (works on mobile)
- 🎨 Beautiful gradients and styling
- 🌈 Consistent branding
- 🔗 Action buttons

### Template Functions

```javascript
const templates = require('./utils/emailTemplates');

// Welcome email
const welcome = templates.welcomeEmail('John');
// Returns: { subject, html, text }

// Password changed
const pwChanged = templates.passwordChangedEmail('John', {
  device: 'iPhone 14',
  ipAddress: '192.168.1.1',
  location: 'San Francisco, CA'
});

// New login
const newLogin = templates.newLoginEmail('John', deviceInfo);

// Inactivity reminder
const inactive = templates.inactivityReminder('John', 7);

// Deactivation warning
const warning = templates.accountDeactivationWarning('John', 14);

// Weekly digest
const digest = templates.weeklyDigest('John', {
  messagesSent: 45,
  momentLikes: 23,
  newFollowers: 5,
  correctionsReceived: 3
});

// New follower
const follower = templates.newFollowerEmail('John', 'Jane', 'https://...');

// New message
const message = templates.newMessageEmail('John', 'Jane', 'Hey there!');

// Correction received
const correction = templates.correctionReceivedEmail(
  'John', 'Jane', 
  'I go to store', 
  'I went to the store'
);

// VIP subscription
const vip = templates.vipSubscriptionEmail('John', 'Monthly', new Date('2024-02-01'));
```

---

## Testing

### Send Test Email

```javascript
const emailService = require('./services/emailService');
const User = require('./models/User');

// Get a user
const user = await User.findById('user_id');

// Test welcome email
await emailService.sendWelcomeEmail(user);

// Test password changed email
await emailService.sendPasswordChangedEmail(user, {
  device: 'Test Device',
  ipAddress: '127.0.0.1'
});

// Test inactivity reminder
await emailService.sendInactivityReminder(user, 7);

// Test weekly digest
await emailService.sendWeeklyDigest(user, {
  messagesSent: 10,
  momentLikes: 5,
  newFollowers: 2
});
```

### Test Scheduled Jobs

```javascript
const { runAllJobsNow } = require('./jobs/scheduler');
await runAllJobsNow();
```

---

## Recommendations

### 📧 When to Send Emails

#### ✅ DEFINITELY Send

| Event | Why |
|-------|-----|
| Welcome (registration) | First impression, onboarding |
| Password changed | Security, user awareness |
| New device login | Security alert |
| Inactivity reminders | Re-engagement |
| VIP subscription | Confirmation, trust |

#### 🤔 Consider Sending (Based on Preferences)

| Event | Why | When |
|-------|-----|------|
| New follower | Engagement | User has notifications enabled |
| New message | Engagement | User inactive for 24+ hours |
| Language corrections | Learning value | User has notifications enabled |
| Weekly digest | Retention | User opted in |

#### ❌ Don't Over-Email

- **Don't** send for every single like/comment
- **Don't** send if user was active recently (< 1 hour)
- **Don't** send multiple emails in quick succession (batch them)
- **Don't** ignore user preferences

### 🎯 Best Practices

1. **Respect Preferences**
   - Always check `privacySettings.emailNotifications` first
   - Provide granular controls for each email type

2. **Smart Timing**
   - Don't send message notifications if user is online
   - Batch multiple events into one email
   - Send weekly digest on weekends (Sunday 10 AM)

3. **Rate Limiting**
   - Max 1 inactivity email per user per week
   - Max 1 notification email per hour per user
   - Track `lastInactivityEmailAt` to avoid spam

4. **Content Quality**
   - Use the user's name
   - Include relevant context
   - Have clear call-to-action buttons
   - Keep subject lines under 50 characters

### 🚀 Future Enhancements

1. **Push Notifications** - For immediate alerts
2. **In-App Notifications** - For active users
3. **Email Batching** - Combine multiple notifications
4. **Unsubscribe Links** - One-click unsubscribe
5. **Email Analytics** - Track open rates, clicks
6. **A/B Testing** - Optimize subject lines
7. **Localization** - Translate emails to user's language

---

## File Structure

```
backend/
├── utils/
│   ├── sendEmail.js           # Mailgun sender
│   └── emailTemplates.js      # Beautiful HTML templates
├── services/
│   └── emailService.js        # Email sending service
├── jobs/
│   ├── scheduler.js           # Job scheduler
│   ├── inactivityEmailJob.js  # Inactivity check job
│   └── weeklyDigestJob.js     # Weekly digest job
└── controllers/
    └── auth.js                # Triggers security emails
```

---

## Summary

| Trigger | Email Sent |
|---------|------------|
| User registers | ✅ Welcome |
| Password changed | ✅ Password Changed |
| Password reset | ✅ Password Changed |
| New device login | ✅ New Device Alert |
| 7 days inactive | ⏰ First Reminder |
| 14 days inactive | ⏰ Second Reminder |
| 21 days inactive | ⏰ Warning |
| 28 days inactive | ⏰ Final Warning |
| Every Sunday | ⏰ Weekly Digest |
| New follower | 🔔 New Follower (if enabled) |
| New message (inactive 24h+) | 🔔 New Message (if enabled) |
| VIP purchase | 💳 VIP Confirmation |

