# Frontend API Documentation

## 📋 Table of Contents
1. [User Limitations System](#user-limitations-system)
2. [VIP Subscription & iOS Purchases](#vip-subscription--ios-purchases)
3. [API Endpoints](#api-endpoints)
4. [Error Handling](#error-handling)
5. [Code Examples](#code-examples)

---

## 👥 User Limitations System

### User Modes

The application supports three user modes with different limitations:

#### 1. **Visitor** (Limited Access)
- **Messages**: 10 per day
- **Profile Views**: 20 per day
- **Moments**: Cannot create
- **Stories**: Cannot create
- **Comments**: Cannot create

#### 2. **Regular** (Standard Access)
- **Messages**: 50 per day
- **Moments**: 5 per day
- **Stories**: 3 per day
- **Comments**: 20 per day
- **Profile Views**: 100 per day

#### 3. **VIP** (Unlimited Access)
- **All Features**: Unlimited
- **No Ads**: Enabled
- **Priority Support**: Enabled
- **Advanced Search**: Enabled
- **Translation Feature**: Enabled
- **Custom Badge**: Enabled

### Daily Limit Reset
All daily limits reset at **midnight (00:00)** in the server's timezone.

---

## 💎 VIP Subscription & iOS Purchases

### Subscription Plans
- **Monthly**: 1 month subscription
- **Quarterly**: 3 months subscription
- **Yearly**: 12 months subscription

### VIP Features
When a user becomes VIP, they automatically get:
- ✅ Unlimited messages
- ✅ Unlimited moments
- ✅ Unlimited stories
- ✅ Unlimited comments
- ✅ No advertisements
- ✅ Priority customer support
- ✅ Advanced search features
- ✅ Translation feature
- ✅ Custom badge display

---

## 🔗 API Endpoints

### Base URL
```
/api/v1
```

### Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

### User Limitations

#### Get User Limits
Get current limitation status for a user.

**Endpoint**: `GET /api/v1/auth/users/:userId/limits`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (Regular User):
```json
{
  "success": true,
  "data": {
    "userMode": "regular",
    "isVIP": false,
    "limits": {
      "messages": {
        "current": 15,
        "max": 50,
        "remaining": 35
      },
      "moments": {
        "current": 2,
        "max": 5,
        "remaining": 3
      },
      "stories": {
        "current": 1,
        "max": 3,
        "remaining": 2
      },
      "comments": {
        "current": 8,
        "max": 20,
        "remaining": 12
      },
      "profileViews": {
        "current": 45,
        "max": 100,
        "remaining": 55
      }
    },
    "resetTime": "2025-01-16T00:00:00.000Z"
  }
}
```

**Response** (VIP User):
```json
{
  "success": true,
  "data": {
    "userMode": "vip",
    "isVIP": true,
    "limits": {
      "messages": {
        "current": 0,
        "max": "unlimited",
        "remaining": "unlimited"
      },
      "moments": {
        "current": 0,
        "max": "unlimited",
        "remaining": "unlimited"
      },
      "stories": {
        "current": 0,
        "max": "unlimited",
        "remaining": "unlimited"
      },
      "comments": {
        "current": 0,
        "max": "unlimited",
        "remaining": "unlimited"
      },
      "profileViews": {
        "current": 0,
        "max": "unlimited",
        "remaining": "unlimited"
      }
    },
    "resetTime": null
  }
}
```

---

### VIP Subscription

#### Get VIP Status
Get current VIP subscription status.

**Endpoint**: `GET /api/v1/auth/users/:userId/vip/status`

**Headers**:
```
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "isVIP": true,
    "userMode": "vip",
    "vipSubscription": {
      "isActive": true,
      "plan": "monthly",
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2025-02-01T00:00:00.000Z",
      "autoRenew": true,
      "paymentMethod": "apple_iap",
      "lastPaymentDate": "2025-01-01T00:00:00.000Z",
      "nextBillingDate": "2025-02-01T00:00:00.000Z"
    },
    "vipFeatures": {
      "unlimitedMessages": true,
      "prioritySupport": true,
      "noAds": true,
      "customBadge": true,
      "advancedSearch": true,
      "translationFeature": true
    }
  }
}
```

---

### iOS Purchases

#### Verify iOS Purchase
Verify an iOS in-app purchase receipt and activate VIP subscription.

**Endpoint**: `POST /api/v1/purchases/ios/verify`

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "receiptData": "base64_encoded_receipt_string",
  "productId": "com.yourapp.vip.monthly",  // Optional
  "transactionId": "1000000123456789"      // Optional
}
```

**Note**: If `productId` and `transactionId` are not provided, the API will use the most recent purchase from the receipt.

**Response** (Success):
```json
{
  "success": true,
  "message": "VIP subscription activated successfully",
  "data": {
    "plan": "monthly",
    "isActive": true,
    "endDate": "2025-02-01T00:00:00.000Z",
    "nextBillingDate": "2025-02-01T00:00:00.000Z",
    "userMode": "vip",
    "vipFeatures": {
      "unlimitedMessages": true,
      "prioritySupport": true,
      "noAds": true,
      "customBadge": true,
      "advancedSearch": true,
      "translationFeature": true
    }
  }
}
```

**Response** (Already VIP - Extension):
If user is already VIP with Apple IAP, the subscription is extended from the current end date.

---

#### Check Subscription Status
Verify current subscription status from Apple receipt.

**Endpoint**: `POST /api/v1/purchases/ios/subscription-status`

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "receiptData": "base64_encoded_receipt_string"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "isActive": true,
    "expiresDate": "2025-02-01T00:00:00.000Z",
    "productId": "com.yourapp.vip.monthly",
    "userVIPStatus": {
      "isVIP": true,
      "userMode": "vip",
      "subscriptionEndDate": "2025-02-01T00:00:00.000Z",
      "subscriptionPlan": "monthly"
    }
  }
}
```

---

## ⚠️ Error Handling

### Limit Exceeded Error

When a user exceeds their daily limit, the API returns a `429 Too Many Requests` error.

**Status Code**: `429`

**Response**:
```json
{
  "success": false,
  "error": "Daily messages limit exceeded. You have used 50 of 50 messages today. Limit resets at 1/16/2025, 12:00:00 AM."
}
```

**Error Response Structure**:
```json
{
  "success": false,
  "error": "<error_message>"
}
```

### Common Error Codes

| Status Code | Description |
|------------|-------------|
| `400` | Bad Request - Invalid input data |
| `401` | Unauthorized - Missing or invalid token |
| `403` | Forbidden - Not authorized for this action |
| `404` | Not Found - Resource not found |
| `429` | Too Many Requests - Daily limit exceeded |
| `500` | Internal Server Error |

### Limit Exceeded Error Details

The error message includes:
- **Limit Type**: messages, moments, stories, comments, profileViews
- **Current Usage**: Number of items used today
- **Maximum Allowed**: Daily limit for the user type
- **Reset Time**: When the limit resets (midnight)

**Example Error Messages**:
```
"Daily messages limit exceeded. You have used 50 of 50 messages today. Limit resets at 1/16/2025, 12:00:00 AM."
"Daily moments limit exceeded. You have used 5 of 5 moments today. Limit resets at 1/16/2025, 12:00:00 AM."
"Visitors cannot create moments. Please upgrade to regular user."
```

---

## 💻 Code Examples

### React/React Native Example

#### Check User Limits Before Action

```javascript
// Check if user can perform an action
const checkUserLimits = async (userId, token) => {
  try {
    const response = await fetch(
      `https://api.yourapp.com/api/v1/auth/users/${userId}/limits`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      const { limits, userMode, isVIP } = data.data;
      
      // Check if user can send message
      if (limits.messages.remaining === 0 && !isVIP) {
        return {
          canProceed: false,
          message: `Daily message limit reached. ${limits.messages.current}/${limits.messages.max} messages used.`
        };
      }
      
      return {
        canProceed: true,
        limits: limits,
        userMode: userMode,
        isVIP: isVIP
      };
    }
  } catch (error) {
    console.error('Error checking limits:', error);
    return { canProceed: false, error: error.message };
  }
};

// Usage before sending message
const sendMessage = async (message, receiverId) => {
  const limitsCheck = await checkUserLimits(currentUserId, authToken);
  
  if (!limitsCheck.canProceed) {
    Alert.alert('Limit Reached', limitsCheck.message);
    return;
  }
  
  // Proceed with sending message
  // ... your message sending logic
};
```

#### Handle Limit Exceeded Error

```javascript
const handleApiError = (error, response) => {
  if (response.status === 429) {
    // Limit exceeded
    const errorMessage = error.error || 'Daily limit exceeded';
    
    // Extract reset time from error message
    const resetTimeMatch = errorMessage.match(/resets at (.+)/);
    const resetTime = resetTimeMatch ? resetTimeMatch[1] : 'midnight';
    
    Alert.alert(
      'Daily Limit Reached',
      `${errorMessage}\n\nYour limit will reset at ${resetTime}.`,
      [
        { text: 'OK' },
        { 
          text: 'Upgrade to VIP', 
          onPress: () => navigateToVIPScreen() 
        }
      ]
    );
  } else {
    // Handle other errors
    Alert.alert('Error', error.error || 'Something went wrong');
  }
};
```

#### Verify iOS Purchase

```javascript
import * as StoreKit from 'expo-storekit';

const verifyIOSPurchase = async (receipt, productId, transactionId, token) => {
  try {
    // Get receipt data from StoreKit
    const receiptData = await StoreKit.getReceiptAsync();
    
    const response = await fetch(
      'https://api.yourapp.com/api/v1/purchases/ios/verify',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receiptData: receiptData,
          productId: productId,
          transactionId: transactionId
        })
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      // VIP activated successfully
      Alert.alert(
        'Success!',
        'VIP subscription activated successfully!',
        [{ text: 'OK', onPress: () => refreshUserData() }]
      );
      
      return data.data;
    } else {
      throw new Error(data.error || 'Purchase verification failed');
    }
  } catch (error) {
    console.error('Purchase verification error:', error);
    Alert.alert('Error', error.message);
    throw error;
  }
};

