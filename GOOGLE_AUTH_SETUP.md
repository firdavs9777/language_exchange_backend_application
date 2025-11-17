# Google OAuth Setup Guide

## ✅ Implementation Complete

Google login has been successfully integrated into your authentication system! It follows the same secure pattern as Facebook login.

## 📋 Setup Instructions

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API** (or **Google Identity API**)
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Configure:
   - **Authorized JavaScript origins**: 
     - `http://localhost:5003` (for development)
     - `https://yourdomain.com` (for production)
   - **Authorized redirect URIs**:
     - `http://localhost:5003/api/v1/auth/google/callback` (for development)
     - `https://yourdomain.com/api/v1/auth/google/callback` (for production)
7. Copy the **Client ID** and **Client Secret**

### 2. Update Environment Variables

Add to your `config/config.env` file:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

### 3. Restart Your Server

After adding the credentials, restart your server for the changes to take effect.

## 🔗 API Endpoints

### Google Login
```
GET /api/v1/auth/google
```
Redirects user to Google OAuth consent screen.

### Google Callback
```
GET /api/v1/auth/google/callback
```
Handles the OAuth callback from Google and logs the user in.

## 🔒 Security Features

✅ **Same security as Facebook login:**
- Email pre-verified (Google users skip email verification)
- Automatic account linking (if email matches existing account)
- Device tracking
- Security logging
- Refresh token generation

## 📝 How It Works

1. User clicks "Login with Google"
2. Redirected to Google OAuth consent screen
3. User authorizes the application
4. Google redirects back to `/api/v1/auth/google/callback`
5. System checks if user exists:
   - By Google ID (if previously logged in with Google)
   - By email (if email matches existing account, links Google account)
   - Creates new user if doesn't exist
6. User is automatically logged in with access token and refresh token

## 🎯 User Flow

### New User (First Time Google Login)
1. User logs in with Google
2. Account is created automatically
3. Email is marked as verified
4. Registration is marked as complete
5. User receives access token and refresh token
6. Can immediately use the app

### Existing User (Email Match)
1. User logs in with Google
2. System finds existing account by email
3. Google ID is linked to existing account
4. User is logged in with existing account data
5. Profile picture from Google is added if user doesn't have one

### Existing Google User
1. User logs in with Google
2. System finds account by Google ID
3. User is logged in immediately

## 🔧 Configuration

The Google OAuth strategy is configured in `controllers/auth.js`:

```javascript
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/v1/auth/google/callback',
    },
    // ... handler
  )
);
```

## 📊 Database Schema

The `User` model now includes:
```javascript
googleId: {
  type: String,
  unique: true,
  sparse: true,
}
```

## 🧪 Testing

1. **Test Google Login:**
   ```bash
   # Visit in browser
   http://localhost:5003/api/v1/auth/google
   ```

2. **Check User Creation:**
   - New users should be created with `googleId`, `isEmailVerified: true`, `isRegistrationComplete: true`

3. **Test Account Linking:**
   - Create a user with email manually
   - Login with Google using the same email
   - Check that `googleId` is added to existing user

## ⚠️ Important Notes

1. **Callback URL**: Make sure the callback URL in Google Console matches exactly:
   - Development: `http://localhost:5003/api/v1/auth/google/callback`
   - Production: `https://yourdomain.com/api/v1/auth/google/callback`

2. **HTTPS Required**: Google OAuth requires HTTPS in production. Use a reverse proxy (nginx) or deploy to a platform that provides HTTPS.

3. **Email Verification**: Google users skip email verification since Google already verifies emails.

4. **Profile Picture**: Google profile pictures are automatically saved if user doesn't have images.

5. **Name Handling**: The system handles different name formats from Google:
   - Uses `givenName` and `familyName` if available
   - Falls back to `displayName` if names not available
   - Defaults to "User" if nothing available

## 🐛 Troubleshooting

### Error: "redirect_uri_mismatch"
- Check that the callback URL in Google Console exactly matches your server URL
- Make sure you're using the correct environment (dev/prod)

### Error: "invalid_client"
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct in `.env`
- Make sure you copied the credentials correctly (no extra spaces)

### Error: "access_denied"
- User cancelled the OAuth consent
- This is normal if user clicks "Cancel" on Google consent screen

### User Not Created
- Check server logs for errors
- Verify database connection
- Check that required fields are being set

## 📚 Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Passport Google Strategy](https://github.com/jaredhanson/passport-google-oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)

## ✅ Checklist

- [ ] Google OAuth credentials created
- [ ] Environment variables added to `config/config.env`
- [ ] Callback URLs configured in Google Console
- [ ] Server restarted
- [ ] Tested Google login flow
- [ ] Verified user creation
- [ ] Tested account linking with existing email
- [ ] Checked security logs

---

**Status**: ✅ Ready to use (after adding credentials)

