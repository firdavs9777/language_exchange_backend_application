# Database Migrations

## Overview
This folder contains database migration scripts for BananaTalk backend.

## Available Migrations

### 1. Add Notification Fields (`addNotificationFields.js`)

**Purpose:** Adds push notification-related fields to all existing users.

**What it does:**
- Adds `fcmTokens` array with default empty value
- Adds `notificationSettings` with default preferences
- Adds `badges` with zero counts
- Creates database indexes for optimal query performance
- Verifies all users have been updated correctly

**When to run:**
- After deploying the push notification system
- Before testing notifications with existing users
- One-time migration (safe to run multiple times)

**How to run:**
```bash
cd /Users/firdavsmutalipov/Desktop/BananaTalk/backend
node migrations/addNotificationFields.js
```

**Expected Output:**
```
╔════════════════════════════════════════════════╗
║  Push Notification Fields Migration Script    ║
╚════════════════════════════════════════════════╝

MongoDB Connected: cluster0-xxx.mongodb.net

🔄 Starting migration...

📊 Found 150 users to update

   ⏳ Updated 100/150 users...

📈 Migration Summary:
   ✅ Successfully updated: 150
   📊 Total processed: 150

🔍 Creating indexes...
   ✅ User model indexes created
   ✅ Notification model indexes created

🔎 Verifying migration...
   📊 Total users: 150
   ✅ Users with fcmTokens: 150
   ✅ Users with notificationSettings: 150
   ✅ Users with badges: 150

✅ Migration verified successfully!

🎉 Migration completed successfully!
```

## Migration Safety

All migrations are designed to be:
- **Idempotent:** Safe to run multiple times
- **Non-destructive:** Won't delete or overwrite existing data
- **Verified:** Includes verification step to ensure success
- **Logged:** Provides detailed output of all actions

## Rollback

If you need to remove the notification fields:

```javascript
// Run in MongoDB shell or create a rollback script
db.users.updateMany(
  {},
  {
    $unset: {
      fcmTokens: "",
      notificationSettings: "",
      badges: ""
    }
  }
);
```

## Best Practices

1. **Backup First:** Always backup your database before running migrations
2. **Test Environment:** Run migrations in development/staging first
3. **Monitor Logs:** Watch the output for any errors or warnings
4. **Verify Results:** Check a few users manually in MongoDB to confirm
5. **Keep Scripts:** Don't delete migration scripts after running them

## Creating New Migrations

When creating a new migration script:

1. Create a descriptive filename (e.g., `addNewFeature.js`)
2. Include clear comments and console.log statements
3. Add verification step to confirm success
4. Make it idempotent (safe to run multiple times)
5. Update this README with migration details

## Database Indexes

The notification migration creates these indexes:

**User Collection:**
- `fcmTokens.token` - For token lookups
- `fcmTokens.deviceId` - For device-specific operations

**Notification Collection:**
- `userId + sentAt` (compound) - For user notification history
- `expiresAt` (TTL) - Automatic cleanup of old notifications

## Troubleshooting

### "All users already have notification fields"
This means the migration has already been run successfully. No action needed.

### "Some users may not have been updated properly"
Check the detailed output for failed user IDs. You may need to manually update those users or investigate the error.

### Connection errors
- Verify `MONGO_URI` in `config/config.env` is correct
- Ensure your IP is whitelisted in MongoDB Atlas
- Check network connectivity

### Out of memory errors
If migrating a very large database (100,000+ users), modify the script to process in smaller batches.

## Support

For issues with migrations:
1. Check the console output for specific errors
2. Verify database connection settings
3. Ensure you're running from the correct directory
4. Review MongoDB logs for detailed error messages

