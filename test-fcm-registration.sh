#!/bin/bash

# Test FCM Token Registration Endpoint
# This simulates what your Flutter app should be doing

echo "🧪 Testing FCM Token Registration"
echo "=================================="
echo ""

# Configuration
API_URL="http://localhost:5003/api/v1/notifications/register-token"
# API_URL="https://api.banatalk.com/api/v1/notifications/register-token"

# Get auth token from user
echo "📝 Enter your auth token (from login):"
read AUTH_TOKEN

if [ -z "$AUTH_TOKEN" ]; then
    echo "❌ Auth token is required"
    exit 1
fi

# Test data
FAKE_FCM_TOKEN="test_fcm_token_$(date +%s)"
DEVICE_ID="test_device_$(date +%s)"
PLATFORM="ios" # or "android"

echo ""
echo "📤 Sending registration request..."
echo "Token: $FAKE_FCM_TOKEN"
echo "Device ID: $DEVICE_ID"
echo "Platform: $PLATFORM"
echo ""

# Make request
RESPONSE=$(curl -X POST "$API_URL" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"fcmToken\": \"$FAKE_FCM_TOKEN\",
    \"platform\": \"$PLATFORM\",
    \"deviceId\": \"$DEVICE_ID\"
  }" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -s)

# Extract status code
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS")

echo "📥 Response:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Token registration successful!"
    echo ""
    echo "🔍 Now check MongoDB:"
    echo "db.users.findOne({ _id: ObjectId('YOUR_USER_ID') }, { fcmTokens: 1 })"
else
    echo "❌ Registration failed with status: $HTTP_STATUS"
    echo ""
    echo "Common issues:"
    echo "  - 401: Invalid or expired auth token"
    echo "  - 400: Missing or invalid parameters"
    echo "  - 500: Server error (check backend logs)"
fi

