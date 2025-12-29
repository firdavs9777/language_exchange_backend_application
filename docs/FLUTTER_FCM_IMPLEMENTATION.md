# Flutter FCM Token Registration - Complete Guide

## 🚨 Current Issue

**Backend logs show:**
```
ℹ️ No active FCM tokens for user 694358a0b696bd1f501ff051
```

**This means:** Flutter app is NOT registering FCM tokens with the backend.

---

## ✅ Solution: Complete Flutter Implementation

### 1️⃣ Add Dependencies

```yaml
# pubspec.yaml
dependencies:
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.9
  device_info_plus: ^9.1.1
  http: ^1.1.0
```

Run:
```bash
flutter pub get
```

---

### 2️⃣ Create FCM Service

Create `lib/services/fcm_service.dart`:

```dart
import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class FCMService {
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  String? _fcmToken;
  String? _deviceId;

  /// Initialize FCM and request permissions
  Future<void> initialize() async {
    print('🔔 Initializing FCM...');
    
    // Request notification permissions (iOS)
    NotificationSettings settings = await _firebaseMessaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('✅ Notification permission granted');
      
      // Get FCM token
      _fcmToken = await _firebaseMessaging.getToken();
      print('📱 FCM Token: $_fcmToken');
      
      // Get device ID
      _deviceId = await _getDeviceId();
      print('📱 Device ID: $_deviceId');
      
      // Listen for token refresh
      _firebaseMessaging.onTokenRefresh.listen((newToken) {
        print('🔄 FCM Token refreshed: $newToken');
        _fcmToken = newToken;
        registerTokenWithBackend(); // Re-register with backend
      });
      
      // Setup message handlers
      _setupMessageHandlers();
      
    } else {
      print('❌ Notification permission denied');
    }
  }

  /// Get unique device identifier
  Future<String> _getDeviceId() async {
    final deviceInfo = DeviceInfoPlugin();
    try {
      if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        return iosInfo.identifierForVendor ?? 'unknown-ios';
      } else if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        return androidInfo.id ?? 'unknown-android';
      }
    } catch (e) {
      print('⚠️ Error getting device ID: $e');
    }
    return 'unknown-device';
  }

  /// Register FCM token with your backend
  Future<bool> registerTokenWithBackend() async {
    if (_fcmToken == null || _deviceId == null) {
      print('⚠️ Cannot register: FCM token or device ID is null');
      return false;
    }

    try {
      // Get auth token from your storage
      final authToken = await _getAuthToken(); // Implement this based on your auth
      
      if (authToken == null) {
        print('⚠️ Cannot register: User not authenticated');
        return false;
      }

      print('📤 Registering FCM token with backend...');

      final response = await http.post(
        Uri.parse('https://api.banatalk.com/api/v1/notifications/register-token'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        },
        body: jsonEncode({
          'fcmToken': _fcmToken,
          'platform': Platform.isIOS ? 'ios' : 'android',
          'deviceId': _deviceId,
        }),
      );

      if (response.statusCode == 200) {
        print('✅ FCM token registered successfully!');
        return true;
      } else {
        print('❌ Failed to register token: ${response.statusCode}');
        print('Response: ${response.body}');
        return false;
      }
    } catch (e) {
      print('❌ Error registering FCM token: $e');
      return false;
    }
  }

  /// Remove token when user logs out
  Future<void> unregisterToken() async {
    if (_deviceId == null) return;

    try {
      final authToken = await _getAuthToken();
      if (authToken == null) return;

      print('📤 Unregistering FCM token...');

      await http.delete(
        Uri.parse('https://api.banatalk.com/api/v1/notifications/remove-token/$_deviceId'),
        headers: {
          'Authorization': 'Bearer $authToken',
        },
      );

      print('✅ FCM token unregistered');
      await _firebaseMessaging.deleteToken();
      _fcmToken = null;
    } catch (e) {
      print('❌ Error unregistering token: $e');
    }
  }

  /// Setup message handlers
  void _setupMessageHandlers() {
    // Foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('📬 Foreground message received');
      print('Title: ${message.notification?.title}');
      print('Body: ${message.notification?.body}');
      print('Data: ${message.data}');
      
      // Show in-app notification or update UI
      _handleMessage(message);
    });

    // Background message tap
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('📬 Background message tapped');
      print('Data: ${message.data}');
      
      // Navigate to appropriate screen
      _handleMessageTap(message);
    });

    // Check if app was opened from terminated state
    _firebaseMessaging.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) {
        print('📬 App opened from terminated state');
        print('Data: ${message.data}');
        _handleMessageTap(message);
      }
    });
  }

  /// Handle foreground message
  void _handleMessage(RemoteMessage message) {
    // TODO: Show in-app notification or update UI
    // Example: Update unread count, show snackbar, etc.
  }

  /// Handle message tap (navigate to screen)
  void _handleMessageTap(RemoteMessage message) {
    final type = message.data['type'];
    
    switch (type) {
      case 'chat_message':
        final conversationId = message.data['conversationId'];
        final senderId = message.data['senderId'];
        // TODO: Navigate to chat screen
        print('🔀 Navigate to chat: $conversationId');
        break;
        
      case 'moment_like':
      case 'moment_comment':
        final momentId = message.data['momentId'];
        // TODO: Navigate to moment detail
        print('🔀 Navigate to moment: $momentId');
        break;
        
      case 'friend_request':
        final userId = message.data['userId'];
        // TODO: Navigate to user profile or friends screen
        print('🔀 Navigate to user profile: $userId');
        break;
        
      case 'profile_visit':
        final visitorId = message.data['visitorId'];
        // TODO: Navigate to visitor profile
        print('🔀 Navigate to visitor profile: $visitorId');
        break;
        
      default:
        print('❓ Unknown notification type: $type');
    }
  }

  /// Get auth token from storage (implement based on your auth)
  Future<String?> _getAuthToken() async {
    // TODO: Implement this based on your authentication system
    // Example with SharedPreferences:
    // final prefs = await SharedPreferences.getInstance();
    // return prefs.getString('auth_token');
    
    // For now, return null - YOU MUST IMPLEMENT THIS
    return null;
  }
}

/// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  print('📬 Background message received');
  print('Title: ${message.notification?.title}');
  print('Body: ${message.notification?.body}');
  print('Data: ${message.data}');
}
```

