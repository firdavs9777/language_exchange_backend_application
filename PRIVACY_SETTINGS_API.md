# Privacy Settings API Documentation

## 📋 Overview

The Privacy Settings API allows users to control what information is visible to others and manage their privacy preferences. All privacy settings are boolean flags that default to `true` (visible/enabled).

**Base URL**: `/api/v1/auth/users/:userId/privacy`

---

## 📊 Privacy Settings Model

### Privacy Settings Schema

```javascript
{
  privacySettings: {
    showCountryRegion: Boolean,      // Show country/region in profile (default: true)
    showCity: Boolean,                // Show city in profile (default: true)
    showAge: Boolean,                 // Show age in profile (default: true)
    showZodiac: Boolean,             // Show zodiac sign in profile (default: true)
    showOnlineStatus: Boolean,       // Show online/offline status (default: true)
    showGiftingLevel: Boolean,       // Show gifting level/points (default: true)
    birthdayNotification: Boolean,   // Enable birthday notifications (default: true)
    personalizedAds: Boolean         // Enable personalized advertisements (default: true)
  }
}
```

---

## 🔗 API Endpoints

### 1. Get Privacy Settings

**GET** `/api/v1/auth/users/:userId/privacy`

Get the privacy settings for a specific user. Users can only view their own privacy settings.

**Access**: Private (users can only view their own settings)

**Headers**:
```
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "user_id",
    "privacySettings": {
      "showCountryRegion": true,
      "showCity": true,
      "showAge": true,
      "showZodiac": true,
      "showOnlineStatus": true,
      "showGiftingLevel": true,
      "birthdayNotification": true,
      "personalizedAds": true
    }
  }
}
```

**Error Responses**:
- `403`: Not authorized (trying to view another user's settings)
- `404`: User not found

---

### 2. Update Privacy Settings

**PUT** `/api/v1/auth/users/:userId/privacy`

Update privacy settings for a user. Users can only update their own privacy settings.

**Access**: Private (users can only update their own settings)

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "privacySettings": {
    "showCountryRegion": false,
    "showCity": false,
    "showAge": true,
    "showZodiac": true,
    "showOnlineStatus": false,
    "showGiftingLevel": true,
    "birthdayNotification": true,
    "personalizedAds": false
  }
}
```

**Note**: You can update any subset of privacy settings. Only provided fields will be updated; others will remain unchanged.

**Response**:
```json
{
  "success": true,
  "message": "Privacy settings updated successfully",
  "data": {
    "_id": "user_id",
    "privacySettings": {
      "showCountryRegion": false,
      "showCity": false,
      "showAge": true,
      "showZodiac": true,
      "showOnlineStatus": false,
      "showGiftingLevel": true,
      "birthdayNotification": true,
      "personalizedAds": false
    }
  }
}
```

**Error Responses**:
- `400`: Invalid privacy settings format
- `403`: Not authorized (trying to update another user's settings)
- `404`: User not found

---

### 3. Update Privacy Settings via General Update Endpoint

**PUT** `/api/v1/auth/updatedetails`

You can also update privacy settings as part of the general user update endpoint.

**Access**: Private

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Updated Name",
  "bio": "Updated bio",
  "privacySettings": {
    "showAge": false,
    "showOnlineStatus": false
  }
}
```

**Response**: Same as regular update details response, includes updated privacy settings.

---

## 🔒 Security

- **Authorization**: Users can only view and update their own privacy settings
- **Validation**: All privacy settings are validated as boolean values
- **Partial Updates**: You can update any subset of privacy settings
- **Merge Behavior**: Privacy settings are merged with existing settings (not replaced entirely)

---

## 📝 Privacy Settings Details

### `showCountryRegion`
- Controls visibility of country/region information in user profile
- `true`: Country/region is visible to others
- `false`: Country/region is hidden

### `showCity`
- Controls visibility of city information in user profile
- `true`: City is visible to others
- `false`: City is hidden

### `showAge`
- Controls visibility of age (calculated from birth date) in user profile
- `true`: Age is visible to others
- `false`: Age is hidden

### `showZodiac`
- Controls visibility of zodiac sign (calculated from birth date) in user profile
- `true`: Zodiac sign is visible to others
- `false`: Zodiac sign is hidden

### `showOnlineStatus`
- Controls visibility of online/offline status
- `true`: Online status is visible to others
- `false`: Online status is hidden

### `showGiftingLevel`
- Controls visibility of gifting level/points/achievements
- `true`: Gifting level is visible to others
- `false`: Gifting level is hidden

### `birthdayNotification`
- Controls whether user receives birthday notifications
- `true`: Birthday notifications enabled
- `false`: Birthday notifications disabled

### `personalizedAds`
- Controls whether user receives personalized advertisements
- `true`: Personalized ads enabled
- `false`: Personalized ads disabled (generic ads shown)

---

## 🎯 Usage Examples

### Update Single Privacy Setting

```bash
PUT /api/v1/auth/users/690d9c131d3dffd532bbbc75/privacy
Headers: Authorization: Bearer <token>
Body: {
  "privacySettings": {
    "showAge": false
  }
}
```

### Update Multiple Privacy Settings

```bash
PUT /api/v1/auth/users/690d9c131d3dffd532bbbc75/privacy
Headers: Authorization: Bearer <token>
Body: {
  "privacySettings": {
    "showAge": false,
    "showCity": false,
    "showOnlineStatus": false,
    "personalizedAds": false
  }
}
```

### Update Privacy Settings via General Update

```bash
PUT /api/v1/auth/updatedetails
Headers: Authorization: Bearer <token>
Body: {
  "name": "John Doe",
  "privacySettings": {
    "showAge": false
  }
}
```

### Get Privacy Settings

```bash
GET /api/v1/auth/users/690d9c131d3dffd532bbbc75/privacy
Headers: Authorization: Bearer <token>
```

---

## ⚠️ Important Notes

1. **Default Values**: All privacy settings default to `true` (visible/enabled)
2. **Partial Updates**: You can update any subset of settings; others remain unchanged
3. **Merge Behavior**: Settings are merged with existing values, not replaced
4. **Authorization**: Users can only access their own privacy settings
5. **Validation**: All settings must be boolean values

---

## 🔄 Implementation Details

### Database Schema
Privacy settings are stored as a nested object in the User model:
```javascript
privacySettings: {
  showCountryRegion: { type: Boolean, default: true },
  showCity: { type: Boolean, default: true },
  showAge: { type: Boolean, default: true },
  showZodiac: { type: Boolean, default: true },
  showOnlineStatus: { type: Boolean, default: true },
  showGiftingLevel: { type: Boolean, default: true },
  birthdayNotification: { type: Boolean, default: true },
  personalizedAds: { type: Boolean, default: true }
}
```

### Update Logic
When updating privacy settings:
1. System merges new settings with existing settings
2. Only provided fields are updated
3. Unspecified fields remain unchanged
4. All values are validated as booleans

---

## 🧪 Testing Checklist

- [ ] Get privacy settings (own user)
- [ ] Get privacy settings (other user - should fail)
- [ ] Update single privacy setting
- [ ] Update multiple privacy settings
- [ ] Update all privacy settings
- [ ] Update privacy settings via general update endpoint
- [ ] Verify settings persist after update
- [ ] Test with invalid boolean values (should fail)
- [ ] Test authorization (other user's settings - should fail)

---

**Last Updated**: January 2025
**API Version**: v1
**Status**: ✅ Production Ready