// Usage with StoreKit purchase
const handlePurchase = async (productId) => {
  try {
    // Initiate purchase
    const purchase = await StoreKit.purchaseItemAsync(productId);
    
    if (purchase) {
      // Verify purchase with backend
      await verifyIOSPurchase(
        purchase.receipt,
        productId,
        purchase.transactionId,
        authToken
      );
    }
  } catch (error) {
    console.error('Purchase error:', error);
  }
};
```

#### Check VIP Status

```javascript
const checkVIPStatus = async (userId, token) => {
  try {
    const response = await fetch(
      `https://api.yourapp.com/api/v1/auth/users/${userId}/vip/status`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      const { isVIP, vipSubscription, vipFeatures } = data.data;
      
      return {
        isVIP: isVIP,
        subscription: vipSubscription,
        features: vipFeatures
      };
    }
  } catch (error) {
    console.error('Error checking VIP status:', error);
    return null;
  }
};

// Usage
const userVIPStatus = await checkVIPStatus(currentUserId, authToken);
if (userVIPStatus?.isVIP) {
  // Show VIP badge, disable ads, etc.
  console.log('User is VIP until:', userVIPStatus.subscription.endDate);
}
```

#### Display Limit Information in UI

```javascript
const LimitIndicator = ({ limitType, limits, userMode }) => {
  if (userMode === 'vip') {
    return <Text>✨ Unlimited {limitType}</Text>;
  }
  
  const { current, max, remaining } = limits[limitType];
  const percentage = (current / max) * 100;
  
  return (
    <View>
      <Text>{limitType}: {current}/{max}</Text>
      <ProgressBar 
        progress={percentage / 100} 
        color={remaining === 0 ? 'red' : 'green'} 
      />
      <Text>{remaining} remaining today</Text>
    </View>
  );
};
```

---

## 📱 iOS Purchase Flow

### Complete Purchase Flow

1. **User initiates purchase** in iOS app
2. **StoreKit processes payment**
3. **Get receipt** from StoreKit
4. **Send receipt to backend** via `/api/v1/purchases/ios/verify`
5. **Backend validates** with Apple
6. **Backend activates VIP** subscription
7. **Frontend updates UI** to show VIP status
8. **Apple sends webhooks** for renewals/cancellations (handled automatically)

### Product ID Format

Recommended product ID format:
```
com.yourapp.vip.monthly
com.yourapp.vip.quarterly
com.yourapp.vip.yearly
```

The backend automatically detects the plan from the product ID.

---

## 🔄 Real-time Updates

### When Limits Reset

- Limits reset automatically at midnight (server time)
- No need to manually refresh - next API call will reflect updated limits
- VIP users don't need to worry about limits

### When Subscription Changes

- **Renewal**: Automatically handled via Apple webhooks
- **Cancellation**: User remains VIP until end date
- **Expiration**: VIP automatically deactivated when subscription expires

---

## 🎯 Best Practices

### For Frontend Developers

1. **Check limits before actions**: Always check user limits before allowing actions
2. **Show limit indicators**: Display remaining limits in UI
3. **Handle 429 errors gracefully**: Show upgrade prompts when limits are reached
4. **Cache VIP status**: Cache VIP status to reduce API calls
5. **Verify purchases immediately**: Verify iOS purchases right after StoreKit purchase
6. **Handle subscription status**: Periodically check subscription status for expired subscriptions

### Error Handling

```javascript
// Always handle limit errors
try {
  await sendMessage(message, receiverId);
} catch (error) {
  if (error.status === 429) {
    // Show upgrade prompt
    showUpgradePrompt();
  } else {
    // Handle other errors
    showError(error.message);
  }
}
```

### UI Recommendations

- Show limit progress bars for regular users
- Display "Unlimited" badge for VIP users
- Show upgrade prompts when limits are reached
- Display subscription end date for VIP users
- Show countdown to limit reset

---

## 📞 Support

For questions or issues:
- Check error messages for specific limit information
- Verify user mode (visitor/regular/vip)
- Check subscription status for VIP users
- Review transaction history in VIP status response

---

**Last Updated**: January 2025  
**API Version**: v1  
**Status**: ✅ Production Ready