---

### 3️⃣ Initialize in main.dart

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'services/fcm_service.dart';
import 'firebase_options.dart'; // Generated by FlutterFire CLI

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  
  // Register background message handler
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  
  runApp(MyApp());
}
```

---

### 4️⃣ Call After Login

In your login/auth flow:

```dart
// After successful login
await FCMService().initialize();
await FCMService().registerTokenWithBackend();
```

In your logout flow:

```dart
// Before logout
await FCMService().unregisterToken();
```

---

## 🔧 Critical Implementation Details

### 1. **Implement `_getAuthToken()`**

Replace the placeholder in `fcm_service.dart`:

```dart
Future<String?> _getAuthToken() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString('auth_token'); // Or however you store it
}
```

### 2. **iOS Configuration**

Add to `ios/Runner/Info.plist`:

```xml
<key>FirebaseAppDelegateProxyEnabled</key>
<false/>
```

### 3. **Android Configuration**

Already done if you've set up Firebase properly.

---

## 🧪 Testing Steps

### 1. **Enable Debug Logging**

Run your app and watch the console:

```bash
flutter run
```

**Expected logs:**
```
🔔 Initializing FCM...
✅ Notification permission granted
📱 FCM Token: dR8H4G3...
📱 Device ID: ABC123...
📤 Registering FCM token with backend...
✅ FCM token registered successfully!
```

### 2. **Check Backend Logs**

After registration, you should see:

```
POST /api/v1/notifications/register-token 200
```

### 3. **Verify Database**

Connect to MongoDB and check:

```javascript
db.users.findOne(
  { _id: ObjectId("694358a0b696bd1f501ff051") },
  { fcmTokens: 1 }
)
```

**Expected:**
```json
{
  "_id": ObjectId("694358a0b696bd1f501ff051"),
  "fcmTokens": [
    {
      "token": "dR8H4G3vRs2...",
      "platform": "ios",
      "deviceId": "ABC123...",
      "lastUpdated": ISODate("2025-12-18T..."),
      "active": true
    }
  ]
}
```

### 4. **Test Push Notification**

Send a message while recipient is offline:

**Before (current):**
```
ℹ️ No active FCM tokens for user 694358a0b696bd1f501ff051
```

**After fix:**
```
📤 Sending notification to 694358a0b696bd1f501ff051
✅ Push notification sent: 1/1 successful
```

---

## 🚨 Common Issues

### Issue 1: "Permission denied"
**Solution:** User needs to accept notification permissions on first launch.

### Issue 2: "Token is null"
**Solution:** Firebase might not be initialized. Check Firebase console.

### Issue 3: "401 Unauthorized"
**Solution:** Auth token not being sent or is expired. Check `_getAuthToken()`.

### Issue 4: "Device ID is null"
**Solution:** Add `device_info_plus` dependency and check platform.

---

## ✅ Success Checklist

- [ ] Firebase dependencies added
- [ ] `fcm_service.dart` created
- [ ] `_getAuthToken()` implemented with your actual auth logic
- [ ] FCM initialized in `main.dart`
- [ ] `registerTokenWithBackend()` called after login
- [ ] iOS Info.plist configured
- [ ] App runs without errors
- [ ] Console shows "✅ FCM token registered successfully!"
- [ ] Backend logs show successful POST to `/register-token`
- [ ] Database contains FCM token in user document
- [ ] Test message triggers push notification
- [ ] Backend logs show "✅ Push notification sent"

---

## 📞 Backend Endpoints Reference

Your backend is already configured with these endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/notifications/register-token` | Register FCM token |
| DELETE | `/api/v1/notifications/remove-token/:deviceId` | Remove token on logout |
| GET | `/api/v1/notifications/settings` | Get notification preferences |
| PUT | `/api/v1/notifications/settings` | Update preferences |
| GET | `/api/v1/notifications/history` | Get notification history |
| POST | `/api/v1/notifications/mark-read/:id` | Mark notification as read |
| GET | `/api/v1/notifications/badge-count` | Get unread counts |
| POST | `/api/v1/notifications/test` | Test notification |

All require `Authorization: Bearer <token>` header.

---

## 🎯 Next Steps

1. **Implement the Flutter code above**
2. **Test token registration**
3. **Verify in database**
4. **Test push notifications**
5. **Monitor backend logs for success**

Once the Flutter app registers tokens, your backend will automatically send push notifications when users are offline! 🚀

