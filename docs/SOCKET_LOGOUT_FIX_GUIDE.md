# Socket Logout/Login Fix - Complete Guide

## 🐛 Problem

When logging out and logging in with a different user account, the socket connection was not being properly cleaned up, causing:
- Messages from the old account appearing in the new account
- Socket events being delivered to the wrong user
- Duplicate connections
- Room contamination

---

## ✅ Backend Fixes Applied

### 1. **Force Disconnect Old Sockets on New Login**

When a user connects, the backend now:
- Checks if the user already has connections
- Force disconnects any old sockets for that user
- Cleans up old connection data
- Creates a fresh connection

```javascript
// Before new connection
if (userConnections.has(userId)) {
  // Disconnect all old sockets for this user
  for (const oldSocketId of existingSockets) {
    oldSocket.disconnect(true);
  }
}
```

### 2. **Explicit Logout Handler**

Added a new socket event `'logout'` that:
- Clears all typing indicators
- Leaves all rooms
- Removes from user connections
- Broadcasts offline status
- Disconnects the socket cleanly

```javascript
socket.on('logout', async (data, callback) => {
  // Clean up everything
  // Disconnect socket
});
```

### 3. **Improved Disconnect Handler**

Enhanced disconnect logic to:
- Explicitly leave all rooms
- Clear socket user data
- Better cleanup of typing timeouts
- Prevent resource leaks

---

## 📱 Flutter Implementation Required

### 1. **Update Socket Service - Add Explicit Logout**

In your `SocketService` class:

```dart
class SocketService {
  IO.Socket? _socket;
  
  // ... existing code ...
  
  /// Disconnect socket on logout
  Future<void> logout() async {
    if (_socket == null || !_socket!.connected) {
      print('🔌 Socket not connected, skipping logout');
      return;
    }
    
    try {
      print('🔌 Sending logout event to server...');
      
      // Send explicit logout event to backend
      _socket!.emitWithAck('logout', {}, ack: (data) {
        print('✅ Logout acknowledged: $data');
      });
      
      // Wait a bit for the event to be sent
      await Future.delayed(Duration(milliseconds: 500));
      
      // Disconnect the socket
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
      
      print('✅ Socket disconnected successfully');
      
    } catch (e) {
      print('❌ Error during socket logout: $e');
      
      // Force disconnect even if error
      try {
        _socket?.disconnect();
        _socket?.dispose();
        _socket = null;
      } catch (disposeError) {
        print('⚠️ Error disposing socket: $disposeError');
      }
    }
  }
}
```

### 2. **Update Your Logout Flow**

```dart
Future<void> logout() async {
  try {
    print('👋 Starting logout process...');
    
    // 1. FIRST: Disconnect socket (while still authenticated)
    print('1️⃣ Disconnecting socket...');
    await SocketService().logout();
    
    // 2. SECOND: Remove FCM token (while still authenticated)
    print('2️⃣ Removing FCM token...');
    await FCMService().unregisterToken();
    
    // 3. THIRD: Call logout API
    print('3️⃣ Calling logout API...');
    await AuthService().logout();
    
    // 4. FOURTH: Clear local storage
    print('4️⃣ Clearing local storage...');
    await _clearUserData();
    
    // 5. FINALLY: Navigate to login
    print('5️⃣ Navigating to login...');
    Navigator.pushReplacementNamed(context, '/login');
    
    print('✅ Logout completed successfully');
    
  } catch (e) {
    print('❌ Error during logout: $e');
    
    // Still complete logout even if errors
    await _clearUserData();
    Navigator.pushReplacementNamed(context, '/login');
  }
}

Future<void> _clearUserData() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove('auth_token');
  await prefs.remove('user_id');
  // Clear other user-specific data
}
```

### 3. **Update Login Flow - Ensure Clean Socket Connection**

```dart
Future<void> login(String email, String password) async {
  try {
    print('🔐 Starting login process...');
    
    // 1. Make sure any existing socket is disconnected
    print('1️⃣ Cleaning up any existing socket...');
    if (SocketService().isConnected) {
      await SocketService().logout();
    }
    
    // 2. Login API call
    print('2️⃣ Calling login API...');
    final response = await http.post(
      Uri.parse('$API_URL/auth/login'),
      body: jsonEncode({'email': email, 'password': password}),
    );
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final token = data['token'];
      final userId = data['data']['_id'];
      
      // 3. Save auth data
      print('3️⃣ Saving auth data...');
      await _saveAuthData(token, userId);
      
      // 4. Connect socket with new token
      print('4️⃣ Connecting socket...');
      await SocketService().connect(token, userId);
      
      // 5. Register FCM token
      print('5️⃣ Registering FCM token...');
      await FCMService().registerTokenWithBackend();
      
      print('✅ Login completed successfully');
      Navigator.pushReplacementNamed(context, '/home');
      
    } else {
      throw Exception('Login failed');
    }
    
  } catch (e) {
    print('❌ Login error: $e');
    // Handle error
  }
}
```

### 4. **Handle App Lifecycle - Disconnect on App Close**

```dart
class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }
  
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
        // App in background - you might want to keep socket alive
        print('📱 App paused');
        break;
        
      case AppLifecycleState.resumed:
        // App in foreground
        print('📱 App resumed');
        
        // Reconnect if needed
        if (!SocketService().isConnected && isUserLoggedIn) {
          SocketService().connect(token, userId);
        }
        break;
        
      case AppLifecycleState.detached:
        // App is closing
        print('📱 App closing - disconnecting socket');
        SocketService().logout();
        break;
        
      default:
        break;
    }
  }
}
```

