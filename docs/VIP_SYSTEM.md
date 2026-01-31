# BananaTalk VIP System Documentation

**Last Updated**: January 31, 2026
**Version**: 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [User Tiers](#user-tiers)
3. [Feature Limits by Tier](#feature-limits-by-tier)
4. [How to Upgrade to VIP](#how-to-upgrade-to-vip)
5. [API Endpoints](#api-endpoints)
6. [Frontend Integration](#frontend-integration)
7. [Error Handling](#error-handling)

---

## Overview

BananaTalk uses a three-tier user system to provide free access while offering premium features for paying subscribers.

| Tier | Description |
|------|-------------|
| **Visitor** | Unverified users or users browsing without full registration |
| **Regular** | Standard registered and verified users (free) |
| **VIP** | Premium subscribers with enhanced features |

---

## User Tiers

### Visitor
- Limited access to basic features
- Cannot create content (moments, stories)
- Cannot use voice features
- Cannot search nearby users
- Encouraged to register/verify email

### Regular (Free)
- Full access to core features with daily limits
- Can create content, chat, and join voice rooms
- Access to AI features with hourly limits
- Nearby search within 50km radius

### VIP (Premium)
- Unlimited access to most features
- Extended nearby search (500km)
- Priority in search results
- Exclusive features (read receipts, profile viewers, etc.)
- Higher AI usage limits
- Ad-free experience

---

## Feature Limits by Tier

### Messaging

| Feature | Visitor | Regular | VIP |
|---------|---------|---------|-----|
| Messages per day | 10 | 100 | Unlimited |
| Voice messages per day | 0 | 20 | Unlimited |

### Content Creation

| Feature | Visitor | Regular | VIP |
|---------|---------|---------|-----|
| Moments per day | 0 | 10 | Unlimited |
| Stories per day | 0 | 5 | Unlimited |
| Comments per day | 5 | 50 | Unlimited |

### Social Features

| Feature | Visitor | Regular | VIP |
|---------|---------|---------|-----|
| Profile views per day | 20 | 100 | Unlimited |
| Waves per day | 3 | 15 | Unlimited |
| Follows per day | 10 | 50 | Unlimited |

### Community Features

| Feature | Visitor | Regular | VIP |
|---------|---------|---------|-----|
| Nearby search | No | Yes | Yes |
| Search radius | - | 50km | 500km |
| See online status | No | No | Yes |
| See who viewed profile | No | No | Yes |
| Priority in search | No | No | Yes |

### Voice Rooms

| Feature | Visitor | Regular | VIP |
|---------|---------|---------|-----|
| Create voice rooms | No | Yes | Yes |
| Rooms per day | 0 | 3 | Unlimited |
| Max duration | - | 30 min | Unlimited |
| Max participants | - | 8 | 50 |
| Record rooms | No | No | Yes |

### AI Features (per hour)

| Feature | Visitor | Regular | VIP |
|---------|---------|---------|-----|
| AI Conversation | 5 | 20 | 200 |
| Grammar Check | 10 | 30 | 500 |
| Translation | 20 | 50 | 1000 |
| Quiz Generation | 3 | 10 | 100 |
| Lesson Builder | 0 | 5 | 50 |
| Pronunciation | 5 | 30 | 500 |
| Text-to-Speech | 10 | 50 | 1000 |
| Speech-to-Text | 5 | 20 | 500 |

### Learning

| Feature | Visitor | Regular | VIP |
|---------|---------|---------|-----|
| Vocabulary words | 50 | 500 | Unlimited |
| Lessons per day | 3 | 10 | Unlimited |

### Storage Limits

| Feature | Visitor | Regular | VIP |
|---------|---------|---------|-----|
| Photo upload | 5 MB | 10 MB | 50 MB |
| Video upload | 0 | 50 MB | 500 MB |
| Voice upload | 0 | 10 MB | 100 MB |

### VIP Exclusive Features

- Ad-free experience
- Priority support
- Early access to new features
- Exclusive profile badge
- Custom themes
- Read receipts
- See who viewed profile
- Undo sent messages
- Schedule messages

---

## How to Upgrade to VIP

### Available Plans

| Plan | Duration | Price |
|------|----------|-------|
| Monthly | 1 month | $9.99 |
| Quarterly | 3 months | $24.99 |
| Yearly | 12 months | $79.99 |
| Lifetime | Forever | $199.99 |

### Upgrade Endpoints

#### 1. Get VIP Plans

```
GET /api/v1/purchases/vip/plans
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "monthly",
      "name": "Monthly VIP",
      "price": 9.99,
      "currency": "USD",
      "duration": "1 month",
      "features": ["Unlimited messages", "500km nearby", "..."]
    },
    {
      "id": "yearly",
      "name": "Yearly VIP",
      "price": 79.99,
      "currency": "USD",
      "duration": "12 months",
      "savings": "33%",
      "features": ["..."]
    }
  ]
}
```

#### 2. Create Purchase (In-App Purchase)

```
POST /api/v1/purchases/vip
```

**Request:**
```json
{
  "plan": "monthly",
  "paymentMethod": "apple_iap",
  "receipt": "base64_receipt_data",
  "transactionId": "transaction_123"
}
```

**Payment Methods:**
- `apple_iap` - Apple In-App Purchase
- `google_play` - Google Play Billing
- `stripe` - Stripe (web)

**Response:**
```json
{
  "success": true,
  "data": {
    "purchaseId": "purchase_123",
    "plan": "monthly",
    "startDate": "2026-01-31T00:00:00Z",
    "endDate": "2026-02-28T00:00:00Z",
    "isActive": true
  }
}
```

#### 3. Verify Purchase Receipt

```
POST /api/v1/purchases/vip/verify
```

**Request:**
```json
{
  "platform": "ios",
  "receipt": "base64_receipt_data"
}
```

#### 4. Check VIP Status

```
GET /api/v1/auth/me
```

**Response includes:**
```json
{
  "success": true,
  "data": {
    "_id": "user_123",
    "name": "John",
    "userMode": "vip",
    "vipSubscription": {
      "isActive": true,
      "plan": "monthly",
      "startDate": "2026-01-31T00:00:00Z",
      "endDate": "2026-02-28T00:00:00Z",
      "autoRenew": true
    },
    "vipFeatures": {
      "unlimitedMessages": true,
      "prioritySupport": true,
      "adFree": true,
      "readReceipts": true,
      "whoViewedProfile": true
    }
  }
}
```

#### 5. Cancel VIP Subscription

```
POST /api/v1/purchases/vip/cancel
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription cancelled. VIP access continues until 2026-02-28."
}
```

---

## API Endpoints

### Get User Limits

```
GET /api/v1/community/limits
```

Returns current user's tier, limits, and usage.

**Response:**
```json
{
  "success": true,
  "data": {
    "tier": "regular",
    "isVip": false,
    "vipExpiry": null,
    "limits": {
      "messagesPerDay": 100,
      "voiceMessagesPerDay": 20,
      "momentsPerDay": 10,
      "storiesPerDay": 5,
      "wavesPerDay": 15,
      "nearbySearchEnabled": true,
      "nearbyRadius": 50,
      "aiConversationPerHour": 20,
      "vocabularyLimit": 500
    },
    "usage": {
      "messagesPerDay": 45,
      "momentsPerDay": 2,
      "storiesPerDay": 1,
      "wavesSentToday": 5
    },
    "upgradeAvailable": true
  }
}
```

---

## Frontend Integration

### Checking Limits Before Actions

```dart
class LimitsService {
  Future<UserLimits> getLimits() async {
    final response = await api.get('/community/limits');
    return UserLimits.fromJson(response.data['data']);
  }

  Future<bool> canSendMessage() async {
    final limits = await getLimits();
    if (limits.isVip) return true;
    return limits.usage.messagesPerDay < limits.limits.messagesPerDay;
  }

  Future<bool> canSearchNearby() async {
    final limits = await getLimits();
    return limits.limits.nearbySearchEnabled;
  }
}
```

### Handling Limit Errors

```dart
void handleApiError(DioError error) {
  if (error.response?.statusCode == 403) {
    final data = error.response?.data;

    // Feature not available for tier
    showUpgradeDialog(
      title: 'Premium Feature',
      message: data['error'],
      showUpgradeButton: true
    );
  }

  if (error.response?.statusCode == 429) {
    final data = error.response?.data;

    if (data['upgradeAvailable'] == true) {
      // Limit reached, can upgrade
      showUpgradeDialog(
        title: 'Limit Reached',
        message: data['error'],
        showUpgradeButton: true
      );
    } else {
      // VIP user hit limit (rare)
      showSnackBar('Please try again later');
    }
  }
}
```

### Showing Upgrade Prompts

```dart
void showUpgradeDialog({
  required String title,
  required String message,
  bool showUpgradeButton = true,
}) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message),
          if (showUpgradeButton) ...[
            SizedBox(height: 16),
            Text(
              'Upgrade to VIP for unlimited access!',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Later'),
        ),
        if (showUpgradeButton)
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pushNamed(context, '/vip-upgrade');
            },
            child: Text('Upgrade Now'),
          ),
      ],
    ),
  );
}
```

### VIP Badge Display

```dart
Widget buildUserAvatar(User user) {
  return Stack(
    children: [
      CircleAvatar(
        backgroundImage: NetworkImage(user.imageUrl),
      ),
      if (user.isVip)
        Positioned(
          bottom: 0,
          right: 0,
          child: Container(
            padding: EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: Colors.amber,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.star, size: 12, color: Colors.white),
          ),
        ),
    ],
  );
}
```

---

## Error Handling

### Error Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 401 | Not authenticated | Redirect to login |
| 403 | Feature not available for tier | Show upgrade prompt |
| 429 | Rate/daily limit reached | Show limit message + upgrade option |

### Error Response Format

```json
{
  "success": false,
  "error": "Daily message limit reached (100). Upgrade to VIP for unlimited messages.",
  "limitReached": true,
  "current": 100,
  "limit": 100,
  "upgradeAvailable": true,
  "feature": "messagesPerDay"
}
```

### Graceful Degradation

When limits are reached:

1. **Messaging**: Show "Limit reached" with remaining time until reset
2. **AI Features**: Show upgrade prompt or countdown to next hour
3. **Content Creation**: Disable create button, show limit info
4. **Nearby Search**: Show upgrade prompt for visitors

---

## User Model Fields

```javascript
{
  userMode: 'visitor' | 'regular' | 'vip',

  vipSubscription: {
    isActive: Boolean,
    plan: 'monthly' | 'quarterly' | 'yearly' | 'lifetime',
    startDate: Date,
    endDate: Date,
    autoRenew: Boolean,
    paymentMethod: String,
    lastPaymentDate: Date
  },

  vipFeatures: {
    unlimitedMessages: Boolean,
    prioritySupport: Boolean,
    adFree: Boolean,
    readReceipts: Boolean,
    whoViewedProfile: Boolean,
    customThemes: Boolean,
    undoMessage: Boolean,
    scheduleMessages: Boolean
  }
}
```

---

## Testing VIP

### Activate VIP (Admin/Testing)

```
POST /api/v1/auth/users/:userId/activate-vip
Authorization: Bearer <admin_token>
```

**Body:**
```json
{
  "plan": "monthly",
  "paymentMethod": "manual"
}
```

### Deactivate VIP (Admin)

```
POST /api/v1/auth/users/:userId/deactivate-vip
Authorization: Bearer <admin_token>
```

---

## Scheduled Jobs

### VIP Expiry Check

Runs daily to:
1. Check for expired VIP subscriptions
2. Downgrade expired users to 'regular'
3. Send expiry reminder emails (3 days, 1 day before)
4. Process auto-renewals

---

## Questions?

For questions about the VIP system:
1. Check `config/limitations.js` for limit values
2. Check `middleware/checkLimitations.js` for enforcement logic
3. Check `models/User.js` for VIP-related methods

---

**Document Version**: 1.0
**Author**: Backend Team