---

## 🧪 Testing the Fix

### Test Case 1: Simple Logout/Login
1. User A logs in
2. User A logs out
3. User B logs in on same device
4. ✅ User B should NOT receive User A's messages

### Test Case 2: Switch Accounts
1. User A is logged in and has active chat
2. User A logs out
3. User B logs in immediately
4. ✅ User B's socket should be clean and separate

### Test Case 3: Force Disconnect Old Sessions
1. User A logs in on Device 1
2. User A logs in on Device 2
3. ✅ Device 1's socket should be force disconnected
4. ✅ User A should only have 1 active connection

### Test Case 4: Reconnection After Network Loss
1. User A is logged in
2. Network disconnects
3. Network reconnects
4. ✅ Socket should reconnect with correct user
5. ✅ No duplicate connections

---

## 📊 Backend Logs to Watch For

### ✅ Good Login Flow
```
🔑 Socket auth attempt from: undefined
✅ User 694358a0b696bd1f501ff051 authenticated
⚠️ User 694358a0b696bd1f501ff051 already has 1 connection(s), cleaning up old sockets...
🔌 Disconnecting old socket abc123 for user 694358a0b696bd1f501ff051
✅ User 694358a0b696bd1f501ff051 connected (socket: xyz789)
👤 User 694358a0b696bd1f501ff051 joined room: user_694358a0b696bd1f501ff051
```

### ✅ Good Logout Flow
```
👋 User 694358a0b696bd1f501ff051 logging out (explicit)
📤 User 694358a0b696bd1f501ff051 left room: user_694358a0b696bd1f501ff051
✅ User 694358a0b696bd1f501ff051 logged out successfully
❌ User 694358a0b696bd1f501ff051 disconnected (socket: xyz789): server namespace disconnect
📴 User 694358a0b696bd1f501ff051 is now offline
```

### ❌ Bad Signs (Problems to Watch For)
```
⚠️ User 694358a0b696bd1f501ff051 already has 5 connection(s)  // Too many!
📤 Message: ABC → XYZ (but XYZ is not logged in anymore)     // Wrong user!
```

---

## 🔧 Additional Improvements

### 1. **Socket Connection Timeout**

```dart
// In SocketService.connect()
_socket = IO.io(
  SERVER_URL,
  IO.OptionBuilder()
    .setTransports(['websocket'])
    .setAuth({'token': token})
    .setTimeout(5000)  // ← Add timeout
    .setReconnectionDelay(1000)
    .setReconnectionDelayMax(5000)
    .build(),
);
```

### 2. **Prevent Auto-Reconnect After Logout**

```dart
bool _shouldReconnect = true;

void logout() {
  _shouldReconnect = false;  // Prevent auto-reconnect
  _socket?.disconnect();
}

void _setupSocketListeners() {
  _socket?.on('disconnect', (_) {
    if (_shouldReconnect) {
      // Reconnect
    } else {
      print('🚫 Not reconnecting - user logged out');
    }
  });
}
```

### 3. **Add User ID Validation**

```dart
// After connecting, verify you're connected as the right user
void connect(String token, String userId) async {
  // ... connect socket ...
  
  // Verify identity
  _socket?.emit('whoami', {}, (data) {
    if (data['userId'] != userId) {
      print('⚠️ Socket connected as wrong user!');
      logout();
      throw Exception('Socket identity mismatch');
    }
  });
}
```

---

## 📋 Deployment Checklist

### Backend
- [x] Updated socket handler with force disconnect logic
- [x] Added explicit logout event handler
- [x] Improved disconnect cleanup
- [ ] Deploy updated socketHandler.js to production
- [ ] Restart server: `pm2 restart language-app`
- [ ] Monitor logs for proper cleanup

### Flutter
- [ ] Update SocketService with logout() method
- [ ] Update logout flow to call socket.logout() first
- [ ] Update login flow to cleanup existing socket
- [ ] Add app lifecycle handlers
- [ ] Test all scenarios
- [ ] Deploy to production

---

## 🎯 Expected Results After Fix

✅ **Clean logout** - All resources properly cleaned up
✅ **No cross-user contamination** - Each user gets only their data
✅ **Single active connection** - Old sockets force disconnected
✅ **Proper reconnection** - Works correctly after network issues
✅ **Clean login** - Fresh socket connection for each session

---

## 🆘 Troubleshooting

### Issue: Still receiving old user's messages
**Solution:** 
- Make sure Flutter calls `SocketService().logout()` before API logout
- Check backend logs to verify old socket is disconnected
- Clear app cache/data and try again

### Issue: Socket not connecting after login
**Solution:**
- Check token is being passed correctly
- Verify backend is receiving the token
- Check backend logs for authentication errors

### Issue: Multiple duplicate connections
**Solution:**
- Make sure only calling `connect()` once
- Check app lifecycle handlers aren't reconnecting unnecessarily
- Verify logout is properly disconnecting

---

## 📞 Support

Check logs:
```bash
# Backend
pm2 logs language-app --lines 50

# Flutter
// Console output during logout/login
```

**The key fix is: Call socket logout BEFORE API logout, with proper cleanup on both sides!** 🎯

